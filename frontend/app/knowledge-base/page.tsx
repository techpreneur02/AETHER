"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  MessageCircleQuestion,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { queryHelpdesk } from "../../lib/api";
import "../globals.css";

type Guide = "user" | "admin";

type GuideSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  note?: string;
};

type HelpdeskMessage = {
  role: "assistant" | "user";
  text: string;
  sources?: string[];
};

const helpdeskPrompts = [
  "How do I run an infrastructure audit?",
  "How do I connect devices and assign ports?",
  "How do I test reachability?",
];

const userGuide: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "Sign in, choose a company project, and understand the operating workspace.",
    steps: [
      "Sign in with the account supplied by your administrator. A successful sign-in opens the Operations Console.",
      "Use the Project selector in the top bar before entering or changing infrastructure data. Every device, address, rule, and simulation belongs to the selected project.",
      "Use the left navigation for inventory modules. Use the tabs above the workspace for Topology, Device Details, Simulator, Floorplans, Imports, Config, Racks, Cameras, Power, Services, and Compliance.",
      "Confirm the VPS Engine indicator above the tabs is online before saving changes. Use the dashboard frame controls to show or hide navigation, show or hide the AI assistant, and adjust panel widths for the current screen.",
    ],
    note: "Keep one project per company or clearly bounded environment. Verify the selected project before every audit session.",
  },
  {
    id: "infrastructure-audit",
    title: "Run an infrastructure audit",
    summary: "Capture the company, locations, equipment, links, addresses, and evidence in a repeatable order.",
    steps: [
      "Open Infrastructure Audit and select the target project.",
      "Record the site and room scope first, then enter discovered devices with vendor, model, role, port count, serial or asset references, and physical location where available.",
      "Add IP allocations and map each address to its device. Record management, server, printer, wireless, guest, and user subnets separately.",
      "Add physical and logical connections. Assign the exact source port, target port, medium, and current operational status.",
      "Upload CSV, JSON, XML, TXT, LOG, or exported inventory evidence through Imports when inventory already exists. Duplicate names are skipped; review imported records before treating them as verified.",
      "Run the audit checks, resolve missing assignments, then export JSON for machine-readable backup and PDF for the client record.",
    ],
    note: "AETHER-IT records uploaded and observed data; it does not scan a private customer network from the VPS.",
  },
  {
    id: "client-assessment-design",
    title: "Assess a new client and design a solution",
    summary: "Turn discovery evidence and business objectives into a scored assessment and reviewable network proposal.",
    steps: [
      "Open Infrastructure Audit, create or select the client project, then use Client audit to record contacts, sites, users, critical services, pain points, controls, backup evidence, and maturity ratings.",
      "Save the assessment and review its score, grade, strengths, priority gaps, and deterministic engineer recommendations with the client evidence.",
      "Use Requirements designer to record objectives, availability, budget, growth, remote access, wireless scope, vendor preferences, compliance needs, cloud services, segmentation, and implementation constraints.",
      "Generate the proposal, then review the suggested architecture, topology, recommendations, AI or rules-based narrative, and baseline configurations.",
      "Validate flows, quantities, products, licensing, costs, compliance obligations, migration, rollback, and acceptance criteria before client approval or production configuration.",
    ],
    note: "Generated designs and configurations are planning baselines. A qualified engineer must validate them against current vendor documentation and the client's verified environment.",
  },
  {
    id: "topology",
    title: "Build and edit the topology",
    summary: "Place devices, assign ports, reconnect links, and keep the diagram aligned.",
    steps: [
      "Open Topology and add or select a device. Drag devices on the canvas; positions snap to the configured grid.",
      "Create a link by dragging from a device handle to another device, or use the link editor for explicit source and target selection.",
      "Select a wire to change its source device, target device, source port, target port, medium, or Up/Down state.",
      "Use Device Details to review all existing connections before assigning a port. Avoid assigning one physical port to two active links unless the real device supports that design.",
      "Use Fit View after reorganizing a large topology. Save and reload once to confirm positions and assignments persist.",
    ],
  },
  {
    id: "device-ip",
    title: "Maintain devices, ports, and IP addresses",
    summary: "Keep technical records complete enough for support and handover.",
    steps: [
      "Select a device and open Device Details to update its name, vendor, model, type, port count, and operational metadata.",
      "Review the port panel for available and assigned interfaces. Existing link and port assignments appear with the device record.",
      "Open IP Management to add an address, CIDR subnet, description, and optional device assignment.",
      "Use consistent names such as site-role-sequence and descriptions that identify VLAN or service purpose.",
      "After a change, verify the topology, address table, and exported project record all show the same result.",
    ],
  },
  {
    id: "simulation-security",
    title: "Validate paths and security policy",
    summary: "Test reachability across the recorded multi-vendor design.",
    steps: [
      "Open Simulator and choose source and destination devices.",
      "Select the protocol and destination port that represent the application flow, then run the packet trace.",
      "Read each hop with its inbound and outbound port. Delivered means a recorded path exists; Blocked identifies the matching rule and enforcement device; Unreachable means no active path exists.",
      "Open Security to create allow or deny rules. Assign an enforcement device when the policy belongs to a firewall or gateway.",
      "Set a link Down to test an outage, rerun the trace, and restore it to Up when the scenario is complete.",
    ],
    note: "The simulator validates the saved logical model. It does not replace vendor configuration testing or live packet capture.",
  },
  {
    id: "remote-operations",
    title: "Run controlled remote operations",
    summary: "Use approved diagnostics for Linux VPS, Windows Server, and cPanel targets from one page.",
    steps: [
      "Open Remote Operations and review the target toggles for Linux VPS, Windows Server, and cPanel.",
      "Only targets configured on the API server can run. Unconfigured targets return a clear message instead of attempting a connection.",
      "Choose a named diagnostic such as ping, trace route, network summary, DNS lookup, service status, logs, cPanel account summary, domains, or email accounts.",
      "Enter only the approved host, IP address, or service name required by the selected diagnostic.",
      "Review the output frame, then use the AI troubleshooting frame to summarize likely causes and safe next checks.",
    ],
    note: "Remote Operations is not a browser shell. Commands are fixed, server-side, time-limited, and administrator-gated.",
  },
  {
    id: "security-tools",
    title: "Use the Security Tools workspace",
    summary: "Check readiness and run approved security-tool workflows without opening unrestricted tooling in the browser.",
    steps: [
      "Open Security Tools to view Wireshark/tshark, Nmap, Kali Linux, Splunk, Nessus, OpenVAS, and tcpdump cards.",
      "Read each card state: RUNNING means enabled, READY means configured but globally disabled, and OFF means not configured on the API server.",
      "Run status, version, launch profile, capture plan, or Nmap host discovery actions where available and explicitly enabled.",
      "Keep scan targets limited to authorized hosts or CIDR ranges and document the approval source before running discovery.",
      "Use AI only to explain tool output and propose safe next checks; it cannot execute exploitation, evasion, credential theft, persistence, or destructive commands.",
    ],
    note: "Security tooling is disabled by default through AETHER_SECURITY_TOOLS_ENABLED=false and must be enabled only in authorized environments.",
  },
  {
    id: "reports-ai",
    title: "Use reports and the AI assistant",
    summary: "Turn current records into findings, actions, and handover material.",
    steps: [
      "Review Current State in the right assistant panel for device, link, isolation, and address totals.",
      "Use a suggested prompt or ask a project-specific question. AI responses are grounded in the selected project where indicated.",
      "Review proposed Actions before opening the related workspace. AI actions only navigate to approved product functions.",
      "Open Compliance and Reports to review gaps and project metrics, then export the final project record.",
      "Treat generated suggestions as engineering assistance. A qualified administrator remains responsible for production changes.",
    ],
  },
];

