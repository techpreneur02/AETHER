import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass

from backend.models.security_tool import SecurityToolAction, SecurityToolCatalogItem, SecurityToolId, SecurityToolRequest, SecurityToolResult


SAFE_TARGET = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,252}$")
DEFAULT_TIMEOUT_SECONDS = 20
OUTPUT_LIMIT = 50_000
SECURITY_TOOLS_ENABLED = os.getenv("AETHER_SECURITY_TOOLS_ENABLED", "false").lower() == "true"


@dataclass(frozen=True)
class ToolDefinition:
    id: SecurityToolId
    name: str
    category: str
    summary: str
    command_name: str | None
    env_flag: str | None
    actions: tuple[SecurityToolAction, ...]


TOOLS: tuple[ToolDefinition, ...] = (
    ToolDefinition("wireshark", "Wireshark", "Packet analysis", "Packet capture workflow and tshark/Wireshark readiness.", "tshark", None, ("status", "version", "capture_plan")),
    ToolDefinition("nmap", "Nmap", "Network discovery", "Authorized host discovery and version readiness checks.", "nmap", None, ("status", "version", "launch_profile", "nmap_host_discovery")),
    ToolDefinition("kali", "Kali Linux", "Security distribution", "Kali jump-box or container readiness for approved runbooks.", None, "AETHER_SECURITY_TOOL_KALI_ENABLED", ("status", "launch_profile")),
    ToolDefinition("splunk", "Splunk", "SIEM and log analysis", "Splunk search endpoint readiness for incident review.", None, "AETHER_SECURITY_TOOL_SPLUNK_URL", ("status", "launch_profile")),
    ToolDefinition("nessus", "Nessus", "Vulnerability management", "Nessus scanner readiness and approved scan handoff.", None, "AETHER_SECURITY_TOOL_NESSUS_URL", ("status", "launch_profile")),
    ToolDefinition("openvas", "OpenVAS", "Vulnerability management", "OpenVAS/GVM readiness and approved scan handoff.", None, "AETHER_SECURITY_TOOL_OPENVAS_URL", ("status", "launch_profile")),
    ToolDefinition("tcpdump", "tcpdump", "Packet capture", "Terminal packet capture readiness for controlled evidence collection.", "tcpdump", None, ("status", "version", "capture_plan")),
)


def _definition(tool_id: SecurityToolId) -> ToolDefinition:
    for tool in TOOLS:
        if tool.id == tool_id:
            return tool
    raise ValueError("Unknown security tool")


def _installed(command_name: str | None) -> bool:
    return bool(command_name and shutil.which(command_name))


def _configured(tool: ToolDefinition) -> bool:
    if tool.env_flag is None:
        return _installed(tool.command_name)
    return bool(os.getenv(tool.env_flag))


def _enabled(tool: ToolDefinition) -> bool:
    return SECURITY_TOOLS_ENABLED and _configured(tool)


def list_security_tools() -> list[SecurityToolCatalogItem]:
    items: list[SecurityToolCatalogItem] = []
    for tool in TOOLS:
        installed = _installed(tool.command_name)
        configured = _configured(tool)
        enabled = _enabled(tool)
        if enabled:
            status = "Enabled for approved security operations."
        elif configured:
            status = "Configured but disabled until AETHER_SECURITY_TOOLS_ENABLED=true."
        else:
            status = "Not configured on the API server."
        items.append(SecurityToolCatalogItem(id=tool.id, name=tool.name, category=tool.category, summary=tool.summary, command_name=tool.command_name, installed=installed, configured=configured, enabled=enabled, status=status, actions=list(tool.actions)))
    return items


def _safe_target(target: str) -> str:
    if not target or not SAFE_TARGET.fullmatch(target):
        raise ValueError("Use a single authorized hostname, IP address, or CIDR without spaces or shell syntax.")
    return target


def _run_local(tool: ToolDefinition, command: list[str]) -> SecurityToolResult:
    started = time.monotonic()
    if not _enabled(tool):
        raise RuntimeError(f"{tool.name} is not enabled on the API server.")
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=DEFAULT_TIMEOUT_SECONDS, check=False)
        output = (completed.stdout or completed.stderr or "No output returned.")[:OUTPUT_LIMIT]
        exit_code = completed.returncode
    except subprocess.TimeoutExpired:
        output = f"Security tool action exceeded the {DEFAULT_TIMEOUT_SECONDS}-second limit."
        exit_code = 124
    elapsed = round((time.monotonic() - started) * 1000)
    return SecurityToolResult(tool=tool.id, action="nmap_host_discovery", output=output, exit_code=exit_code, duration_ms=elapsed)


def run_security_tool(request: SecurityToolRequest) -> SecurityToolResult:
    tool = _definition(request.tool)
    started = time.monotonic()
    if request.action not in tool.actions:
        raise ValueError(f"{tool.name} does not support the selected action.")
    if request.action == "status":
        item = next(item for item in list_security_tools() if item.id == tool.id)
        return SecurityToolResult(tool=tool.id, action=request.action, output=f"{item.name}: {item.status}", exit_code=0 if item.enabled else 1, duration_ms=round((time.monotonic() - started) * 1000))
    if request.action == "version":
        if not tool.command_name:
            raise ValueError(f"{tool.name} does not expose a local version command.")
        if not _enabled(tool):
            raise RuntimeError(f"{tool.name} is not enabled on the API server.")
        completed = subprocess.run([tool.command_name, "--version"], capture_output=True, text=True, timeout=DEFAULT_TIMEOUT_SECONDS, check=False)
        return SecurityToolResult(tool=tool.id, action=request.action, output=(completed.stdout or completed.stderr or "No output returned.")[:OUTPUT_LIMIT], exit_code=completed.returncode, duration_ms=round((time.monotonic() - started) * 1000))
    if request.action == "nmap_host_discovery":
        if tool.id != "nmap":
            raise ValueError("Host discovery is only available through Nmap.")
        return _run_local(tool, ["nmap", "-sn", "--max-retries", "1", "--host-timeout", "15s", _safe_target(request.target)])
    if request.action == "capture_plan":
        return SecurityToolResult(tool=tool.id, action=request.action, output="Capture plan: confirm written authorization, choose one interface, set a time limit, capture only the scoped issue window, store evidence securely, and avoid collecting unrelated user traffic.", exit_code=0, duration_ms=round((time.monotonic() - started) * 1000))
    if request.action == "launch_profile":
        return SecurityToolResult(tool=tool.id, action=request.action, output=f"{tool.name} launch profile is ready for approved workflows. Configure credentials and scope on the server, then run named actions only from this console.", exit_code=0 if _enabled(tool) else 1, duration_ms=round((time.monotonic() - started) * 1000))
    raise ValueError("Unsupported security tool action")
