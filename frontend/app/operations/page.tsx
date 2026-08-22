"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowLeft, Bot, CheckCircle2, ChevronRight, CircleAlert, Copy, Network, Play, Server, TerminalSquare } from "lucide-react";
import { listOperationsTargets, queryHelpdesk, runOperationsCommand, type OperationsCommand, type OperationsResult, type OperationsTarget, type OperationsTargetStatus } from "../../lib/api";
import "../globals.css";

const targetDetails: Record<OperationsTarget, { label: string; detail: string; icon: typeof Server }> = {
  linux_vps: { label: "Linux VPS", detail: "SSH diagnostics and service checks", icon: Server },
  windows_server: { label: "Windows Server", detail: "OpenSSH and PowerShell diagnostics", icon: Network },
  cpanel: { label: "cPanel", detail: "Read-only UAPI account checks", icon: TerminalSquare },
};

const commandDetails: Record<OperationsCommand, { label: string; detail: string; argument: string; targets: OperationsTarget[] }> = {
  ping: { label: "Ping", detail: "Reachability and packet loss", argument: "Host or IP", targets: ["linux_vps", "windows_server"] },
  traceroute: { label: "Trace route", detail: "Path to one approved destination", argument: "Host or IP", targets: ["linux_vps", "windows_server"] },
  network_summary: { label: "Network summary", detail: "Addresses, routes, and interfaces", argument: "", targets: ["linux_vps", "windows_server"] },
  dns_lookup: { label: "DNS lookup", detail: "Resolve an approved hostname", argument: "Hostname", targets: ["linux_vps", "windows_server"] },
  service_status: { label: "Service status", detail: "Inspect one named service", argument: "Service name", targets: ["linux_vps", "windows_server"] },
  recent_logs: { label: "Recent logs", detail: "Read the latest service or system events", argument: "Service name (Linux only)", targets: ["linux_vps", "windows_server"] },
  account_summary: { label: "Account summary", detail: "Read cPanel account metadata", argument: "", targets: ["cpanel"] },
  domains: { label: "Domains", detail: "Read configured cPanel domains", argument: "", targets: ["cpanel"] },
  email_accounts: { label: "Email accounts", detail: "Read cPanel mailbox inventory", argument: "", targets: ["cpanel"] },
};

