"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  FileUp,
  Link2,
  ListTodo,
  LockKeyhole,
  Network,
  Plus,
  Server,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  createDevice,
  createLink,
  createProject,
  getTopology,
  importDevices,
  listIpAllocations,
  listProjects,
  listSecurityRules,
  listTasks,
  type IPAllocation,
  type Project,
  type ProjectTask,
  type SecurityRule,
  type Topology,
} from "../../lib/api";
import "../globals.css";

type AuditCheck = {
  label: string;
  detail: string;
  passed: boolean;
  href: string;
};

export default function InfrastructureAuditPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [topology, setTopology] = useState<Topology>({ nodes: [], links: [] });
  const [allocations, setAllocations] = useState<IPAllocation[]>([]);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceKind, setDeviceKind] = useState<"device" | "site" | "service">("device");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [sourcePort, setSourcePort] = useState("");
  const [targetPort, setTargetPort] = useState("");
  const [medium, setMedium] = useState<"fiber" | "ethernet" | "wireless">("ethernet");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token)
      listProjects(token).then((loaded) => {
        setProjects(loaded);
        setProjectId(loaded[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    setLoading(true);
    Promise.all([
      getTopology(token, projectId),
      listIpAllocations(token, projectId),
      listSecurityRules(token, projectId),
      listTasks(token, projectId),
    ])
      .then(([loadedTopology, loadedAllocations, loadedRules, loadedTasks]) => {
        setTopology(loadedTopology);
        setAllocations(loadedAllocations);
        setRules(loadedRules);
        setTasks(loadedTasks);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  async function runAudit() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const [loadedTopology, loadedAllocations, loadedRules, loadedTasks] = await Promise.all([getTopology(token, projectId), listIpAllocations(token, projectId), listSecurityRules(token, projectId), listTasks(token, projectId)]);
      setTopology(loadedTopology); setAllocations(loadedAllocations); setRules(loadedRules); setTasks(loadedTasks); setLastRun(new Date().toLocaleString());
    } finally { setLoading(false); }
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !companyName.trim()) return;
    try {
      const project = await createProject(token, { name: companyName.trim(), description: companyDescription.trim() });
      setProjects((current) => [project, ...current]); setProjectId(project.id); setCompanyName(""); setCompanyDescription(""); setStatus("Company audit record created");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to create company record"); }
  }

  async function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const token = window.localStorage.getItem("aether_access_token"); if (!token || !projectId || !deviceName.trim()) return;
    try { await createDevice(token, projectId, { name: deviceName.trim(), kind: deviceKind }); setTopology(await getTopology(token, projectId)); setDeviceName(""); setStatus("Infrastructure device recorded"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to record device"); }
  }

  async function addConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const token = window.localStorage.getItem("aether_access_token"); if (!token || !projectId || !source || !target || source === target || !sourcePort.trim() || !targetPort.trim()) return;
    try {
      setTopology(await createLink(token, projectId, {
        source,
        target,
        medium,
        source_port: sourcePort.trim(),
        target_port: targetPort.trim(),
      }));
      setSource("");
      setTarget("");
      setSourcePort("");
      setTargetPort("");
      setStatus("Infrastructure connection recorded with port details");
    }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to record connection"); }
  }

  async function importAuditFile(event: ChangeEvent<HTMLInputElement>, format: "csv" | "nmap") {
    const token = window.localStorage.getItem("aether_access_token"); const file = event.target.files?.[0]; if (!token || !projectId || !file) return;
    try { const result = await importDevices(token, projectId, file, format); setTopology(await getTopology(token, projectId)); setStatus(`${result.imported} discovered assets imported`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to import audit file"); }
    finally { event.target.value = ""; }
  }

  const checks: AuditCheck[] = [
    {
      label: "Topology documented",
      detail: `${topology.nodes.length} nodes recorded`,
      passed: topology.nodes.length > 0,
      href: "/",
    },
    {
      label: "Links have endpoints",
      detail: `${topology.links.length} links recorded`,
      passed: topology.links.every(
        (link) =>
          topology.nodes.some((node) => node.id === link.source) &&
          topology.nodes.some((node) => node.id === link.target),
      ),
      href: "/",
    },
    {
      label: "IP plan has allocations",
      detail: `${allocations.length} addresses reserved`,
      passed: allocations.length > 0,
      href: "/ip-management",
    },
    {
      label: "Security policy exists",
      detail: `${rules.length} rules defined`,
      passed: rules.length > 0,
      href: "/security",
    },
    {
      label: "Work queue is clear",
      detail: `${tasks.filter((task) => task.status !== "done").length} open tasks`,
      passed: tasks.every((task) => task.status === "done"),
      href: "/tasks",
    },
    {
      label: "Project description exists",
      detail: projects.find((project) => project.id === projectId)?.description
        ? "Description recorded"
        : "Description missing",
      passed: Boolean(
        projects.find((project) => project.id === projectId)?.description,
      ),
      href: "/reports",
    },
  ];
  const score = Math.round(
    (checks.filter((check) => check.passed).length / checks.length) * 100,
  );

  return (
    <main className="imports-shell audit-shell">
      <header className="floorplan-header">
        <a href="/">
          <ArrowLeft size={16} /> Console
        </a>
        <div className="auth-brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>AETHER-IT</strong>
            <span>Infrastructure audit</span>
          </div>
        </div>
        <span className="floorplan-status">
          <span className="pulse" /> VPS CONNECTED
        </span>
      </header>
      <section className="imports-workspace audit-workspace">
        <span className="eyebrow">OPERATIONS / INFRASTRUCTURE AUDIT</span>
        <h1>Find gaps before they become incidents.</h1>
        <p>
          Audit evidence is calculated from the selected project&apos;s
          persisted operational data.
        </p>
        <section className="import-card panel audit-main-card">
          <label>
            Project
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="audit-intake-grid">
            <form onSubmit={createCompany} className="audit-intake-card">
              <b>Company record</b>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company / site name" />
              <input value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} placeholder="Audit scope or description" />
              <button disabled={!companyName.trim()}><Plus size={13} /> Create audit record</button>
            </form>
            <form onSubmit={addDevice} className="audit-intake-card">
              <b>Record infrastructure</b>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Device, site, or service" />
              <select value={deviceKind} onChange={(event) => setDeviceKind(event.target.value as typeof deviceKind)}><option value="device">Device</option><option value="site">Site</option><option value="service">Service</option></select>
              <button disabled={!projectId || !deviceName.trim()}><Plus size={13} /> Add asset</button>
            </form>
            <form onSubmit={addConnection} className="audit-intake-card">
              <b>Record connection</b>
              <select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Source asset</option>{topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select>
              <select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Target asset</option>{topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select>
              <select value={medium} onChange={(event) => setMedium(event.target.value as typeof medium)}><option value="ethernet">Ethernet</option><option value="fiber">Fiber</option><option value="wireless">Wireless</option></select>
              <div className="audit-port-row">
                <input required value={sourcePort} onChange={(event) => setSourcePort(event.target.value)} placeholder="Source port" />
                <input required value={targetPort} onChange={(event) => setTargetPort(event.target.value)} placeholder="Target port" />
              </div>
              <button disabled={!projectId || !source || !target || !sourcePort.trim() || !targetPort.trim()}><Link2 size={13} /> Add connection</button>
            </form>
            <label className="audit-intake-card audit-import"><b>Import discovery</b><span><FileUp size={15} /> CSV or Nmap XML</span><input type="file" accept=".csv,.xml,text/csv,application/xml" onChange={(event) => importAuditFile(event, event.target.files?.[0]?.name.endsWith(".xml") ? "nmap" : "csv")} disabled={!projectId} /></label>
          </div>
          {status && <p className="upload-status success">{status}</p>}
          <div className="audit-score">
            <FileSearch size={20} />
            <strong>{loading ? "..." : `${score}%`}</strong>
            <span>infrastructure readiness</span>
            <button className="audit-run" onClick={runAudit} disabled={loading || !projectId}><FileSearch size={13} /> {loading ? "Running..." : "Run audit"}</button>
          </div>
          {lastRun && <p className="audit-run-status">Last audit run: {lastRun}</p>}
          <div className="audit-port-summary">
            <b>Connection details</b>
            {topology.links.length ? (
              <ul>
                {topology.links.map((link, index) => (
                  <li key={`${link.source}-${link.target}-${index}`}>
                    {topology.nodes.find((node) => node.id === link.source)?.name ?? link.source} → {topology.nodes.find((node) => node.id === link.target)?.name ?? link.target} · {link.medium}
                    {link.source_port || link.target_port ? ` · ${link.source_port || "?"} ↔ ${link.target_port || "?"}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No connections recorded yet.</p>
            )}
          </div>
          <div className="audit-grid">
            {checks.map((check) => (
              <div
                className={`audit-check ${check.passed ? "passed" : "warning"}`}
                key={check.label}
              >
                <span>
                  {check.passed ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <TriangleAlert size={17} />
                  )}
                </span>
                <div>
                  <b>{check.label}</b>
                  <small>{check.detail}</small>
                </div>
                <a href={check.href}>Review</a>
              </div>
            ))}
          </div>
          <div className="audit-summary">
            <Network size={14} /> {topology.nodes.length} nodes{" "}
            <Server size={14} /> {topology.links.length} links{" "}
            <LockKeyhole size={14} /> {rules.length} rules{" "}
            <ListTodo size={14} /> {tasks.length} tasks
          </div>
        </section>
      </section>
      <footer className="statusbar">
        <span>
          <Sparkles size={12} /> AI ENGINE: Gemini 3 Flash
        </span>
        <span>INFRASTRUCTURE AUDIT</span>
        <span>VPS CONNECTED</span>
      </footer>
    </main>
  );
}
