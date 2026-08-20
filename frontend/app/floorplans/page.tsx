"use client";

import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, FileImage, FileUp, Map, Sparkles, Upload } from "lucide-react";
import { getTopology, importDevices, listProjects, updateDevicePosition, uploadFloorplan, type Project, type Topology } from "../../lib/api";
import "../globals.css";

export default function FloorplansPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [draggingId, setDraggingId] = useState("");
  const floorplanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token) listProjects(token).then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id ?? ""); });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token && projectId) getTopology(token, projectId).then(setTopology).catch(() => setTopology(null));
  }, [projectId]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setStatus("");
    if (selected && selected.type.startsWith("image/")) setPreview(URL.createObjectURL(selected));
    else setPreview("");
  }

  async function upload() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId || !file) return;
    setUploading(true);
    setStatus("");
    try {
      const project = await uploadFloorplan(token, projectId, file);
      setProjects((current) => current.map((item) => item.id === project.id ? project : item));
      setStatus("Floorplan stored on VPS");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>, format: "csv" | "nmap") {
    const token = window.localStorage.getItem("aether_access_token");
    const selected = event.target.files?.[0];
    if (!token || !projectId || !selected) return;
    setImporting(true);
    setStatus("");
    try {
      const summary = await importDevices(token, projectId, selected, format);
      setTopology(await getTopology(token, projectId));
      setStatus(`${summary.imported} devices imported from ${format.toUpperCase()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  function moveDevice(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingId || !floorplanRef.current) return;
    const bounds = floorplanRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    setTopology((current) => current ? { ...current, nodes: current.nodes.map((node) => node.id === draggingId ? { ...node, floorplan_x: x, floorplan_y: y } : node) } : current);
  }

  async function releaseDevice() {
    if (!draggingId || !projectId) return;
    const token = window.localStorage.getItem("aether_access_token");
    const node = topology?.nodes.find((item) => item.id === draggingId);
    setDraggingId("");
    if (token && node?.floorplan_x !== undefined && node.floorplan_y !== undefined) {
      setTopology(await updateDevicePosition(token, projectId, node.id, { floorplan_x: node.floorplan_x, floorplan_y: node.floorplan_y }));
    }
  }

  return <main className="floorplan-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Floorplan workspace</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="floorplan-workspace"><div className="floorplan-heading"><span className="eyebrow">PHYSICAL LAYER / FLOORPLANS</span><h1>Place infrastructure in the real space.</h1><p>Upload a site plan, then position project devices for a synchronized field view.</p></div><div className="floorplan-grid"><section className="upload-panel"><div className="panel-heading"><b>PROJECT FLOORPLAN</b><Map size={14} /></div><label className="floorplan-select">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="dropzone"><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={chooseFile} /><FileUp size={26} /><b>{file ? file.name : "Choose a floorplan"}</b><span>PNG, JPEG or PDF · 10 MB maximum</span></label>{file && <div className="file-row"><FileImage size={15} /><span>{file.type || "Document"}</span><small>{Math.ceil(file.size / 1024)} KB</small><Check size={14} /></div>}<button className="upload-button" disabled={!file || !projectId || uploading} onClick={upload}><Upload size={15} />{uploading ? "Uploading..." : "Upload to VPS"}</button>{status && <p className={`upload-status ${status.includes("stored") ? "success" : "error"}`}>{status}</p>}</section><section className="floorplan-preview panel"><div className="panel-heading"><b>PREVIEW / 2D</b><span className="tiny-badge">{file?.type === "application/pdf" ? "PDF" : "IMAGE"}</span></div>{preview ? <div className="floorplan-stage" ref={floorplanRef} onPointerMove={moveDevice} onPointerUp={releaseDevice}><img src={preview} alt="Selected floorplan preview" />{topology?.nodes.map((node, index) => <button key={node.id} className={`floorplan-marker ${draggingId === node.id ? "dragging" : ""}`} style={{ left: `${(node.floorplan_x ?? 0.2 + (index % 3) * 0.3) * 100}%`, top: `${(node.floorplan_y ?? 0.25 + Math.floor(index / 3) * 0.2) * 100}%` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggingId(node.id); }} title={node.name}><Map size={12} /></button>)}</div> : <div className="empty-floorplan"><Map size={36} /><b>{file ? "PDF selected" : "No floorplan selected"}</b><span>{file ? "Upload it to store this asset on the VPS." : "Select a project and upload a plan to begin."}</span></div>}</section></div></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>VPS CONNECTED</span><span>AETHER-IT v1.0.0</span></footer></main>;
}