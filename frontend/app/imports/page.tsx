"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { ArrowLeft, FileDown, FileUp, Network, Sparkles } from "lucide-react";
import { getTopology, importDevices, listProjects, type Project } from "../../lib/api";
import "../globals.css";

export default function ImportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token) listProjects(token).then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id ?? ""); });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token && projectId) getTopology(token, projectId).then((topology) => setNodeCount(topology.nodes.length));
  }, [projectId]);

  async function importFile(event: ChangeEvent<HTMLInputElement>, format: "csv" | "nmap") {
    const token = window.localStorage.getItem("aether_access_token");
    const file = event.target.files?.[0];
    if (!token || !projectId || !file) return;
    setLoading(true);
    setStatus("");
    try {
      const result = await importDevices(token, projectId, file, format);
      setNodeCount(result.topology_nodes);
      setStatus(`${result.imported} devices imported from ${format.toUpperCase()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return <main className="imports-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Manual discovery imports</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="imports-workspace"><span className="eyebrow">DATA ENTRY / IMPORT</span><h1>Bring existing inventory into the twin.</h1><p>Upload technician-generated files. AETHER-IT does not scan private client networks from the VPS.</p><section className="import-card panel"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="import-actions"><label className="import-choice"><input type="file" accept=".csv,text/csv" onChange={(event) => importFile(event, "csv")} disabled={!projectId || loading} /><FileUp size={24} /><b>Import CSV</b><span>name,kind</span></label><label className="import-choice"><input type="file" accept=".xml,application/xml,text/xml" onChange={(event) => importFile(event, "nmap")} disabled={!projectId || loading} /><FileDown size={24} /><b>Import Nmap XML</b><span>uploaded scan only</span></label></div>{status && <p className="upload-status success">{status}</p>}<div className="import-count"><Network size={15} /> Current project nodes: <b>{nodeCount}</b></div></section></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>MANUAL IMPORT MODE</span><span>VPS CONNECTED</span></footer></main>;
}
