"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, Plus, Sparkles, Trash2 } from "lucide-react";
import { createSecurityRule, deleteSecurityRule, listProjects, listSecurityRules, type Project, type SecurityRule } from "../../lib/api";
import "../globals.css";

export default function SecurityPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [name, setName] = useState("");
  const [action, setAction] = useState<SecurityRule["action"]>("deny");
  const [protocol, setProtocol] = useState<SecurityRule["protocol"]>("tcp");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [port, setPort] = useState("any");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { const token = window.localStorage.getItem("aether_access_token"); if (token) listProjects(token).then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id ?? ""); }); }, []);
  useEffect(() => { const token = window.localStorage.getItem("aether_access_token"); if (token && projectId) listSecurityRules(token, projectId).then(setRules).catch(() => setRules([])); }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const token = window.localStorage.getItem("aether_access_token"); if (!token || !projectId || !name.trim() || !source.trim() || !destination.trim()) return;
    setSaving(true); setStatus("");
    try { const rule = await createSecurityRule(token, projectId, { name: name.trim(), action, protocol, source: source.trim(), destination: destination.trim(), port: port.trim() || "any" }); setRules((current) => [...current, rule]); setName(""); setSource(""); setDestination(""); setStatus("Security rule added"); } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to add rule"); } finally { setSaving(false); }
  }

  async function remove(ruleId: string) { const token = window.localStorage.getItem("aether_access_token"); if (!token || !projectId) return; try { await deleteSecurityRule(token, projectId, ruleId); setRules((current) => current.filter((rule) => rule.id !== ruleId)); setStatus("Security rule removed"); } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to remove rule"); } }

  return <main className="imports-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Security policy management</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="imports-workspace"><span className="eyebrow">CONTROL / SECURITY</span><h1>Make policy visible and reviewable.</h1><p>Record project firewall intent before it becomes a production change.</p><section className="import-card panel"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><form className="security-form" onSubmit={submit}><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Rule name" /><select value={action} onChange={(event) => setAction(event.target.value as SecurityRule["action"])}><option value="deny">Deny</option><option value="allow">Allow</option></select><select value={protocol} onChange={(event) => setProtocol(event.target.value as SecurityRule["protocol"])}><option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option><option value="any">Any</option></select><input required value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source CIDR" /><input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Destination CIDR" /><input value={port} onChange={(event) => setPort(event.target.value)} placeholder="Port" /><button disabled={saving || !projectId}><Plus size={14} /> {saving ? "Saving..." : "Add rule"}</button></form>{status && <p className="upload-status success">{status}</p>}<table className="ip-table security-table"><thead><tr><th>Rule</th><th>Action</th><th>Protocol</th><th>Source</th><th>Destination</th><th>Port</th><th /></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td>{rule.name}</td><td><span className={`rule-action ${rule.action}`}>{rule.action.toUpperCase()}</span></td><td>{rule.protocol.toUpperCase()}</td><td>{rule.source}</td><td>{rule.destination}</td><td>{rule.port}</td><td><button className="icon-action" onClick={() => remove(rule.id)}><Trash2 size={14} /></button></td></tr>)}{!rules.length && <tr><td colSpan={7} className="empty-allocations"><LockKeyhole size={20} /> No security rules defined.</td></tr>}</tbody></table></section></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>SECURITY POLICY</span><span>VPS CONNECTED</span></footer></main>;
}
