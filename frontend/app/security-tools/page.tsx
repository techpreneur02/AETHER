"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Copy, Play, Radar, Search, ShieldCheck, TerminalSquare } from "lucide-react";
import { listSecurityTools, queryHelpdesk, runSecurityTool, type SecurityToolAction, type SecurityToolCatalogItem, type SecurityToolId, type SecurityToolResult } from "../../lib/api";
import "../globals.css";

const toolMarks: Record<SecurityToolId, { mark: string; tone: string }> = {
  wireshark: { mark: "WS", tone: "blue" },
  nmap: { mark: "NM", tone: "green" },
  kali: { mark: "KL", tone: "violet" },
  splunk: { mark: "SP", tone: "lime" },
  nessus: { mark: "NS", tone: "amber" },
  openvas: { mark: "OV", tone: "mint" },
  tcpdump: { mark: "TD", tone: "cyan" },
};

const actionLabels: Record<SecurityToolAction, { label: string; detail: string; needsTarget: boolean }> = {
  status: { label: "Status", detail: "Check readiness and enablement", needsTarget: false },
  version: { label: "Version", detail: "Read local CLI version", needsTarget: false },
  launch_profile: { label: "Launch profile", detail: "Show approved handoff workflow", needsTarget: false },
  nmap_host_discovery: { label: "Nmap discovery", detail: "Authorized host discovery only", needsTarget: true },
  capture_plan: { label: "Capture plan", detail: "Evidence workflow for packet capture", needsTarget: false },
};

