"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowLeft, GitBranch, Plus, Sparkles, Trash2 } from "lucide-react";
import { createIpAllocation, deleteIpAllocation, listIpAllocations, listProjects, type IPAllocation, type Project } from "../../lib/api";
import "../globals.css";

export default function IPManagementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [allocations, setAllocations] = useState<IPAllocation[]>([]);
  const [address, setAddress] = useState("");
  const [subnet, setSubnet] = useState("255.255.255.0");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token) listProjects(token).then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id ?? ""); });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token && projectId) listIpAllocations(token, projectId).then(setAllocations).catch(() => setAllocations([]));
  }, [projectId]);

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId || !address.trim() || !subnet.trim()) return;
    setSaving(true);
    setStatus("");
    try {
      const allocation = await createIpAllocation(token, projectId, { address: address.trim(), subnet: subnet.trim(), description: description.trim() });
      setAllocations((current) => [...current, allocation]);
      setAddress("");
      setDescription("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to allocate address");
    } finally {
      setSaving(false);
    }
  }

  async function removeAllocation(allocationId: string) {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    try {
      await deleteIpAllocation(token, projectId, allocationId);
      setAllocations((current) => current.filter((allocation) => allocation.id !== allocationId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete allocation");
    }
  }

  return <main className="imports-shell">
    <header className="floorplan-header">
      <a href="/"><ArrowLeft size={16} /> Console</a>
      <div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>IP address management</span></div></div>
      <span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span>
    </header>
    <section className="imports-workspace">
      <span className="eyebrow">NETWORK / IP MANAGEMENT</span>
      <h1>Track address allocations per project.</h1>
      <p>Reserve addresses against subnets so devices and technicians avoid conflicts.</p>
      <section className="import-card panel">
        <label>Project<select value={projectId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <form className="ip-form" onSubmit={submitAllocation}>
          <input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address (e.g. 10.10.1.20)" />
          <input required value={subnet} onChange={(event) => setSubnet(event.target.value)} placeholder="Subnet mask" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" />
          <button disabled={saving || !projectId}><Plus size={14} /> {saving ? "Saving..." : "Allocate"}</button>
        </form>
        {status && <p className="upload-status error">{status}</p>}
        <table className="ip-table">
          <thead><tr><th>Address</th><th>Subnet</th><th>Description</th><th /></tr></thead>
          <tbody>
            {allocations.map((allocation) => <tr key={allocation.id}>
              <td>{allocation.address}</td>
              <td>{allocation.subnet}</td>
              <td>{allocation.description || "—"}</td>
              <td><button className="icon-action" onClick={() => removeAllocation(allocation.id)}><Trash2 size={14} /></button></td>
            </tr>)}
            {!allocations.length && <tr><td colSpan={4} className="empty-allocations"><GitBranch size={20} /> No addresses allocated yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </section>
    <footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>IP MANAGEMENT</span><span>VPS CONNECTED</span></footer>
  </main>;
}