const adminGuide: GuideSection[] = [
  {
    id: "access-control",
    title: "Users and access control",
    summary: "Provision accounts carefully and review access as part of normal operations.",
    steps: [
      "Create the initial administrator through the approved registration flow, then sign in and open Members.",
      "Add or review organization members and assign only the role required for their work.",
      "Remove or downgrade access immediately when responsibilities change. Do not share administrator credentials.",
      "Require unique passwords and protect the server, repository, database, Gemini key, and JWT secret as separate credentials.",
      "Review member access quarterly and after every staff or customer handover.",
    ],
  },
  {
    id: "project-governance",
    title: "Project and data governance",
    summary: "Maintain tenant boundaries and a reliable audit trail.",
    steps: [
      "Create a separate project for each customer or isolated environment. Do not reuse one project as an unstructured global inventory.",
      "Use clear project names and descriptions that identify customer, site, and lifecycle stage.",
      "Export project JSON before bulk imports, major topology restructuring, or policy changes.",
      "Limit uploaded files to approved customer evidence and remove sensitive source files from local technician devices according to company policy.",
      "Confirm API requests remain organization and project scoped after upgrades by testing with two non-administrator accounts.",
    ],
  },
  {
    id: "operations",
    title: "Service operations and health checks",
    summary: "Check the web tier, API, database, and AI integration independently.",
    steps: [
      "Confirm the public console returns HTTP 200 and the API health endpoint reports ok.",
      "Run docker compose ps on the VPS and confirm nginx, frontend, api, and mongo are running or healthy.",
      "Review recent container logs for repeated authentication, database, upstream, or application errors.",
      "Verify storage reports mongo in production. Confirm Gemini is configured when AI responses are expected.",
      "Test sign-in, project loading, one saved topology update, one packet trace, Remote Operations target status, Security Tools catalog status, and one export after maintenance.",
    ],
    note: "A healthy page alone does not prove the API, database, simulator, and AI integration are all working.",
  },
  {
    id: "backup-restore",
    title: "Backup and restore",
    summary: "Protect the database and verify that backups can actually be recovered.",
    steps: [
      "Schedule encrypted MongoDB backups outside the application container and retain copies according to customer and legal requirements.",
      "Record the application commit, environment configuration, and database backup timestamp together for each release checkpoint.",
      "Test restoration in an isolated environment. Confirm organizations, projects, devices, links, IP allocations, rules, and member records are present.",
      "Before any production restore, stop writes, take a fresh backup, confirm the target database, and obtain change approval.",
      "Document the restore result, validation checks, operator, and recovery time.",
    ],
    note: "A restore can overwrite current data. Never run a production restore without a verified backup and explicit approval.",
  },
  {
    id: "upgrades",
    title: "Upgrade and deployment procedure",
    summary: "Promote tested releases without losing service or data.",
    steps: [
      "Review the release diff and confirm no unexpected environment, database, or volume changes are included.",
      "Run the complete backend test suite and the Next.js production build from the release commit.",
      "Back up MongoDB and record the currently deployed commit before pulling the new release on the VPS.",
      "Rebuild only the required Docker Compose services. Restart Nginx after recreating API or frontend containers so upstream addresses are refreshed.",
      "Run health checks and the functional smoke test, including /operations and /security-tools after operations releases. Keep the prior image or commit available for an application rollback; do not roll back database state casually.",
    ],
  },
  {
    id: "remote-security-enablement",
    title: "Remote and security-tool enablement",
    summary: "Enable live diagnostics only through server-side configuration and approved credentials.",
    steps: [
      "Configure Linux and Windows SSH targets with host, user, port, key path, and a verified known_hosts file mounted read-only into the API container.",
      "Configure cPanel with its server URL, username, and API token only in the VPS environment; never place those values in frontend code or chat.",
      "Keep AETHER_SECURITY_TOOLS_ENABLED=false until written authorization, scope, and maintenance window are confirmed.",
      "Use Splunk, Nessus, OpenVAS, and Kali settings as integration pointers or jump-box readiness signals until dedicated API workflows are implemented.",
      "After changing environment variables, rebuild/recreate the API service and restart Nginx without touching MongoDB or backup volumes.",
    ],
    note: "Do not enable scanners against customer networks without explicit authorization and documented scope.",
  },
  {
    id: "maintenance",
    title: "Maintenance schedule",
    summary: "Use a predictable cadence to keep records and services trustworthy.",
    steps: [
      "Daily: check service health, failed sign-ins, storage capacity, and backup completion.",
      "Weekly: review errors, unresolved audit tasks, down links, isolated devices, and stale security findings.",
      "Monthly: patch supported dependencies, review certificates and secrets, test a representative packet trace, and sample-check project exports.",
      "Quarterly: test backup restoration, review member access, reconcile infrastructure records with a physical or controller inventory, and review retention policy.",
      "Annually: rehearse disaster recovery and review the architecture, threat model, support ownership, and customer handover documents.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Isolate common failures without risking customer data.",
    steps: [
      "Empty modules or repeated sign-in redirects: sign in again and verify browser storage contains a current access token.",
      "502 response after deployment: confirm API and frontend containers are running, then restart Nginx to refresh upstream resolution.",
      "Data does not appear: verify the selected project, account organization, API response, and MongoDB health before re-entering records.",
      "Simulation is unreachable: inspect Down links, endpoint selection, disconnected nodes, and saved port assignments.",
      "AI is unavailable: verify the API health response, Gemini configuration, outbound connectivity, and API logs. Deterministic state guidance should remain available.",
      "Frontend layout issue: test at desktop and mobile widths, clear stale browser assets, and confirm the deployed frontend commit matches the release.",
    ],
  },
];

export default function KnowledgeBasePage() {
  const [guide, setGuide] = useState<Guide>("user");
  const [query, setQuery] = useState("");
  const [helpdeskOpen, setHelpdeskOpen] = useState(false);
  const [helpdeskQuery, setHelpdeskQuery] = useState("");
  const [helpdeskLoading, setHelpdeskLoading] = useState(false);
  const [helpdeskMessages, setHelpdeskMessages] = useState<HelpdeskMessage[]>([
    { role: "assistant", text: "Ask me how to use AETHER-IT. I answer from the user and administrator guides." },
  ]);
  const sections = guide === "user" ? userGuide : adminGuide;
  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sections;
    return sections.filter((section) =>
      [section.title, section.summary, section.note, ...section.steps]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [query, sections]);

  async function askHelpdesk(question: string) {
    const trimmed = question.trim();
    if (!trimmed || helpdeskLoading) return;
    setHelpdeskOpen(true);
    setHelpdeskQuery("");
    setHelpdeskMessages((messages) => [...messages, { role: "user", text: trimmed }]);
    setHelpdeskLoading(true);
    try {
      const token = localStorage.getItem("aether_access_token");
      if (!token) throw new Error("AUTH_REQUIRED");
      const response = await queryHelpdesk(token, trimmed);
      setHelpdeskMessages((messages) => [...messages, { role: "assistant", text: response.answer, sources: response.sources }]);
    } catch (error) {
      const message = error instanceof Error && error.message === "AUTH_REQUIRED"
        ? "Your session has expired. Sign in again to use the AI helpdesk."
        : "The helpdesk could not answer right now. You can still search and browse the guides on this page.";
      setHelpdeskMessages((messages) => [...messages, { role: "assistant", text: message }]);
    } finally {
      setHelpdeskLoading(false);
    }
  }

  function submitHelpdesk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askHelpdesk(helpdeskQuery);
  }

  function openSource(source: string) {
    const userSection = userGuide.find((section) => section.title === source);
    const adminSection = adminGuide.find((section) => section.title === source);
    const section = userSection ?? adminSection;
    if (!section) return;
    setGuide(userSection ? "user" : "admin");
    window.setTimeout(() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <main className="knowledge-shell">
      <header className="knowledge-header">
        <a href="/" className="knowledge-back"><ArrowLeft size={16} /> Operations Console</a>
        <div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Knowledge Base</span></div></div>
        <span className="knowledge-version">GUIDE 1.0</span>
      </header>
      <section className="knowledge-hero">
        <div><span className="eyebrow">DOCUMENTATION / OPERATIONS</span><h1>Knowledge Base</h1><p>Operational instructions for infrastructure auditors, users, and platform administrators.</p></div>
        <div className="knowledge-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search procedures, features, or troubleshooting..." aria-label="Search documentation" /></div>
      </section>
      <div className="knowledge-layout">
        <aside className="knowledge-nav" aria-label="Guide navigation">
          <div className="guide-switch" role="tablist" aria-label="Guide type">
            <button className={guide === "user" ? "selected" : ""} onClick={() => setGuide("user")}><UserRound size={15} /> User Guide</button>
            <button className={guide === "admin" ? "selected" : ""} onClick={() => setGuide("admin")}><ShieldCheck size={15} /> Admin Guide</button>
          </div>
          <span className="knowledge-nav-label">IN THIS GUIDE</span>
          {sections.map((section) => <a key={section.id} href={`#${section.id}`}><ChevronRight size={13} /> {section.title}</a>)}
          <div className="knowledge-support"><Wrench size={16} /><div><b>Maintenance record</b><span>Document operator, date, project, change, result, and rollback reference.</span></div></div>
        </aside>
        <article className="knowledge-content">
          <div className="knowledge-intro"><BookOpen size={22} /><div><span>{guide === "user" ? "USER GUIDE" : "ADMINISTRATOR GUIDE"}</span><h2>{guide === "user" ? "Operate and document infrastructure" : "Administer and maintain AETHER-IT"}</h2></div></div>
          {visibleSections.length ? visibleSections.map((section, index) => (
            <section className="guide-section" id={section.id} key={section.id}>
              <div className="guide-section-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="guide-section-body"><h3>{section.title}</h3><p className="guide-summary">{section.summary}</p><ol>{section.steps.map((step) => <li key={step}><CheckCircle2 size={15} /><span>{step}</span></li>)}</ol>{section.note && <div className="guide-note"><b>Important</b><span>{section.note}</span></div>}</div>
            </section>
          )) : <div className="knowledge-empty"><Search size={22} /><b>No matching guidance</b><span>Try a device, workflow, maintenance, or troubleshooting term.</span></div>}
        </article>
      </div>
      {helpdeskOpen && (
        <aside className="helpdesk-panel" aria-label="AI knowledge base helpdesk">
          <header className="helpdesk-header">
            <div className="helpdesk-identity"><span><Bot size={18} /></span><div><b>AI Helpdesk</b><small>Guide-grounded assistance</small></div></div>
            <button onClick={() => setHelpdeskOpen(false)} aria-label="Close AI helpdesk" title="Close helpdesk"><X size={18} /></button>
          </header>
          <div className="helpdesk-messages" aria-live="polite">
            {helpdeskMessages.map((message, index) => (
              <div className={`helpdesk-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "assistant" ? "AETHER AI" : "YOU"}</span>
                <p>{message.text}</p>
                {!!message.sources?.length && <div className="helpdesk-sources">{message.sources.map((source) => <button key={source} onClick={() => openSource(source)}>{source}</button>)}</div>}
              </div>
            ))}
            {helpdeskLoading && <div className="helpdesk-thinking"><LoaderCircle size={15} /> Checking the guide...</div>}
          </div>
          {helpdeskMessages.length === 1 && <div className="helpdesk-prompts">{helpdeskPrompts.map((prompt) => <button key={prompt} onClick={() => void askHelpdesk(prompt)}>{prompt}</button>)}</div>}
          <form className="helpdesk-form" onSubmit={submitHelpdesk}>
            <textarea value={helpdeskQuery} onChange={(event) => setHelpdeskQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask how to use AETHER-IT..." aria-label="Question for AI helpdesk" rows={2} maxLength={1000} />
            <button type="submit" disabled={!helpdeskQuery.trim() || helpdeskLoading} aria-label="Send question" title="Send question"><Send size={17} /></button>
          </form>
        </aside>
      )}
      {!helpdeskOpen && <button className="helpdesk-launcher" onClick={() => setHelpdeskOpen(true)} aria-label="Open AI helpdesk"><MessageCircleQuestion size={21} /><span>AI Helpdesk</span></button>}
    </main>
  );
}