export default function SecurityToolsPage() {
  const [tools, setTools] = useState<SecurityToolCatalogItem[]>([]);
  const [selectedTool, setSelectedTool] = useState<SecurityToolId>("nmap");
  const [action, setAction] = useState<SecurityToolAction>("status");
  const [target, setTarget] = useState("127.0.0.1");
  const [result, setResult] = useState<SecurityToolResult | null>(null);
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) return;
    listSecurityTools(token).then((loaded) => {
      setTools(loaded);
      if (loaded.length) {
        const preferred = loaded.find((tool) => tool.id === "nmap") ?? loaded[0];
        setSelectedTool(preferred.id);
        setAction(preferred.actions[0] ?? "status");
      }
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load security tools"));
  }, []);

  const selected = useMemo(() => tools.find((tool) => tool.id === selectedTool), [selectedTool, tools]);
  const actions = selected?.actions ?? [];
  const selectedAction = actionLabels[action];

  function chooseTool(tool: SecurityToolCatalogItem) {
    setSelectedTool(tool.id);
    setAction(tool.actions[0] ?? "status");
    setResult(null);
    setGuidance("");
    setError("");
  }

  async function runAction() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !selected) return;
    setRunning(true);
    setError("");
    setGuidance("");
    try {
      setResult(await runSecurityTool(token, { tool: selected.id, action, target: target.trim() }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The security tool action could not run");
    } finally {
      setRunning(false);
    }
  }

  async function explainResult() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !result || !selected) return;
    setExplaining(true);
    setError("");
    try {
      const response = await queryHelpdesk(token, `Explain this authorized ${selected.name} security-tool result. State what it means, safe next checks, and escalation points. Do not suggest exploitation, evasion, persistence, credential theft, or destructive commands.\n\n${result.output.slice(0, 8000)}`);
      setGuidance(response.answer);
    } catch (explainError) {
      setError(explainError instanceof Error ? explainError.message : "AI guidance is unavailable");
    } finally {
      setExplaining(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    await navigator.clipboard.writeText(result.output);
  }

  return (
    <main className="security-tools-shell">
      <header className="floorplan-header">
        <a href="/"><ArrowLeft size={16} /> Console</a>
        <div className="auth-brand"><div className="brand-mark"><Radar size={18} /></div><div><strong>AETHER-IT</strong><span>Security tool center</span></div></div>
        <span className="floorplan-status"><span className="pulse" /> AUTHORIZED SCOPE ONLY</span>
      </header>
      <section className="security-tools-workspace">
        <div className="operations-heading">
          <span className="eyebrow">SECURITY TOOLS / LAB & OPERATIONS</span>
          <h1>Run approved security tools from one controlled page.</h1>
          <p>Check tool readiness, open approved launch profiles, and run bounded diagnostics where the server has explicitly enabled them.</p>
        </div>
        <div className="security-tool-grid">
          <section className="security-tool-frame security-tool-catalog">
            <div className="panel-heading"><b>TOOL STACK</b><ShieldCheck size={15} /></div>
            <div className="security-tool-list">
              {tools.map((tool) => {
                const mark = toolMarks[tool.id];
                return (
                  <button className={tool.id === selectedTool ? "selected" : ""} key={tool.id} onClick={() => chooseTool(tool)}>
                    <span className={`tool-logo ${mark.tone}`}>{mark.mark}</span>
                    <span><b>{tool.name}</b><small>{tool.category}</small></span>
                    <i className={tool.enabled ? "running" : tool.configured ? "configured" : "disabled"}>{tool.enabled ? "RUNNING" : tool.configured ? "READY" : "OFF"}</i>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="security-tool-frame">
            <div className="panel-heading"><b>ACTION</b><TerminalSquare size={15} /></div>
            {selected && <div className="selected-tool-summary"><span className={`tool-logo large ${toolMarks[selected.id].tone}`}>{toolMarks[selected.id].mark}</span><div><b>{selected.name}</b><p>{selected.summary}</p><small>{selected.status}</small></div></div>}
            <div className="security-action-list">
              {actions.map((candidate) => (
                <button className={action === candidate ? "selected" : ""} key={candidate} onClick={() => { setAction(candidate); setResult(null); setGuidance(""); }}>
                  <span><b>{actionLabels[candidate].label}</b><small>{actionLabels[candidate].detail}</small></span>
                </button>
              ))}
            </div>
            {selectedAction?.needsTarget && <label className="operation-argument">Authorized target<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="host, IP, or CIDR" /></label>}
            <button className="operations-run" disabled={!selected || running} onClick={runAction}><Play size={15} /> {running ? "Running..." : "Run selected action"}</button>
            {error && <p className="upload-status error">{error}</p>}
          </section>
          <section className="security-tool-frame security-tool-output">
            <div className="panel-heading"><b>OUTPUT</b>{result && <span>{result.duration_ms} ms / exit {result.exit_code}</span>}</div>
            {result ? <><pre>{result.output}</pre><div className="config-actions"><span>Guarded execution</span><button onClick={copyOutput}><Copy size={14} /> Copy output</button></div></> : <div className="empty-config"><Search size={34} /><b>No tool output yet</b><span>Select a tool action to inspect readiness or run an approved diagnostic.</span></div>}
          </section>
          <section className="security-tool-frame security-tool-ai">
            <div className="panel-heading"><b>AI TROUBLESHOOTING FRAME</b><Bot size={15} /></div>
            <p>Use AI to interpret tool output, summarize likely causes, and suggest the next approved check. It will not execute commands.</p>
            <button className="operations-run secondary" disabled={!result || explaining} onClick={explainResult}><Bot size={15} /> {explaining ? "Reading output..." : "Explain result"}</button>
            {guidance ? <article className="ai-response"><div><CheckCircle2 size={15} /><small>SAFE GUIDANCE</small></div><p>{guidance}</p></article> : <div className="security-ai-empty">Run a status, version, launch profile, or approved scan to unlock interpretation.</div>}
          </section>
        </div>
      </section>
      <footer className="statusbar"><span><Radar size={12} /> TOOL STACK: WIRESHARK / NMAP / KALI / SPLUNK / NESSUS</span><span>ADMIN RUNNER</span><span>SCOPED EXECUTION</span></footer>
    </main>
  );
}
