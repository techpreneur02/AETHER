"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileCheck2, FileDown, Network, Server, Sparkles, ListTodo } from "lucide-react";
import { exportProjectJson, exportProjectPdf, getTopology, listIpAllocations, listProjects, listSecurityRules, listTasks, type IPAllocation, type Project, type ProjectTask, type SecurityRule, type Topology } from "../../lib/api";
import "../globals.css";

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [topology, setTopology] = useState<Topology>({ nodes: [], links: [] });
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [allocations, setAllocations] = useState<IPAllocation[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token) {
      listProjects(token).then((loaded) => {
        setProjects(loaded);
        setProjectId(loaded[0]?.id ?? "");
      });
    }
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token && projectId) {
      getTopology(token, projectId).then(setTopology).catch(() => setTopology({ nodes: [], links: [] }));
      listTasks(token, projectId).then(setTasks).catch(() => setTasks([]));
      listSecurityRules(token, projectId).then(setRules).catch(() => setRules([]));
      listIpAllocations(token, projectId).then(setAllocations).catch(() => setAllocations([]));
    }
  }, [projectId]);

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const checks = [topology.nodes.length > 0, topology.links.length > 0, openTasks === 0, rules.length > 0, allocations.length > 0];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  async function downloadJson() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    try {
      const blob = await exportProjectJson(token, projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(projects.find((project) => project.id === projectId)?.name ?? "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("JSON report exported");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to export JSON report");
    }
  }

  async function downloadPdf() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    try {
      const blob = await exportProjectPdf(token, projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(projects.find((project) => project.id === projectId)?.name ?? "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("PDF report exported");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to export PDF report");
    }
  }

  return <main className="imports-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Project reports</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="imports-workspace"><span className="eyebrow">REPORTING / PROJECT STATUS</span><h1>Read the project at a glance.</h1><p>A concise operational summary generated from the selected project’s live data.</p><section className="import-card panel"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="report-metrics"><div><Network size={16} /><b>{topology.nodes.length}</b><small>DEVICES</small></div><div><Server size={16} /><b>{topology.links.length}</b><small>LINKS</small></div><div><ListTodo size={16} /><b>{openTasks}</b><small>OPEN TASKS</small></div><div><FileCheck2 size={16} /><b>{score}%</b><small>READINESS</small></div></div><div className="audit-score" style={{ marginTop: "1rem" }}><button className="audit-run" onClick={downloadJson} disabled={!projectId}><FileDown size={13} /> Export JSON</button><button className="audit-run" onClick={downloadPdf} disabled={!projectId}><Download size={13} /> Export PDF</button></div>{status && <p className="upload-status success">{status}</p>}<table className="ip-table"><thead><tr><th>Project</th><th>Description</th><th>State</th></tr></thead><tbody><tr><td>{projects.find((project) => project.id === projectId)?.name ?? "No project selected"}</td><td>{projects.find((project) => project.id === projectId)?.description || "No description"}</td><td className="cable-medium">{projectId ? "ACTIVE" : "WAITING"}</td></tr></tbody></table></section></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>PROJECT REPORT</span><span>VPS CONNECTED</span></footer></main>;
}
