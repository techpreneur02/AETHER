"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Server, Sparkles } from "lucide-react";
import { getTopology, listProjects, type Project, type Topology } from "../../lib/api";
import "../globals.css";

export default function ServicesPage() {
  const [projects, setProjects] = useState<Project[]>([]); const [projectId, setProjectId] = useState(""); const [topology, setTopology] = useState<Topology>({ nodes: [], links: [] });
  useEffect(() => { const token = window.localStorage.getItem("aether_access_token"); if (token) listProjects(token).then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id ?? ""); }); }, []);
  useEffect(() => { const token = window.localStorage.getItem("aether_access_token"); if (token && projectId) getTopology(token, projectId).then(setTopology).catch(() => setTopology({ nodes: [], links: [] })); }, [projectId]);
  const services = topology.nodes.filter((node) => node.kind === "service");
  return <main className="imports-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Service inventory</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="imports-workspace"><span className="eyebrow">APPLICATION / SERVICES</span><h1>Keep critical services in context.</h1><p>Review application and infrastructure services recorded in the current project topology.</p><section className="import-card panel"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="cable-summary"><span><Server size={15} /> {services.length} registered services</span><span>Topology-backed inventory</span></div><div className="device-inventory">{services.map((node) => <div className="inventory-row" key={node.id}><span className="member-avatar"><Server size={15} /></span><div><b>{node.name}</b><small>SERVICE ASSET · project topology</small></div><span className="online-dot" /></div>)}{!services.length && <div className="empty-allocations"><Server size={20} /> No services registered yet.</div>}</div></section></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>SERVICE INVENTORY</span><span>VPS CONNECTED</span></footer></main>;
}
