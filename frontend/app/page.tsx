"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { Connection } from "@xyflow/react";
import {
  Activity,
  Bell,
  Box,
  Cable,
  Camera,
  Check,
  ChevronDown,
  CircleDot,
  Cpu,
  Database,
  Eye,
  FileCheck2,
  FileCode2,
  FileDown,
  Gauge,
  GitBranch,
  Layers3,
  Lightbulb,
  ListTodo,
  LockKeyhole,
  Menu,
  Network,
  PanelRight,
  Play,
  Plus,
  Router,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import {
  createDevice,
  createLink,
  createProject,
  deleteLink,
  updateLink,
  exportProjectJson,
  exportProjectPdf,
  getTopology,
  listProjects,
  queryProjectAI,
  saveTopology,
  updateDevicePosition,
  type AIQueryResponse,
  type Project,
  type Topology,
} from "../lib/api";
import TopologyFlow from "../components/TopologyFlow";

const navigation = [
  ["Dashboard", Gauge],
  ["Projects", Box],
  ["Topology", Network],
  ["Floorplans", Layers3],
  ["Devices", Server],
  ["IP Management", GitBranch],
  ["Cabling", Cable],
  ["Wireless", Wifi],
  ["Security", LockKeyhole],
  ["Cameras", Camera],
  ["Power", Zap],
  ["Racks", Database],
  ["Automation", SquareTerminal],
  ["Infrastructure Audit", FileCheck2],
  ["Compliance", ShieldCheck],
  ["Reports", FileCheck2],
  ["Tasks", ListTodo],
] as const;

const navigationRoutes: Record<string, string> = {
  Dashboard: "/",
  Projects: "/",
  Topology: "/",
  Floorplans: "/floorplans",
  Devices: "/devices",
  "IP Management": "/ip-management",
  Cabling: "/cabling",
  Wireless: "/wireless",
  Cameras: "/cameras",
  Racks: "/racks",
  Security: "/security",
  Power: "/power",
  Tasks: "/tasks",
  Compliance: "/compliance",
  Automation: "/config",
  "Infrastructure Audit": "/audit",
  Reports: "/reports",
  Services: "/services",
};

const nodes = [
  {
    id: "edge",
    label: "INTERNET",
    meta: "Spectrum Business",
    type: "cloud",
    x: "49%",
    y: "10%",
  },
  {
    id: "firewall",
    label: "FortiGate 100F",
    meta: "10.10.0.1",
    type: "firewall",
    x: "49%",
    y: "25%",
  },
  {
    id: "core",
    label: "Cisco Catalyst 9500",
    meta: "Core Switch  /  10.10.0.2",
    type: "core",
    x: "49%",
    y: "43%",
  },
  {
    id: "server",
    label: "Windows Server 2022",
    meta: "AD / DNS / DHCP  10.10.0.10",
    type: "server",
    x: "75%",
    y: "31%",
  },
  {
    id: "access1",
    label: "Access Switch 1",
    meta: "1st Floor  /  10.10.1.1",
    type: "switch",
    x: "25%",
    y: "64%",
  },
  {
    id: "access2",
    label: "Access Switch 2",
    meta: "2nd Floor  /  10.10.2.1",
    type: "switch",
    x: "50%",
    y: "64%",
  },
  {
    id: "access3",
    label: "Access Switch 3",
    meta: "3rd Floor  /  10.10.3.1",
    type: "switch",
    x: "75%",
    y: "64%",
  },
];

const fallbackTopology: Topology = {
  nodes: nodes.map((node) => ({
    id: node.id,
    name: node.label,
    kind: node.type === "server" ? "service" : "device",
  })),
  links: [
    { source: "edge", target: "firewall", medium: "ethernet" },
    { source: "firewall", target: "core", medium: "ethernet" },
    { source: "core", target: "server", medium: "ethernet" },
    { source: "core", target: "access1", medium: "fiber" },
    { source: "core", target: "access2", medium: "fiber" },
    { source: "core", target: "access3", medium: "fiber" },
  ],
};

const legendItems: [LucideIcon, string][] = [
  [Router, "Router"],
  [Router, "Switch"],
  [ShieldCheck, "Firewall"],
  [Wifi, "Wireless AP"],
  [Server, "Server"],
  [Camera, "Camera"],
  [Cable, "Fiber Link"],
  [Cable, "Copper Link"],
];

function NodeGlyph({ type }: { type: string }) {
  if (type === "cloud") return <Network size={20} />;
  if (type === "firewall") return <ShieldCheck size={20} />;
  if (type === "server") return <Server size={20} />;
  return <Router size={20} />;
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Topology");
  const [activeStage, setActiveStage] = useState("TOPOLOGY");
  const [selectedNode, setSelectedNode] = useState("core");
  const [isLive, setIsLive] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoadError, setProjectLoadError] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deviceKind, setDeviceKind] = useState<"device" | "site" | "service">(
    "device",
  );
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkSource, setLinkSource] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkMedium, setLinkMedium] = useState<
    "fiber" | "ethernet" | "wireless"
  >("ethernet");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkSourcePort, setLinkSourcePort] = useState("");
  const [linkTargetPort, setLinkTargetPort] = useState("");
  const [selectedLink, setSelectedLink] = useState<Topology["links"][number] | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<AIQueryResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [topology, setTopology] = useState<Topology | null>(null);
  const [topologyLoadError, setTopologyLoadError] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const [zoom, setZoom] = useState(100);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "device" | "site" | "service"
  >("all");
  const [enabledLayers, setEnabledLayers] = useState<string[]>([
    "L1 Physical / Fiber",
    "L2 Network",
    "L3 IP / Routing",
    "L4 Transport",
    "L5 Session",
    "L6 Presentation",
    "L7 Application",
  ]);
  const [detailTab, setDetailTab] = useState<
    "overview" | "ports" | "config" | "vulnerabilities"
  >("overview");
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [alertTab, setAlertTab] = useState<"alerts" | "tasks" | "logs">(
    "alerts",
  );
  const [cameraPlaying, setCameraPlaying] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("AETHER-IT project console ready.");
  const [canvasMode, setCanvasMode] = useState<"map" | "focus">("map");
  const [statusFilter, setStatusFilter] = useState<"all" | "online">("all");
  const [siteFilter, setSiteFilter] = useState<"all" | "sites">("all");
  const [legendFilter, setLegendFilter] = useState("all");

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    listProjects(token)
      .then((loadedProjects) => {
        setProjects(loadedProjects);
        setActiveProjectId(loadedProjects[0]?.id ?? "");
      })
      .catch((error) => {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          window.localStorage.removeItem("aether_access_token");
          window.location.replace("/login");
          return;
        }
        setProjectLoadError(true);
        setControlMessage("Unable to load projects. Check the API connection.");
      });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId) return;
    setTopologyLoadError(false);
    getTopology(token, activeProjectId)
      .then(setTopology)
      .catch(() => setTopologyLoadError(true));
  }, [activeProjectId]);

  useEffect(() => {
    function focusAI(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.getElementById("ai-command")?.focus();
      }
    }
    window.addEventListener("keydown", focusAI);
    return () => window.removeEventListener("keydown", focusAI);
  }, []);

  const activeProject =
    projects.find((project) => project.id === activeProjectId)?.name ??
    projects[0]?.name ??
    "SkyRise Corporate HQ";
  const allVisibleNodes = topology?.nodes.length
    ? topology.nodes.map((node, index) => ({
        id: node.id,
        label: node.name,
        meta: `${node.kind} · project device`,
        type:
          node.kind === "service" ? "server" : index === 0 ? "core" : "switch",
        x: `${25 + (index % 3) * 25}%`,
        y: `${28 + Math.floor(index / 3) * 24}%`,
      }))
    : nodes;
  const visibleNodes = allVisibleNodes.filter(
    (node) =>
      (typeFilter === "all" || node.meta.startsWith(typeFilter)) &&
      (siteFilter === "all" || node.meta.startsWith("site")) &&
      (statusFilter === "all" || isLive) &&
      (!deviceSearch.trim() ||
        `${node.label} ${node.meta}`
          .toLowerCase()
          .includes(deviceSearch.trim().toLowerCase())),
  );
  const sourceTopology = topology?.nodes.length ? topology : fallbackTopology;
  const filteredNodeIds = new Set(
    sourceTopology.nodes
      .filter((node) => {
        const matchesType = typeFilter === "all" || node.kind === typeFilter;
        const matchesSite = siteFilter === "all" || node.kind === "site";
        const matchesSearch =
          !deviceSearch.trim() ||
          node.name.toLowerCase().includes(deviceSearch.trim().toLowerCase());
        const matchesLegend =
          legendFilter === "all" ||
          (legendFilter === "server" && node.kind === "service") ||
          (legendFilter === "camera" && /camera|cctv|video/i.test(node.name)) ||
          (legendFilter === "wireless" &&
            /wireless|access point|\bap\b/i.test(node.name)) ||
          (legendFilter === "firewall" &&
            /firewall|fortigate/i.test(node.name)) ||
          (legendFilter === "router" && /router|switch|core/i.test(node.name));
        return matchesType && matchesSite && matchesSearch && matchesLegend;
      })
      .map((node) => node.id),
  );
  const filteredTopology: Topology = {
    nodes: sourceTopology.nodes.filter((node) => filteredNodeIds.has(node.id)),
    links: sourceTopology.links.filter(
      (link) =>
        filteredNodeIds.has(link.source) &&
        filteredNodeIds.has(link.target) &&
        enabledLayers.some(
          (layer) =>
            (layer === "L1 Physical / Fiber" && link.medium === "fiber") ||
            (layer === "L2 Network" && link.medium === "ethernet") ||
            (layer === "L3 IP / Routing" && link.medium === "ethernet"),
        ),
    ),
  };

  function acknowledgeControl(label: string) {
    if (label === "Auto-layout complete") {
      setSelectedNode(visibleNodes[0]?.id ?? "");
      setZoom(100);
      setControlMessage("Auto-layout applied and view reset");
      return;
    }
    if (label === "Canvas mode") {
      setCanvasMode((current) => (current === "map" ? "focus" : "map"));
      setControlMessage(
        canvasMode === "map" ? "Focus mode enabled" : "Map mode enabled",
      );
      return;
    }
    setControlMessage(`${label} selected`);
  }

  function openModule(label: string) {
    setActiveNav(label);
    setActiveStage(label.toUpperCase());
  }

  function toggleLayer(layer: string) {
    setEnabledLayers((current) =>
      current.includes(layer)
        ? current.filter((item) => item !== layer)
        : [...current, layer],
    );
  }

  function resetFilters() {
    setDeviceSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSiteFilter("all");
    setLegendFilter("all");
  }

  function resetView() {
    setZoom(100);
    setControlMessage("Topology view reset");
  }

  async function submitProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    if (!projectName.trim()) return;
    setProjectSaving(true);
    try {
      const project = await createProject(token, {
        name: projectName.trim(),
        description: projectDescription.trim(),
      });
      setProjects((current) => [project, ...current]);
      setActiveProjectId(project.id);
      setProjectName("");
      setProjectDescription("");
      setShowProjectForm(false);
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        window.localStorage.removeItem("aether_access_token");
        window.location.replace("/login");
        return;
      }
      setControlMessage(
        error instanceof Error ? error.message : "Unable to create project",
      );
    } finally {
      setProjectSaving(false);
    }
  }

  async function submitDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    if (!activeProjectId || !deviceName.trim()) return;
    setDeviceSaving(true);
    try {
      await createDevice(token, activeProjectId, {
        name: deviceName.trim(),
        kind: deviceKind,
      });
      setTopology(await getTopology(token, activeProjectId));
      setDeviceName("");
      setShowDeviceForm(false);
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to create device",
      );
    } finally {
      setDeviceSaving(false);
    }
  }

  async function submitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    if (
      !activeProjectId ||
      !linkSource ||
      !linkTarget ||
      linkSource === linkTarget
    )
      return;
    setLinkSaving(true);
    try {
      setTopology(
        await createLink(token, activeProjectId, {
          source: linkSource,
          target: linkTarget,
          medium: linkMedium,
          source_port: linkSourcePort || undefined,
          target_port: linkTargetPort || undefined,
        }),
      );
      setShowLinkForm(false);
      setLinkSourcePort("");
      setLinkTargetPort("");
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to create link",
      );
    } finally {
      setLinkSaving(false);
    }
  }

  async function connectTopologyNodes(connection: Connection) {
    const token = window.localStorage.getItem("aether_access_token");
    if (
      !token ||
      !activeProjectId ||
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return;
    try {
      setTopology(
        await createLink(token, activeProjectId, {
          source: connection.source,
          target: connection.target,
          medium: linkMedium,
        }),
      );
      setControlMessage(`${linkMedium} link created`);
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to create link",
      );
    }
  }

  async function persistNodePosition(node: {
    id: string;
    position: { x: number; y: number };
  }) {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId) return;
    try {
      setTopology(
        await updateDevicePosition(token, activeProjectId, node.id, {
          floorplan_x: Math.max(0, Math.min(1, node.position.x / 1000)),
          floorplan_y: Math.max(0, Math.min(1, node.position.y / 700)),
        }),
      );
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to save node position",
      );
    }
  }

  function selectTopologyEdge(edgeId: string) {
    const index = Number(edgeId.replace("edge-", ""));
    const link = topology?.links[index];
    if (!link) return;
    setSelectedLink(link);
    setLinkMedium(link.medium);
    setLinkSourcePort(link.source_port ?? "");
    setLinkTargetPort(link.target_port ?? "");
  }

  async function saveSelectedLink() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedLink) return;
    try {
      setTopology(await updateLink(token, activeProjectId, selectedLink.source, selectedLink.target, {
        medium: linkMedium,
        source_port: linkSourcePort || undefined,
        target_port: linkTargetPort || undefined,
      }));
      setSelectedLink(null);
      setControlMessage("Connection details saved");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Unable to update link");
    }
  }

  async function removeSelectedLink() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedLink) return;
    try {
      setTopology(await deleteLink(token, activeProjectId, selectedLink.source, selectedLink.target));
      setSelectedLink(null);
      setControlMessage("Link deleted");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Unable to delete link");
    }
  }

  async function loadDemoTopology() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    if (!activeProjectId) {
      setControlMessage("Select or create a project first");
      return;
    }
    try {
      setTopology(await saveTopology(token, activeProjectId, fallbackTopology));
      setControlMessage(
        "Demo topology saved to this project; AI can now analyze it",
      );
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        window.localStorage.removeItem("aether_access_token");
        window.location.replace("/login");
        return;
      }
      setControlMessage(
        error instanceof Error ? error.message : "Unable to save demo topology",
      );
    }
  }

  async function exportProject() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId) return;
    const blob = await exportProjectJson(token, activeProjectId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeProject.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-as-built.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportProjectPdfFile() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId) return;
    const blob = await exportProjectPdf(token, activeProjectId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeProject.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-as-built.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitAIQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    if (!activeProjectId || !aiQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      setAiResponse(
        await queryProjectAI(token, activeProjectId, aiQuery.trim()),
      );
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI query failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="console-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>AETHER-IT</strong>
            <span>Autonomous Topology Engine</span>
          </div>
        </div>
        <label className="project-picker">
          Project:{" "}
          <select
            value={activeProjectId}
            onChange={(event) => setActiveProjectId(event.target.value)}
          >
            <option value="">{activeProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projectLoadError && (
            <span className="project-sync-error">sync pending</span>
          )}
          <ChevronDown size={14} />
        </label>
        <div className="top-actions">
          <div className="health">
            <span className="pulse" /> SYSTEM HEALTH <b>100%</b>
          </div>
          <button
            className="icon-action"
            title="Search"
            onClick={() => document.getElementById("device-search")?.focus()}
          >
            <Search size={18} />
          </button>
          <button
            className="icon-action"
            title="Terminal"
            onClick={() => setShowTerminal((current) => !current)}
          >
            <SquareTerminal size={18} />
          </button>
          <button
            className="notification icon-action"
            title="Notifications"
            onClick={() => setShowNotifications((current) => !current)}
          >
            <Bell size={18} />
            <i>3</i>
          </button>
          <button
            className="icon-action"
            title="Settings"
            onClick={() => setShowSettings((current) => !current)}
          >
            <Settings size={18} />
          </button>
          <button
            className="avatar"
            title="Account"
            onClick={() => window.location.assign("/members")}
          >
            SA
          </button>
          <span className="user-name">Sherwin Armas</span>
          <ChevronDown size={13} />
        </div>
      </header>
      {showTerminal && <section className="ops-popover terminal-popover"><div className="panel-heading"><b>PROJECT TERMINAL</b><button className="panel-icon" onClick={() => setShowTerminal(false)}><X size={13} /></button></div><form onSubmit={(event) => { event.preventDefault(); setTerminalOutput(terminalCommand.trim() ? `Command queued for project review: ${terminalCommand.trim()}` : "Enter a project command to continue."); setTerminalCommand(""); }}><input value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} placeholder="Describe a safe project action..." /><button>Run</button></form><pre>{terminalOutput}</pre></section>}
      {showNotifications && <section className="ops-popover notifications-popover"><div className="panel-heading"><b>NOTIFICATIONS</b><button className="panel-icon" onClick={() => setShowNotifications(false)}><X size={13} /></button></div><button onClick={() => setControlMessage("Disk usage alert acknowledged")}>Critical · Disk usage is above 90%</button><button onClick={() => setControlMessage("PoE alert acknowledged")}>Warning · PoE power usage above 80%</button><button onClick={() => setControlMessage("Firmware reminder acknowledged")}>Info · Firmware update available</button></section>}
      {showSettings && <section className="ops-popover settings-popover"><div className="panel-heading"><b>CONSOLE SETTINGS</b><button className="panel-icon" onClick={() => setShowSettings(false)}><X size={13} /></button></div><label><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /> Compact operations layout</label><a href="/config">Open configuration workspace</a></section>}
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-section-label">OPERATIONS</div>
          {navigation.map(([label, Icon]) =>
            navigationRoutes[label] ? (
              <a
                key={label}
                href={navigationRoutes[label]}
                className={`nav-item nav-link ${activeNav === label ? "active" : ""}`}
                onClick={() => {
                  setActiveNav(label);
                  setActiveStage("TOPOLOGY");
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
              </a>
            ) : (
              <button
                key={label}
                onClick={() => openModule(label)}
                className={`nav-item ${activeNav === label ? "active" : ""}`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ),
          )}
          <a className="nav-item nav-link" href="/imports">
            <FileDown size={15} />
            <span>Imports</span>
          </a>
          <a className="nav-item nav-link" href="/config">
            <FileCode2 size={15} />
            <span>Config Review</span>
          </a>
          <a className="nav-item nav-link" href="/members">
            <Users size={15} />
            <span>Members</span>
          </a>
          <div className="engine-status">
            <span className="pulse" />
            <div>
              <b>VPS ENGINE</b>
              <small>
                {isLive ? "Online · Simulator" : "Paused · Simulator"}
              </small>
            </div>
          </div>
        </aside>
        <section className="main-stage">
          <div className="stage-tabs">
            <button
              className={activeStage === "TOPOLOGY" ? "selected" : ""}
              onClick={() => setActiveStage("TOPOLOGY")}
            >
              <Network size={14} /> TOPOLOGY
            </button>
            <a className="stage-link" href="/floorplans">
              <Layers3 size={14} /> FLOORPLANS
            </a>
            <a className="stage-link" href="/imports">
              <FileDown size={14} /> IMPORTS
            </a>
            <a className="stage-link" href="/config">
              <FileCode2 size={14} /> CONFIG
            </a>
            <a className="stage-link" href="/racks">
              <Box size={14} /> RACKS
            </a>
            <a className="stage-link" href="/cameras">
              <Camera size={14} /> CAMERAS
            </a>
            <a className="stage-link" href="/power">
              <Zap size={14} /> POWER
            </a>
            <a className="stage-link" href="/services">
              <Server size={14} /> SERVICES
            </a>
            <a className="stage-link" href="/compliance">
              <ShieldCheck size={14} /> COMPLIANCE
            </a>
            <button onClick={exportProject}>
              <FileCheck2 size={14} /> JSON
            </button>
            <button onClick={exportProjectPdfFile}>
              <FileCheck2 size={14} /> PDF
            </button>
          </div>
          {activeStage !== "TOPOLOGY" ? (
            <div className="module-placeholder panel">
              <Cpu size={34} />
              <h2>
                {activeStage.charAt(0) + activeStage.slice(1).toLowerCase()}{" "}
                module
              </h2>
              <p>
                This section is not built yet. Topology, Floorplans, Imports,
                Config Review, and Members are fully functional.
              </p>
              <button
                onClick={() => {
                  setActiveStage("TOPOLOGY");
                  setActiveNav("Topology");
                }}
              >
                <Network size={14} /> Back to Topology
              </button>
            </div>
          ) : (
            <>
              <div className="stage-toolbar">
                <div>
                  <span className="eyebrow">TOPOLOGY / LIVE MAP</span>
                  <h1>Infrastructure topology</h1>
                  <span className="topology-summary">
                    {topologyLoadError
                      ? "Topology unavailable"
                      : `${topology?.nodes.length ?? 0} devices · ${topology?.links.length ?? 0} links`}
                  </span>
                </div>
                <div className="toolbar-actions">
                  {!topology?.nodes.length && (
                    <button onClick={loadDemoTopology}>
                      <Database size={14} /> Load demo
                    </button>
                  )}
                  <button onClick={() => setIsLive(!isLive)}>
                    <CircleDot size={14} /> {isLive ? "Live" : "Paused"}
                  </button>
                  <button
                    onClick={() => setShowProjectForm((current) => !current)}
                  >
                    <Plus size={14} /> Project
                  </button>
                  <button
                    onClick={() => setShowDeviceForm((current) => !current)}
                  >
                    <Plus size={14} /> Device
                  </button>
                  <button
                    onClick={() => setShowLinkForm((current) => !current)}
                  >
                    <Plus size={14} /> Link
                  </button>
                  <select
                    value={linkMedium}
                    onChange={(event) =>
                      setLinkMedium(event.target.value as typeof linkMedium)
                    }
                    aria-label="Graph link medium"
                  >
                    <option value="ethernet">Ethernet</option>
                    <option value="fiber">Fiber</option>
                    <option value="wireless">Wireless</option>
                  </select>
                  <button
                    onClick={() => acknowledgeControl("Auto-layout complete")}
                  >
                    <Sparkles size={14} /> Auto-layout
                  </button>
                  <button onClick={resetView}>
                    <Eye size={14} /> View
                  </button>
                </div>
              </div>
              {showProjectForm && (
                <form className="project-form" onSubmit={submitProject}>
                  <input
                    required
                    autoFocus
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                  />
                  <input
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(event.target.value)
                    }
                    placeholder="Description (optional)"
                  />
                  <button disabled={projectSaving}>
                    {projectSaving ? "Saving..." : "Create project"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                  >
                    Cancel
                  </button>
                </form>
              )}
              {showDeviceForm && (
                <form className="project-form" onSubmit={submitDevice}>
                  <input
                    required
                    autoFocus
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    placeholder="Device name"
                  />
                  <select
                    value={deviceKind}
                    onChange={(event) =>
                      setDeviceKind(event.target.value as typeof deviceKind)
                    }
                  >
                    <option value="device">Device</option>
                    <option value="site">Site</option>
                    <option value="service">Service</option>
                  </select>
                  <button disabled={deviceSaving || !activeProjectId}>
                    {deviceSaving ? "Saving..." : "Create device"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeviceForm(false)}
                  >
                    Cancel
                  </button>
                </form>
              )}
              {showLinkForm && (
                <form className="project-form" onSubmit={submitLink}>
                  <select
                    required
                    value={linkSource}
                    onChange={(event) => setLinkSource(event.target.value)}
                  >
                    <option value="">Source device</option>
                    {(topology?.nodes ?? []).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={linkTarget}
                    onChange={(event) => setLinkTarget(event.target.value)}
                  >
                    <option value="">Target device</option>
                    {(topology?.nodes ?? []).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={linkMedium}
                    onChange={(event) =>
                      setLinkMedium(event.target.value as typeof linkMedium)
                    }
                  >
                    <option value="ethernet">Ethernet</option>
                    <option value="fiber">Fiber</option>
                    <option value="wireless">Wireless</option>
                  </select>
                  <input placeholder="Source port e.g. Gi1/0/1" value={linkSourcePort} onChange={(event) => setLinkSourcePort(event.target.value)} />
                  <input placeholder="Target port e.g. Gi1/0/24" value={linkTargetPort} onChange={(event) => setLinkTargetPort(event.target.value)} />
                  <button disabled={linkSaving || !activeProjectId}>
                    {linkSaving ? "Saving..." : "Create link"}
                  </button>
                  <button type="button" onClick={() => setShowLinkForm(false)}>
                    Cancel
                  </button>
                </form>
              )}
              {selectedLink && (
                <div className="project-form link-editor">
                  <b>Connection details</b>
                  <span>{selectedLink.source} to {selectedLink.target}</span>
                  <select value={linkMedium} onChange={(event) => setLinkMedium(event.target.value as typeof linkMedium)}>
                    <option value="ethernet">Ethernet</option>
                    <option value="fiber">Fiber</option>
                    <option value="wireless">Wireless</option>
                  </select>
                  <input aria-label="Source port" placeholder="Source port" value={linkSourcePort} onChange={(event) => setLinkSourcePort(event.target.value)} />
                  <input aria-label="Target port" placeholder="Target port" value={linkTargetPort} onChange={(event) => setLinkTargetPort(event.target.value)} />
                  <button type="button" onClick={saveSelectedLink}>Save connection</button>
                  <button type="button" onClick={removeSelectedLink}>Delete connection</button>
                  <button type="button" onClick={() => setSelectedLink(null)}>Close</button>
                </div>
              )}
              <div className="content-grid">
                <div className="left-stack">
                  <div className="layers-panel panel">
                    <div className="panel-heading">
                      <b>TOPOLOGY LAYERS</b>
                      <ChevronDown size={14} />
                    </div>
                    {[
                      "L1 Physical / Fiber",
                      "L2 Network",
                      "L3 IP / Routing",
                      "L4 Transport",
                      "L5 Session",
                      "L6 Presentation",
                      "L7 Application",
                    ].map((item, index) => (
                      <button
                        className={`layer-row ${enabledLayers.includes(item) ? "selected" : ""}`}
                        key={item}
                        onClick={() => toggleLayer(item)}
                      >
                        <span className={`layer-dot dot-${index}`} />
                        <span>{item}</span>
                        <Eye size={12} />
                      </button>
                    ))}
                    <div className="panel-heading filter-heading">
                      <b>FILTERS</b>
                      <button
                        className="panel-icon"
                        onClick={resetFilters}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <label className="search-input">
                      <Search size={13} />
                      <input
                        id="device-search"
                        value={deviceSearch}
                        onChange={(event) =>
                          setDeviceSearch(event.target.value)
                        }
                        placeholder="Search devices..."
                      />
                    </label>
                    <div className="filter-pair">
                      <select
                        value={typeFilter}
                        onChange={(event) =>
                          setTypeFilter(event.target.value as typeof typeFilter)
                        }
                      >
                        <option value="all">All types</option>
                        <option value="device">Devices</option>
                        <option value="site">Sites</option>
                        <option value="service">Services</option>
                      </select>
                      <button
                        onClick={() =>
                          setControlMessage(
                            "Vendor data is available on the Devices page",
                          )
                        }
                      >
                        Vendor <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="filter-pair">
                      <button
                        onClick={() => setStatusFilter((current) => current === "all" ? "online" : "all")}
                      >
                        Status: {statusFilter === "all" ? "All" : "Online"} <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={() => setSiteFilter((current) => current === "all" ? "sites" : "all")}
                      >
                        Site: {siteFilter === "all" ? "All" : "Sites"} <ChevronDown size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="legend panel">
                    <div className="panel-heading">
                      <b>LEGEND</b>
                      <button
                        className="panel-icon"
                        onClick={() => setLegendFilter("all")}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    {legendItems.map(([Icon, label], index) => {
                      const filter =
                        label === "Server"
                          ? "server"
                          : label === "Camera"
                            ? "camera"
                            : label === "Wireless AP"
                              ? "wireless"
                              : label === "Firewall"
                                ? "firewall"
                                : label === "Router" || label === "Switch"
                                  ? "router"
                                  : "all";
                      return (
                        <button
                          className={`legend-row ${legendFilter === filter ? "selected" : ""}`}
                          key={`${label}-${index}`}
                          onClick={() => setLegendFilter(filter)}
                        >
                          <Icon size={12} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={`topology-canvas panel canvas-${canvasMode}`}>
                  <TopologyFlow
                    topology={filteredTopology}
                    selectedNodeId={selectedNode}
                    onNodeClick={setSelectedNode}
                    onConnect={connectTopologyNodes}
                    onNodeDragStop={persistNodePosition}
                    onEdgeClick={selectTopologyEdge}
                  />
                </div>
                <aside className="details panel">
                  <div className="details-title">
                    <div>
                      <span className="eyebrow">DEVICE DETAILS</span>
                      <h2>
                        {visibleNodes.find((node) => node.id === selectedNode)
                          ?.label ?? "Select a device"}
                      </h2>
                    </div>
                    <X size={15} />
                  </div>
                  <div className="device-preview">
                    <div className="rack-icon">
                      <Router size={26} />
                    </div>
                    <div>
                      <b>Infrastructure asset</b>
                      <small>
                        <span className="online-dot" /> Online
                      </small>
                    </div>
                  </div>
                  <div className="detail-tabs">
                    {[
                      ["overview", "OVERVIEW"],
                      ["ports", "PORTS"],
                      ["config", "CONFIG"],
                      ["vulnerabilities", "VULNERABILITIES"],
                    ].map(([key, label]) => (
                      <button
                        className={detailTab === key ? "selected" : ""}
                        key={key}
                        onClick={() => setDetailTab(key as typeof detailTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {detailTab === "overview" && (
                    <dl className="spec-list">
                      <div>
                        <dt>Project state</dt>
                        <dd>{topology ? "API-backed" : "Demo seed"}</dd>
                      </div>
                      <div>
                        <dt>Node count</dt>
                        <dd>{visibleNodes.length}</dd>
                      </div>
                      <div>
                        <dt>Graph links</dt>
                        <dd>{topology?.links.length ?? 0}</dd>
                      </div>
                    </dl>
                  )}
                  {detailTab === "ports" && (
                    <div className="detail-message">
                      <b>Port inventory</b>
                      <span>
                        Port-level data will appear when imported from device
                        discovery.
                      </span>
                    </div>
                  )}
                  {detailTab === "config" && (
                    <div className="detail-message">
                      <b>Configuration</b>
                      <span>
                        Use Config Review to generate a Safe Mode preview for
                        this project.
                      </span>
                      <a href="/config">Open Config Review</a>
                    </div>
                  )}
                  {detailTab === "vulnerabilities" && (
                    <div className="detail-message">
                      <b>Vulnerability review</b>
                      <span>
                        No vulnerability feed is connected. Imported asset state
                        remains visible above.
                      </span>
                    </div>
                  )}
                  <div className="resource-section">
                    <span className="eyebrow">RESOURCE UTILIZATION</span>
                    <div className="metric">
                      <div>
                        <span>CPU Usage</span>
                        <b>18%</b>
                      </div>
                      <div className="meter">
                        <i style={{ width: "18%" }} />
                      </div>
                    </div>
                    <div className="metric">
                      <div>
                        <span>Memory Usage</span>
                        <b>32%</b>
                      </div>
                      <div className="meter">
                        <i style={{ width: "32%" }} />
                      </div>
                    </div>
                    <div className="metric">
                      <div>
                        <span>PoE Power Usage</span>
                        <b>420W / 740W</b>
                      </div>
                      <div className="meter green">
                        <i style={{ width: "56%" }} />
                      </div>
                    </div>
                  </div>
                  <div className="links-section">
                    <div className="section-line">
                      <span className="eyebrow">
                        LINKS ({topology?.links.length ?? 0})
                      </span>
                      <button
                        onClick={() => setShowAllLinks((current) => !current)}
                      >
                        {showAllLinks ? "Collapse links" : "View all links"}
                      </button>
                    </div>
                    {(topology?.links ?? [])
                      .slice(0, showAllLinks ? undefined : 4)
                      .map((link) => (
                        <div
                          className="link-row"
                          key={`${link.source}-${link.target}`}
                        >
                          <span className="online-dot" />
                          {link.source} to {link.target}
                          <small>{link.medium}</small>
                        </div>
                      ))}
                  </div>
                </aside>
              </div>
              <div className="bottom-strip">
                <div className="alert-panel panel">
                  <div className="strip-tabs">
                    <button className={alertTab === "alerts" ? "active" : ""} onClick={() => setAlertTab("alerts")}>ALERTS</button>
                    <button className={alertTab === "tasks" ? "active" : ""} onClick={() => setAlertTab("tasks")}>TASKS</button>
                    <button
                      className="ai-tab"
                      type="button"
                      onClick={() =>
                        document.getElementById("ai-command")?.focus()
                      }
                    >
                      AI ASSISTANT
                    </button>
                    <button className={alertTab === "logs" ? "active" : ""} onClick={() => setAlertTab("logs")}>LOGS</button>
                  </div>
                  {alertTab === "alerts" && [
                    ["Critical", "Disk usage is above 90%"],
                    ["Warning", "PoE power usage above 80%"],
                    ["Info", "Firmware update available"],
                  ].map(([severity, message]) => (
                    <div className="alert-row" key={message}>
                      <span className={`severity ${severity.toLowerCase()}`}>
                        {severity}
                      </span>
                      <span>10:24 AM</span>
                      <b>{message}</b>
                    </div>
                  ))}
                  {alertTab === "tasks" && <div className="alert-row"><span className="severity warning">TASKS</span><span>{topology?.nodes.length ?? 0} assets</span><b>Review project work queue</b></div>}
                  {alertTab === "logs" && <div className="alert-row"><span className="severity info">LOG</span><span>Live</span><b>Topology synchronized with project API</b></div>}
                </div>
                <div className="floorplan panel">
                  <div className="section-line">
                    <span className="eyebrow">FLOORPLAN: 1ST FLOOR</span>
                    <span className="tiny-badge">2D</span>
                  </div>
                  <div className="floor-grid">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="camera panel">
                  <div className="section-line">
                    <span className="eyebrow">CAMERA VIEW: LOBBY - CAM 01</span>
                    <span className="online-dot" />
                  </div>
                  <div className="camera-image">
                    <Camera size={25} />
                    <span>{cameraPlaying ? "Live feed active" : "Live feed paused"}</span>
                    <button onClick={() => setCameraPlaying((current) => !current)} aria-label={cameraPlaying ? "Pause camera feed" : "Play camera feed"}>
                      <Play size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          {controlMessage && (
            <div className="control-message" role="status">
              {controlMessage}
            </div>
          )}
          <form className="ai-command" onSubmit={submitAIQuery}>
            <Sparkles size={15} />
            <input
              id="ai-command"
              value={aiQuery}
              onChange={(event) => setAiQuery(event.target.value)}
              placeholder="Ask the project AI... ( / )"
            />
            <button disabled={aiLoading || !activeProjectId}>
              {aiLoading ? "Thinking..." : "Ask"}
            </button>
          </form>
          {aiError && <p className="ai-error">{aiError}</p>}
          {aiResponse && (
            <div className="ai-response panel">
              <div>
                <span className="ai-badge">
                  <Sparkles size={11} /> AI SUGGESTED
                </span>
                <small>
                  Grounded in {aiResponse.grounded_node_count} nodes /{" "}
                  {aiResponse.grounded_link_count} links ·{" "}
                  {aiResponse.cached ? "cached response" : "fresh response"}
                </small>
              </div>
              <p>{aiResponse.answer}</p>
            </div>
          )}
        </section>
      </div>
      <footer className="statusbar">
        <span>
          PROJECT: <b>SkyRise Corporate HQ</b>
        </span>
        <span>
          ENVIRONMENT: <b>Production</b>
        </span>
        <span>
          LAST BACKUP: <b>10:20 AM (VPS)</b>
        </span>
        <span>
          COMPLIANCE SCORE: <b className="score">98%</b>
        </span>
        <span className="engine-label">
          <Sparkles size={12} /> AI ENGINE: Gemini 3 Flash
        </span>
        <span>VPS CONNECTED</span>
        <span>AETHER-IT v1.0.0</span>
      </footer>
    </main>
  );
}