export default function OperationsPage() {
  const [targets, setTargets] = useState<OperationsTargetStatus[]>([]);
  const [target, setTarget] = useState<OperationsTarget>("linux_vps");
  const [command, setCommand] = useState<OperationsCommand>("ping");
  const [argumentValue, setArgumentValue] = useState("example.com");
  const [result, setResult] = useState<OperationsResult | null>(null);
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) return;
    listOperationsTargets(token).then(setTargets).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load targets"));
  }, []);

  const selectedTarget = targets.find((item) => item.target === target);
  const commands = (Object.entries(commandDetails) as [OperationsCommand, typeof commandDetails[OperationsCommand]][]).filter(([, details]) => details.targets.includes(target));
  const selectedCommand = commandDetails[command];

  function selectTarget(nextTarget: OperationsTarget) {
    setTarget(nextTarget);
    const nextCommand = (Object.keys(commandDetails) as OperationsCommand[]).find((candidate) => commandDetails[candidate].targets.includes(nextTarget)) ?? "ping";
    setCommand(nextCommand);
    setArgumentValue(commandDetails[nextCommand].argument ? "example.com" : "");
    setResult(null);
    setGuidance("");
    setError("");
  }

  async function run() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) return;
    setRunning(true);
    setError("");
    setGuidance("");
    try {
      setResult(await runOperationsCommand(token, { target, command, argument: argumentValue.trim() }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The diagnostic could not run");
    } finally {
      setRunning(false);
    }
  }

  async function explain() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !result) return;
    setExplaining(true);
    try {
      const response = await queryHelpdesk(token, `Explain this authorized ${targetDetails[target].label} diagnostic result. State likely causes, safe next checks, and when to escalate. Do not recommend destructive commands.\n\n${result.output.slice(0, 8000)}`);
      setGuidance(response.answer);
    } catch (explainError) {
      setError(explainError instanceof Error ? explainError.message : "AI guidance is unavailable");
    } finally {
      setExplaining(false);
    }
  }

  return <main className="operations-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><TerminalSquare size={18} /></div><div><strong>AETHER-IT</strong><span>Authorized remote operations</span></div></div><span className="floorplan-status"><span className="pulse" /> CONTROLLED EXECUTION</span></header><section className="operations-workspace"><div className="operations-heading"><span className="eyebrow">REMOTE OPERATIONS / DIAGNOSTICS</span><h1>Troubleshoot systems from one controlled console.</h1><p>Choose an authorized target and a bounded diagnostic. Every operation is server-side, time-limited, and requires an administrator session.</p></div><div className="operations-grid"><section className="operations-frame"><div className="panel-heading"><b>1. TARGET TOGGLES</b><Activity size={15} /></div>{(Object.keys(targetDetails) as OperationsTarget[]).map((candidate) => { const details = targetDetails[candidate]; const status = targets.find((item) => item.target === candidate); const Icon = details.icon; return <label className="operations-toggle" key={candidate}><span><Icon size={17} /><span><b>{details.label}</b><small>{status?.detail ?? details.detail}</small></span></span><input aria-label={`Select ${details.label}`} type="checkbox" checked={target === candidate} onChange={() => selectTarget(candidate)} /><i /></label>; })}</section><section className="operations-frame"><div className="panel-heading"><b>2. DIAGNOSTIC</b><ChevronRight size={15} /></div><div className="operations-command-list">{commands.map(([candidate, details]) => <button className={command === candidate ? "selected" : ""} key={candidate} onClick={() => { setCommand(candidate); setArgumentValue(details.argument ? "example.com" : ""); setResult(null); setGuidance(""); }}><span><b>{details.label}</b><small>{details.detail}</small></span><ChevronRight size={14} /></button>)}</div><label className="operations-argument">{selectedCommand.argument || "No additional input required"}<input disabled={!selectedCommand.argument} value={argumentValue} placeholder={selectedCommand.argument} onChange={(event) => setArgumentValue(event.target.value)} /></label><button className="operations-run" disabled={!selectedTarget?.available || running} onClick={run}><Play size={15} />{running ? "Running diagnostic..." : "Run authorized diagnostic"}</button>{!selectedTarget?.available && <p className="operations-notice"><CircleAlert size={14} />This target is not configured on the application server.</p>}</section><section className="operations-frame operations-output"><div className="panel-heading"><b>3. RESULT</b>{result && <span className={result.exit_code === 0 ? "operations-success" : "operations-failed"}>{result.exit_code === 0 ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}{result.exit_code === 0 ? "COMPLETED" : `EXIT ${result.exit_code}`}</span>}</div>{result ? <><pre>{result.output}</pre><div className="operations-result-meta"><span>{result.duration_ms} ms</span><button onClick={() => navigator.clipboard.writeText(result.output)}><Copy size={13} /> Copy output</button></div></> : <div className="operations-empty"><TerminalSquare size={32} /><b>No diagnostic output</b><span>Choose a target and run a permitted check.</span></div>}</section><section className="operations-frame operations-ai"><div className="panel-heading"><b>4. AI TROUBLESHOOTING GUIDE</b><Bot size={15} /></div><p>AI explains the received result and suggests the next named diagnostic. It cannot send custom shell commands.</p><button disabled={!result || explaining} onClick={explain}><Bot size={15} />{explaining ? "Reviewing output..." : "Explain result and next checks"}</button>{guidance && <div className="operations-guidance">{guidance}</div>}</section></div>{error && <p className="operations-error">{error}</p>}</section></main>;
}