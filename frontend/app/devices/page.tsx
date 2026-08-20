"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Cpu,
  Plus,
  Router,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createDevice,
  deleteDevice,
  getTopology,
  listProjects,
  updateDevice,
  type Project,
  type Topology,
} from "../../lib/api";
import { catalogVendors, deviceCatalog } from "../../lib/deviceCatalog";
import "../globals.css";

export default function DevicesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [topology, setTopology] = useState<Topology>({ nodes: [], links: [] });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"device" | "site" | "service">("device");
  const [vendor, setVendor] = useState("");
  const [model, setModel] = useState("");
  const [portCount, setPortCount] = useState("24");
  const [customVendor, setCustomVendor] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState("");

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
    if (token && projectId)
      getTopology(token, projectId)
        .then(setTopology)
        .catch(() => setTopology({ nodes: [], links: [] }));
  }, [projectId]);

  async function refresh() {
    const token = window.localStorage.getItem("aether_access_token");
    if (token && projectId) setTopology(await getTopology(token, projectId));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId || !name.trim()) return;
    setSaving(true);
    setStatus("");
    try {
      const payload = { name: name.trim(), kind, vendor: (vendor === "__custom__" ? customVendor : vendor).trim(), model: (model === "__custom__" ? customModel : model).trim(), port_count: Number(portCount) || 4 };
      if (editingId) await updateDevice(token, projectId, editingId, payload);
      else await createDevice(token, projectId, payload);
      await refresh();
      setName("");
      setVendor("");
      setModel("");
      setCustomVendor("");
      setCustomModel("");
      setPortCount("24");
      setEditingId("");
      setStatus(editingId ? "Device updated" : "Device added to the project topology");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to add device",
      );
    } finally {
      setSaving(false);
    }
  }

  function editDevice(node: Topology["nodes"][number]) {
    setEditingId(node.id);
    setName(node.name);
    setKind(node.kind);
    setVendor(node.vendor ?? "");
    setModel(node.model ?? "");
    setCustomVendor("");
    setCustomModel("");
    setPortCount(String(node.port_count ?? 24));
    setStatus("Editing device");
  }

  async function remove(deviceId: string) {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    try {
      await deleteDevice(token, projectId, deviceId);
      await refresh();
      setStatus("Device removed from the project topology");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to remove device",
      );
    }
  }

  return (
    <main className="imports-shell">
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
            <span>Device inventory</span>
          </div>
        </div>
        <span className="floorplan-status">
          <span className="pulse" /> VPS CONNECTED
        </span>
      </header>
      <section className="imports-workspace">
        <span className="eyebrow">OPERATIONS / DEVICES</span>
        <h1>Know every asset in the twin.</h1>
        <p>
          Add and remove project devices from one inventory that stays connected
          to the live topology.
        </p>
        <section className="import-card panel">
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
          <form className="device-catalog-form" onSubmit={submit}>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Device name"
            />
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="device">Device</option>
              <option value="site">Site</option>
              <option value="service">Service</option>
            </select>
            <select
              value={vendor}
              onChange={(event) => {
                setVendor(event.target.value);
                setModel("");
              }}
            >
              <option value="">Vendor</option>
              <option value="__custom__">Custom / Not listed</option>
              {catalogVendors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {vendor === "__custom__" && <input value={customVendor} onChange={(event) => setCustomVendor(event.target.value)} placeholder="Custom vendor" />}
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={!vendor}
            >
              <option value="">Model</option>
              <option value="__custom__">Custom / Not listed</option>
              {(deviceCatalog[vendor] ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {model === "__custom__" && <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="Custom model" />}
            <select value={portCount} onChange={(event) => setPortCount(event.target.value)}><option value="4">4 ports</option><option value="8">8 ports</option><option value="12">12 ports</option><option value="24">24 ports</option><option value="48">48 ports</option><option value="96">96 ports</option></select>
            <button disabled={saving || !projectId}>
              <Plus size={14} /> {saving ? "Saving..." : editingId ? "Save changes" : "Add device"}
            </button>
          </form>
          {status && <p className="upload-status success">{status}</p>}
          <div className="device-inventory">
            {topology.nodes.map((node) => (
              <div className="inventory-row" key={node.id}>
                <span className="member-avatar">
                  {node.kind === "service" ? (
                    <Server size={15} />
                  ) : node.kind === "site" ? (
                    <Router size={15} />
                  ) : (
                    <Cpu size={15} />
                  )}
                </span>
                <div>
                  <b>{node.name}</b>
                  <small>
                    {node.vendor || "Custom"}{" "}
                    {node.model ? `· ${node.model}` : ""} ·{" "}
                    {node.kind.toUpperCase()} ·{" "}
                    {
                      topology.links.filter(
                        (link) =>
                          link.source === node.id || link.target === node.id,
                      ).length
                    }{" "}
                    links
                  </small>
                </div>
                <button
                  className="icon-action"
                  title={`Edit ${node.name}`}
                  onClick={() => editDevice(node)}
                >
                  Edit
                </button>
                <button
                  className="icon-action"
                  title={`Remove ${node.name}`}
                  onClick={() => remove(node.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!topology.nodes.length && (
              <div className="empty-allocations">
                <Cpu size={20} /> No devices in this project yet.
              </div>
            )}
          </div>
        </section>
      </section>
      <footer className="statusbar">
        <span>
          <Sparkles size={12} /> AI ENGINE: Gemini 3 Flash
        </span>
        <span>DEVICE CATALOG</span>
        <span>VPS CONNECTED</span>
      </footer>
    </main>
  );
}
