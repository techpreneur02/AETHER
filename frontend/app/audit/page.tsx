"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  FileUp,
  ClipboardCheck,
  DraftingCompass,
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
  generateNetworkDesign,
  getTopology,
  importInfrastructure,
  listIpAllocations,
  listProjects,
  listSecurityRules,
  listTasks,
  saveClientAssessment,
  type AssessmentEvaluation,
  type ClientAssessment,
  type DesignRequirements,
  type IPAllocation,
  type Project,
  type ProjectTask,
  type NetworkDesign,
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
  const [workflow, setWorkflow] = useState<"infrastructure" | "assessment" | "designer" | "evaluation">("infrastructure");
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
  const [evaluation, setEvaluation] = useState<AssessmentEvaluation | null>(null);
  const [design, setDesign] = useState<NetworkDesign | null>(null);
  const [assessment, setAssessment] = useState<ClientAssessment>({
    client_contact: "", site_count: 1, user_count: 1, critical_services: [], internet_providers: "", current_pain_points: [], security_controls: [], backup_status: "unknown", documentation_quality: 1, resilience: 1, security: 1, scalability: 1, notes: "",
  });
  const [requirements, setRequirements] = useState<DesignRequirements>({
    objectives: [], availability_target: "high", growth_percent: 25, remote_users: 0, wireless_scope: "office", preferred_vendors: [], compliance: [], cloud_services: [], segmentation_required: true, budget_band: "balanced", constraints: "",
  });
  const [objectiveText, setObjectiveText] = useState("");
  const [criticalServiceText, setCriticalServiceText] = useState("");
  const [painPointText, setPainPointText] = useState("");
  const [securityControlText, setSecurityControlText] = useState("");
  const [vendorText, setVendorText] = useState("");
  const [complianceText, setComplianceText] = useState("");
  const [cloudText, setCloudText] = useState("");

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

  useEffect(() => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    if (project.client_assessment) {
      setAssessment(project.client_assessment);
      setCriticalServiceText(project.client_assessment.critical_services.join(", "));
      setPainPointText(project.client_assessment.current_pain_points.join("\n"));
      setSecurityControlText(project.client_assessment.security_controls.join(", "));
    }
    if (project.network_design) {
      setDesign(project.network_design);
      setRequirements(project.network_design.requirements);
      setObjectiveText(project.network_design.requirements.objectives.join("\n"));
      setVendorText(project.network_design.requirements.preferred_vendors.join(", "));
      setComplianceText(project.network_design.requirements.compliance.join(", "));
      setCloudText(project.network_design.requirements.cloud_services.join(", "));
    }
  }, [projectId, projects]);

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

  async function importAuditFile(event: ChangeEvent<HTMLInputElement>) {
    const token = window.localStorage.getItem("aether_access_token"); const file = event.target.files?.[0]; if (!token || !projectId || !file) return;
    try { const result = await importInfrastructure(token, projectId, file); setTopology(await getTopology(token, projectId)); setStatus(`${result.imported} assets imported from ${result.source_format.toUpperCase()}${result.skipped ? `; ${result.skipped} duplicates skipped` : ""}`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to import audit file"); }
    finally { event.target.value = ""; }
  }

  const commaList = (value: string) => value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    const payload = { ...assessment, critical_services: commaList(criticalServiceText), current_pain_points: commaList(painPointText), security_controls: commaList(securityControlText) };
    setLoading(true);
    try {
      const result = await saveClientAssessment(token, projectId, payload);
      setAssessment(payload); setEvaluation(result); setStatus("Client assessment saved and evaluated"); setWorkflow("evaluation");
      setProjects((current) => current.map((project) => project.id === projectId ? { ...project, client_assessment: payload } : project));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to save assessment"); }
    finally { setLoading(false); }
  }

  async function submitDesign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !projectId) return;
    const payload = { ...requirements, objectives: commaList(objectiveText), preferred_vendors: commaList(vendorText), compliance: commaList(complianceText), cloud_services: commaList(cloudText) };
    if (!payload.objectives.length) { setStatus("Record at least one client objective"); return; }
    setLoading(true);
    try {
      const result = await generateNetworkDesign(token, projectId, payload);
      setRequirements(payload); setDesign(result); setStatus("Network structure and configuration proposal generated"); setWorkflow("evaluation");
      setProjects((current) => current.map((project) => project.id === projectId ? { ...project, network_design: result } : project));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to generate design"); }
    finally { setLoading(false); }
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
          <nav className="audit-workflow-tabs" aria-label="Audit workflow">
            <button className={workflow === "infrastructure" ? "selected" : ""} onClick={() => setWorkflow("infrastructure")}><Network size={15} /> Infrastructure</button>
            <button className={workflow === "assessment" ? "selected" : ""} onClick={() => setWorkflow("assessment")}><ClipboardCheck size={15} /> Client audit</button>
            <button className={workflow === "designer" ? "selected" : ""} onClick={() => setWorkflow("designer")}><DraftingCompass size={15} /> Requirements designer</button>
            <button className={workflow === "evaluation" ? "selected" : ""} onClick={() => setWorkflow("evaluation")}><Sparkles size={15} /> Evaluation & proposal</button>
          </nav>
          {status && <p className="upload-status success">{status}</p>}

          {workflow === "infrastructure" && <>
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
            <label className="audit-intake-card audit-import"><b>Import infrastructure evidence</b><span><FileUp size={15} /> Select CSV, JSON, XML, TXT, LOG, or exported inventory</span><small>Content is auto-detected. Duplicate device names are skipped.</small><input type="file" accept="*/*" onChange={importAuditFile} disabled={!projectId} /></label>
          </div>
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
          </>}

          {workflow === "assessment" && <form className="client-assessment-form" onSubmit={submitAssessment}>
            <header className="audit-section-heading"><div><span className="eyebrow">NEW CLIENT DISCOVERY</span><h2>Digital infrastructure assessment</h2></div><p>Capture operational evidence and maturity, then calculate the initial risk position.</p></header>
            <div className="assessment-field-grid">
              <label>Client contact<input value={assessment.client_contact} onChange={(event) => setAssessment({ ...assessment, client_contact: event.target.value })} placeholder="Name or role" /></label>
              <label>Sites<input type="number" min="1" value={assessment.site_count} onChange={(event) => setAssessment({ ...assessment, site_count: Number(event.target.value) })} /></label>
              <label>Users<input type="number" min="1" value={assessment.user_count} onChange={(event) => setAssessment({ ...assessment, user_count: Number(event.target.value) })} /></label>
              <label>Internet providers<input value={assessment.internet_providers} onChange={(event) => setAssessment({ ...assessment, internet_providers: event.target.value })} placeholder="Carrier, circuit, bandwidth" /></label>
              <label className="wide">Critical services<input value={criticalServiceText} onChange={(event) => setCriticalServiceText(event.target.value)} placeholder="ERP, VoIP, CCTV, cloud applications" /></label>
              <label className="wide">Current pain points<textarea value={painPointText} onChange={(event) => setPainPointText(event.target.value)} placeholder="One issue per line" /></label>
              <label className="wide">Security controls<input value={securityControlText} onChange={(event) => setSecurityControlText(event.target.value)} placeholder="MFA, EDR, firewall, SIEM, backups" /></label>
              <label>Backup validation<select value={assessment.backup_status} onChange={(event) => setAssessment({ ...assessment, backup_status: event.target.value as ClientAssessment["backup_status"] })}><option value="unknown">Unknown</option><option value="none">None</option><option value="partial">Partial / untested</option><option value="tested">Tested restoration</option></select></label>
            </div>
            <div className="maturity-grid">
              {([['documentation_quality', 'Documentation'], ['resilience', 'Resilience'], ['security', 'Security'], ['scalability', 'Scalability']] as const).map(([field, label]) => <label key={field}><span>{label}<b>{assessment[field]}/5</b></span><input type="range" min="1" max="5" value={assessment[field]} onChange={(event) => setAssessment({ ...assessment, [field]: Number(event.target.value) })} /></label>)}
            </div>
            <label className="assessment-notes">Technician notes<textarea value={assessment.notes} onChange={(event) => setAssessment({ ...assessment, notes: event.target.value })} placeholder="Evidence, dependencies, ownership, risks, and observations" /></label>
            <button className="audit-primary" disabled={!projectId || loading}><ClipboardCheck size={15} /> Save and evaluate client</button>
          </form>}

          {workflow === "designer" && <form className="client-assessment-form" onSubmit={submitDesign}>
            <header className="audit-section-heading"><div><span className="eyebrow">SOLUTION DESIGN</span><h2>Requirements and objectives</h2></div><p>Convert business outcomes into a reviewable network structure and baseline configurations.</p></header>
            <div className="assessment-field-grid">
              <label className="wide">Client objectives<textarea required value={objectiveText} onChange={(event) => setObjectiveText(event.target.value)} placeholder="One objective per line, such as remove outages or isolate guest Wi-Fi" /></label>
              <label>Availability target<select value={requirements.availability_target} onChange={(event) => setRequirements({ ...requirements, availability_target: event.target.value as DesignRequirements["availability_target"] })}><option value="standard">Standard</option><option value="high">High availability</option><option value="mission_critical">Mission critical</option></select></label>
              <label>Budget posture<select value={requirements.budget_band} onChange={(event) => setRequirements({ ...requirements, budget_band: event.target.value as DesignRequirements["budget_band"] })}><option value="essential">Essential</option><option value="balanced">Balanced</option><option value="strategic">Strategic</option></select></label>
              <label>Forecast growth %<input type="number" min="0" max="500" value={requirements.growth_percent} onChange={(event) => setRequirements({ ...requirements, growth_percent: Number(event.target.value) })} /></label>
              <label>Remote users<input type="number" min="0" value={requirements.remote_users} onChange={(event) => setRequirements({ ...requirements, remote_users: Number(event.target.value) })} /></label>
              <label>Wireless scope<select value={requirements.wireless_scope} onChange={(event) => setRequirements({ ...requirements, wireless_scope: event.target.value as DesignRequirements["wireless_scope"] })}><option value="none">None</option><option value="office">Office</option><option value="campus">Campus</option><option value="warehouse">Warehouse</option><option value="hospitality">Hospitality</option></select></label>
              <label>Preferred vendors<input value={vendorText} onChange={(event) => setVendorText(event.target.value)} placeholder="Cisco, Fortinet, Omada" /></label>
              <label>Compliance<input value={complianceText} onChange={(event) => setComplianceText(event.target.value)} placeholder="ISO 27001, PCI DSS" /></label>
              <label>Cloud services<input value={cloudText} onChange={(event) => setCloudText(event.target.value)} placeholder="Microsoft 365, Azure, AWS" /></label>
              <label className="wide check-field"><input type="checkbox" checked={requirements.segmentation_required} onChange={(event) => setRequirements({ ...requirements, segmentation_required: event.target.checked })} /> Require network and security segmentation</label>
              <label className="wide">Constraints<textarea value={requirements.constraints} onChange={(event) => setRequirements({ ...requirements, constraints: event.target.value })} placeholder="Existing contracts, cabling, rack space, migration windows, standards" /></label>
            </div>
            <button className="audit-primary" disabled={!projectId || loading || !objectiveText.trim()}><DraftingCompass size={15} /> Generate design proposal</button>
          </form>}

          {workflow === "evaluation" && <section className="proposal-workspace">
            <header className="audit-section-heading"><div><span className="eyebrow">EVALUATION & PROPOSAL</span><h2>Client decision record</h2></div><p>Technician evidence and generated guidance must be reviewed before client approval.</p></header>
            {!evaluation && !design && <div className="proposal-empty"><FileSearch size={28} /><b>No evaluation generated yet</b><span>Complete the Client Audit and Requirements Designer to build this record.</span></div>}
            {evaluation && <div className="evaluation-banner"><div><strong>{evaluation.score}</strong><span>/ 100</span></div><section><span className={`evaluation-grade ${evaluation.grade}`}>{evaluation.grade.replace('_', ' ')}</span><h3>Infrastructure maturity evaluation</h3><p>{evaluation.gaps.length} gaps require review before implementation planning.</p></section></div>}
            {evaluation && <div className="proposal-grid"><article><h3>Strengths</h3>{evaluation.strengths.length ? <ul>{evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No mature controls recorded yet.</p>}</article><article><h3>Priority gaps</h3><ul>{evaluation.gaps.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Our recommendations</h3><ol>{evaluation.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></article></div>}
            {design && <><div className="design-narrative"><Sparkles size={18} /><div><b>Design position</b><p>{design.ai_narrative}</p></div><span>{design.ai_suggested ? 'AI assisted' : 'Rules based'}</span></div><div className="proposal-grid"><article><h3>Network architecture</h3><ul>{design.architecture.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Topology suggestion</h3><ul>{design.topology_suggestions.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Design recommendations</h3><ol>{design.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></article></div><div className="configuration-grid">{Object.entries(design.configurations).map(([name, config]) => <article key={name}><h3>{name.replace('_', ' ')}</h3><pre>{config}</pre></article>)}</div></>}
          </section>}
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
