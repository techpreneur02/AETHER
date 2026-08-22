"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, FileCode2, Sparkles } from "lucide-react";
import {
  listProjects,
  previewConfig,
  type ConfigPreview,
  type Project,
} from "../../lib/api";
import "../globals.css";

export default function ConfigPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [vendor, setVendor] = useState<ConfigPreview["vendor"]>("cisco_ios");
  const [hostname, setHostname] = useState("core-01");
  const [managementIp, setManagementIp] = useState("10.0.0.2");
  const [vlanId, setVlanId] = useState("10");
  const [preview, setPreview] = useState<ConfigPreview | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token)
      listProjects(token).then((loaded) => {
        setProjects(loaded);
        setProjectId(loaded[0]?.id ?? "");
      });
  }, []);

  async function generate() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    setLoading(true);
    setStatus("");
    try {
      setPreview(
        await previewConfig(token, projectId, {
          vendor,
          hostname,
          management_ip: managementIp,
          vlan_id: Number(vlanId),
        }),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyConfig() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview.generated_config);
    setStatus("Copied to clipboard");
  }

  return (
    <main className="config-shell">
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
            <span>Safe Mode configuration review</span>
          </div>
        </div>
        <span className="floorplan-status">
          <span className="pulse" /> VPS CONNECTED
        </span>
      </header>
      <section className="config-workspace">
        <div className="floorplan-heading">
          <span className="eyebrow">AUTOMATION / CONFIG REVIEW</span>
          <h1>Generate safely. Review before action.</h1>
          <p>
            Produce reviewable network, Windows Server, firewall-policy, and
            validation artifacts. Nothing is executed from the browser.
          </p>
        </div>
        <div className="config-grid">
          <section className="config-form panel">
            <div className="panel-heading">
              <b>APPROVED VARIABLES</b>
              <FileCode2 size={14} />
            </div>
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
            <label>
              Platform or workflow
              <select
                value={vendor}
                onChange={(event) =>
                  setVendor(event.target.value as ConfigPreview["vendor"])
                }
              >
                <option value="cisco_ios">Cisco IOS</option>
                <option value="mikrotik_routeros">MikroTik RouterOS</option>
                <option value="fortinet_fortios">FortiOS</option>
                <option value="windows_server">Windows Server baseline</option>
                <option value="firewall_policy">Firewall policy baseline</option>
                <option value="network_validation">Network validation plan</option>
              </select>
            </label>
            <label>
              Hostname or target
              <input
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
              />
            </label>
            <label>
              Management IP or subnet
              <input
                value={managementIp}
                onChange={(event) => setManagementIp(event.target.value)}
              />
            </label>
            <label>
              VLAN ID
              <input
                min="1"
                max="4094"
                type="number"
                value={vlanId}
                onChange={(event) => setVlanId(event.target.value)}
              />
            </label>
            <button
              className="upload-button"
              disabled={!projectId || loading}
              onClick={generate}
            >
              {loading ? "Generating..." : "Generate preview"}
            </button>
          </section>
          <section className="config-preview panel">
            <div className="panel-heading">
              <b>INLINE DIFF / PREVIEW</b>
              {preview && (
                <span className="ai-badge">
                  <Sparkles size={11} />{" "}
                  {preview.ai_suggested ? "AI SUGGESTED" : "TEMPLATE GENERATED"}
                </span>
              )}
            </div>
            {preview ? (
              <>
                <pre>{preview.generated_config}</pre>
                <div className="config-actions">
                  <span>Template v{preview.template_version}</span>
                  <button onClick={copyConfig}>
                    {status === "Copied to clipboard" ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {status === "Copied to clipboard"
                      ? "Copied"
                      : "Copy to clipboard"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-config">
                <FileCode2 size={34} />
                <b>No preview generated</b>
                <span>Choose a project and approved variables to begin.</span>
              </div>
            )}
            {status && status !== "Copied to clipboard" && (
              <p className="upload-status error">{status}</p>
            )}
          </section>
        </div>
      </section>
      <footer className="statusbar">
        <span>
          <Sparkles size={12} /> AI ENGINE: Gemini 3 Flash
        </span>
        <span>SAFE MODE</span>
        <span>VPS CONNECTED</span>
      </footer>
    </main>
  );
}
