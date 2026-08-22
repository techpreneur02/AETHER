import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request

from backend.models.operations import OperationsCommand, OperationsRequest, OperationsResult, OperationsTarget, OperationsTargetStatus


SAFE_ARGUMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,252}$")
SERVICE_ARGUMENT = re.compile(r"^[A-Za-z0-9_.@-]{1,128}$")
DEFAULT_TIMEOUT_SECONDS = 20


def target_status(target: OperationsTarget) -> OperationsTargetStatus:
    if target == "cpanel":
        configured = all(os.getenv(name) for name in ("AETHER_OPS_CPANEL_URL", "AETHER_OPS_CPANEL_USER", "AETHER_OPS_CPANEL_TOKEN"))
        return OperationsTargetStatus(target=target, available=configured, detail="cPanel UAPI is configured" if configured else "Set cPanel URL, user, and API token on the server to enable this target.")
    prefix = "AETHER_OPS_LINUX" if target == "linux_vps" else "AETHER_OPS_WINDOWS"
    configured = bool(os.getenv(f"{prefix}_SSH_HOST") and os.getenv(f"{prefix}_SSH_USER"))
    label = "Linux SSH" if target == "linux_vps" else "Windows OpenSSH"
    return OperationsTargetStatus(target=target, available=configured, detail=f"{label} is configured" if configured else f"Set {prefix}_SSH_HOST and {prefix}_SSH_USER on the server to enable this target.")


def list_target_statuses() -> list[OperationsTargetStatus]:
    return [target_status(target) for target in ("linux_vps", "windows_server", "cpanel")]


def _require_argument(argument: str, service: bool = False) -> str:
    validator = SERVICE_ARGUMENT if service else SAFE_ARGUMENT
    if not argument or not validator.fullmatch(argument):
        raise ValueError("Use a single hostname, IP address, or service name without spaces or shell syntax.")
    return argument


def _linux_command(command: OperationsCommand, argument: str) -> list[str]:
    if command == "ping":
        return ["ping", "-c", "4", _require_argument(argument)]
    if command == "traceroute":
        return ["traceroute", "-m", "12", "-n", _require_argument(argument)]
    if command == "network_summary":
        return ["sh", "-lc", "ip -brief address; ip route"]
    if command == "dns_lookup":
        return ["getent", "ahosts", _require_argument(argument)]
    if command == "service_status":
        return ["systemctl", "--no-pager", "--full", "status", _require_argument(argument, service=True)]
    if command == "recent_logs":
        return ["journalctl", "-u", _require_argument(argument, service=True), "-n", "100", "--no-pager"]
    raise ValueError("That diagnostic is not available for a Linux VPS target.")


def _windows_command(command: OperationsCommand, argument: str) -> str:
    if command == "ping":
        return f"Test-Connection -Count 4 -ComputerName '{_require_argument(argument)}'"
    if command == "traceroute":
        return f"tracert -d -h 12 {_require_argument(argument)}"
    if command == "network_summary":
        return "Get-NetIPAddress -AddressFamily IPv4; Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric"
    if command == "dns_lookup":
        return f"Resolve-DnsName '{_require_argument(argument)}'"
    if command == "service_status":
        return f"Get-Service -Name '{_require_argument(argument, service=True)}'"
    if command == "recent_logs":
        return "Get-WinEvent -LogName System -MaxEvents 50 | Format-List TimeCreated,Id,LevelDisplayName,ProviderName,Message"
    raise ValueError("That diagnostic is not available for a Windows Server target.")


def _ssh_result(request: OperationsRequest) -> OperationsResult:
    prefix = "AETHER_OPS_LINUX" if request.target == "linux_vps" else "AETHER_OPS_WINDOWS"
    host = os.getenv(f"{prefix}_SSH_HOST", "")
    user = os.getenv(f"{prefix}_SSH_USER", "")
    port = os.getenv(f"{prefix}_SSH_PORT", "22")
    key_path = os.getenv(f"{prefix}_SSH_KEY_PATH", "")
    known_hosts_path = os.getenv("AETHER_OPS_SSH_KNOWN_HOSTS_PATH", "/run/aether-ops-keys/known_hosts")
    if request.target == "linux_vps":
        remote = _linux_command(request.command, request.argument)
    else:
        remote = ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", _windows_command(request.command, request.argument)]
    command = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known_hosts_path}", "-p", port]
    if key_path:
        command.extend(["-i", key_path])
    command.extend([f"{user}@{host}", *remote])
    started = time.monotonic()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=DEFAULT_TIMEOUT_SECONDS, check=False)
        output = (completed.stdout or completed.stderr or "No output returned.")[:50_000]
        exit_code = completed.returncode
    except subprocess.TimeoutExpired:
        output = f"Diagnostic exceeded the {DEFAULT_TIMEOUT_SECONDS}-second limit."
        exit_code = 124
    elapsed = round((time.monotonic() - started) * 1000)
    return OperationsResult(target=request.target, command=request.command, output=output, exit_code=exit_code, duration_ms=elapsed)


def _cpanel_result(request: OperationsRequest) -> OperationsResult:
    functions = {"account_summary": "Variables/get_user_information", "domains": "DomainInfo/list_domains", "email_accounts": "Email/list_pops"}
    function = functions.get(request.command)
    if function is None:
        raise ValueError("That diagnostic is not available through the cPanel API target.")
    base_url = os.environ["AETHER_OPS_CPANEL_URL"].rstrip("/")
    user = os.environ["AETHER_OPS_CPANEL_USER"]
    token = os.environ["AETHER_OPS_CPANEL_TOKEN"]
    request_url = f"{base_url}/execute/{function}"
    started = time.monotonic()
    try:
        http_request = urllib.request.Request(request_url, headers={"Authorization": f"cpanel {user}:{token}", "Accept": "application/json"})
        with urllib.request.urlopen(http_request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            output = json.dumps(json.load(response), indent=2)[:50_000]
            exit_code = 0
    except urllib.error.HTTPError as error:
        output = f"cPanel API returned HTTP {error.code}."
        exit_code = error.code
    except urllib.error.URLError as error:
        output = f"Unable to reach cPanel API: {error.reason}"
        exit_code = 1
    elapsed = round((time.monotonic() - started) * 1000)
    return OperationsResult(target=request.target, command=request.command, output=output, exit_code=exit_code, duration_ms=elapsed)


def run_operations_request(request: OperationsRequest) -> OperationsResult:
    status = target_status(request.target)
    if not status.available:
        raise RuntimeError(status.detail)
    return _cpanel_result(request) if request.target == "cpanel" else _ssh_result(request)