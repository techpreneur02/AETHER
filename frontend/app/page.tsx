"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { Connection } from "@xyflow/react";
import {
  Activity,
  Bell,
  BookOpen,
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
  EyeOff,
  FileCode2,
  FileDown,
  Gauge,
  GitBranch,
  Layers3,
  Lightbulb,
  ListTodo,
  LockKeyhole,
  Menu,
  Moon,
  Network,
  PanelRight,
  Plus,
  Router,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Sun,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import {
  createDevice,
  createIpAllocation,
  createLink,
  createProject,
  createSecurityRule,
  deleteLink,
  updateDevice,
  updateLink,
  exportProjectJson,
  exportProjectPdf,
  getTopology,
  listIpAllocations,
  listProjects,
  queryProjectAI,
  saveTopology,
  simulatePacket,
  updateDevicePosition,
  type AIQueryResponse,
  type IPAllocation,
  type PacketSimulation,
  type Project,
  type Topology,
} from "../lib/api";
import TopologyFlow, {
  TOPOLOGY_CANVAS_HEIGHT,
  TOPOLOGY_CANVAS_WIDTH,
} from "../components/TopologyFlow";

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
  ["Remote Operations", SquareTerminal],
  ["Security Tools", Search],
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
  "Remote Operations": "/operations",
  "Security Tools": "/security-tools",
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
  nodes: [
    { id: "internet", name: "Internet", kind: "device", vendor: "Public", model: "Cloud", port_count: 1 },
    { id: "controller", name: "Omada Controller", kind: "service", vendor: "Omada", model: "Controller", port_count: 4 },
    { id: "gateway", name: "Omada VPN Gateway", kind: "device", vendor: "Omada", model: "Gateway", port_count: 8 },
    { id: "switch", name: "Omada PoE Switch", kind: "device", vendor: "Omada", model: "Switch", port_count: 12 },
    { id: "ap1", name: "Omada AP", kind: "device", vendor: "Omada", model: "Access Point", port_count: 1 },
    { id: "ap2", name: "Omada AP", kind: "device", vendor: "Omada", model: "Access Point", port_count: 1 },
    { id: "ap3", name: "Omada AP", kind: "device", vendor: "Omada", model: "Access Point", port_count: 1 },
    { id: "ap4", name: "Omada AP", kind: "device", vendor: "Omada", model: "Access Point", port_count: 1 },
  ],
  links: [
    { source: "internet", target: "gateway", medium: "ethernet", source_port: "WAN", target_port: "WAN" },
    { source: "gateway", target: "switch", medium: "ethernet", source_port: "LAN1", target_port: "G1" },
    { source: "controller", target: "switch", medium: "ethernet", source_port: "ETH1", target_port: "G2" },
    { source: "switch", target: "ap1", medium: "fiber", source_port: "P1", target_port: "Port 1" },
    { source: "switch", target: "ap2", medium: "fiber", source_port: "P2", target_port: "Port 1" },
    { source: "switch", target: "ap3", medium: "fiber", source_port: "P3", target_port: "Port 1" },
    { source: "switch", target: "ap4", medium: "fiber", source_port: "P4", target_port: "Port 1" },
  ],
};

const businessSetupTopology: Topology = {
  nodes: [
    { id: "internet", name: "Internet", kind: "device", vendor: "ISP", model: "Public Internet", port_count: 1, floorplan_x: 0.08, floorplan_y: 0.12 },
    { id: "digicel-router", name: "Digicel Router", kind: "device", vendor: "Digicel", model: "Bridge", port_count: 4, floorplan_x: 0.2, floorplan_y: 0.18 },
    { id: "er7206", name: "Omada Load Balancer", kind: "device", vendor: "TP-Link", model: "ER7206", port_count: 8, floorplan_x: 0.35, floorplan_y: 0.24 },
    { id: "firewall", name: "Firewall Device", kind: "device", vendor: "Fortinet", model: "Firewall", port_count: 8, floorplan_x: 0.5, floorplan_y: 0.24 },
    { id: "core-switch-1", name: "Core Switch 1", kind: "device", vendor: "TP-Link", model: "TL-SG3428X", port_count: 24, floorplan_x: 0.66, floorplan_y: 0.32 },
    { id: "omada-controller", name: "Omada Controller", kind: "service", vendor: "TP-Link", model: "OC200", port_count: 4, floorplan_x: 0.68, floorplan_y: 0.12 },
    { id: "switch-2", name: "Access Switch 2", kind: "device", vendor: "TP-Link", model: "TL-SG3428MP", port_count: 24, floorplan_x: 0.54, floorplan_y: 0.6 },
    { id: "switch-3", name: "Access Switch 3", kind: "device", vendor: "TP-Link", model: "TL-SG3428", port_count: 24, floorplan_x: 0.8, floorplan_y: 0.6 },
    { id: "ap-1", name: "AP 1", kind: "device", vendor: "TP-Link", model: "EAP660", port_count: 1, floorplan_x: 0.38, floorplan_y: 0.78 },
    { id: "ap-2", name: "AP 2", kind: "device", vendor: "TP-Link", model: "EAP660", port_count: 1, floorplan_x: 0.56, floorplan_y: 0.82 },
    { id: "ap-3", name: "AP 3", kind: "device", vendor: "TP-Link", model: "EAP660", port_count: 1, floorplan_x: 0.74, floorplan_y: 0.82 },
    { id: "primary-server", name: "Primary Server", kind: "service", vendor: "HPE", model: "ProLiant", port_count: 4, floorplan_x: 0.9, floorplan_y: 0.48 },
    { id: "printer-1", name: "Printer 1", kind: "device", vendor: "HP", model: "LaserJet", port_count: 1, floorplan_x: 0.9, floorplan_y: 0.7 },
    { id: "printer-2", name: "Printer 2", kind: "device", vendor: "HP", model: "LaserJet", port_count: 1, floorplan_x: 0.92, floorplan_y: 0.78 },
    { id: "printer-3", name: "Printer 3", kind: "device", vendor: "HP", model: "LaserJet", port_count: 1, floorplan_x: 0.84, floorplan_y: 0.82 },
    { id: "printer-4", name: "Printer 4", kind: "device", vendor: "HP", model: "LaserJet", port_count: 1, floorplan_x: 0.96, floorplan_y: 0.72 },
    { id: "dept-a-pc-1", name: "Dept A PC 1", kind: "device", vendor: "Dell", model: "Latitude", port_count: 1, floorplan_x: 0.12, floorplan_y: 0.6 },
    { id: "dept-b-pc-1", name: "Dept B PC 1", kind: "device", vendor: "Dell", model: "Latitude", port_count: 1, floorplan_x: 0.2, floorplan_y: 0.72 },
    { id: "dept-c-pc-1", name: "Dept C PC 1", kind: "device", vendor: "Dell", model: "Latitude", port_count: 1, floorplan_x: 0.28, floorplan_y: 0.84 },
  ],
  links: [
    { source: "internet", target: "digicel-router", medium: "ethernet", source_port: "WAN", target_port: "WAN" },
    { source: "digicel-router", target: "er7206", medium: "ethernet", source_port: "LAN1", target_port: "WAN" },
    { source: "er7206", target: "firewall", medium: "ethernet", source_port: "LAN2", target_port: "WAN" },
    { source: "firewall", target: "core-switch-1", medium: "ethernet", source_port: "LAN1", target_port: "1" },
    { source: "core-switch-1", target: "omada-controller", medium: "ethernet", source_port: "2", target_port: "ETH1" },
    { source: "core-switch-1", target: "switch-2", medium: "ethernet", source_port: "23", target_port: "1" },
    { source: "core-switch-1", target: "switch-3", medium: "ethernet", source_port: "24", target_port: "1" },
    { source: "switch-2", target: "ap-1", medium: "fiber", source_port: "2", target_port: "Port 1" },
    { source: "switch-2", target: "ap-2", medium: "fiber", source_port: "3", target_port: "Port 1" },
    { source: "switch-2", target: "ap-3", medium: "fiber", source_port: "4", target_port: "Port 1" },
    { source: "switch-3", target: "primary-server", medium: "ethernet", source_port: "2", target_port: "1" },
    { source: "switch-3", target: "printer-1", medium: "ethernet", source_port: "3", target_port: "1" },
    { source: "switch-3", target: "printer-2", medium: "ethernet", source_port: "4", target_port: "1" },
    { source: "switch-3", target: "printer-3", medium: "ethernet", source_port: "5", target_port: "1" },
    { source: "switch-3", target: "printer-4", medium: "ethernet", source_port: "6", target_port: "1" },
    { source: "switch-3", target: "dept-a-pc-1", medium: "ethernet", source_port: "7", target_port: "1" },
    { source: "switch-3", target: "dept-b-pc-1", medium: "ethernet", source_port: "11", target_port: "1" },
    { source: "switch-3", target: "dept-c-pc-1", medium: "ethernet", source_port: "15", target_port: "1" },
  ],
};

const businessSubnetAllocations = [
  { address: "192.168.10.1", subnet: "192.168.10.0/24", description: "Management gateway", device_id: "omada-controller" },
  { address: "10.0.20.1", subnet: "10.0.20.0/24", description: "Dept A gateway", device_id: null },
  { address: "10.0.30.1", subnet: "10.0.30.0/24", description: "Dept B gateway", device_id: null },
  { address: "10.0.40.1", subnet: "10.0.40.0/24", description: "Dept C gateway", device_id: null },
  { address: "10.0.50.1", subnet: "10.0.50.0/24", description: "Servers and printers gateway", device_id: null },
  { address: "172.16.90.1", subnet: "172.16.90.0/24", description: "Guest Wi-Fi gateway", device_id: null },
  { address: "10.0.50.10", subnet: "10.0.50.0/24", description: "Primary server", device_id: "primary-server" },
  { address: "10.0.50.20", subnet: "10.0.50.0/24", description: "Printer 1", device_id: "printer-1" },
  { address: "10.0.50.21", subnet: "10.0.50.0/24", description: "Printer 2", device_id: "printer-2" },
  { address: "10.0.50.22", subnet: "10.0.50.0/24", description: "Printer 3", device_id: "printer-3" },
  { address: "10.0.50.23", subnet: "10.0.50.0/24", description: "Printer 4", device_id: "printer-4" },
];

const businessSecurityRules = [
  {
    name: "Guest Isolation",
    action: "deny" as const,
    protocol: "any" as const,
    source: "VLAN 90",
    destination: "10.0.0.0/8, 192.168.0.0/16",
    port: "any",
  },
  {
    name: "Print Access",
    action: "allow" as const,
    protocol: "tcp" as const,
    source: "VLAN 20, 30, 40",
    destination: "VLAN 50 (Printers 10.0.50.20-23)",
    port: "9100,631",
  },
  {
    name: "Management Protection",
    action: "deny" as const,
    protocol: "any" as const,
    source: "VLAN 30, 40, 90",
    destination: "VLAN 10",
    port: "any",
  },
];

function ensureExplicitLinkPorts(topology: Topology): Topology {
  const endpointCounts = new Map<string, number>();
  let changed = false;

  const nextEndpointPort = (nodeId: string) => {
    const nextCount = (endpointCounts.get(nodeId) ?? 0) + 1;
    endpointCounts.set(nodeId, nextCount);
    return `Port ${nextCount}`;
  };

  const links = topology.links.map((link) => {
    const fallbackSourcePort = nextEndpointPort(link.source);
    const fallbackTargetPort = nextEndpointPort(link.target);
    const sourcePort = link.source_port?.trim() || fallbackSourcePort;
    const targetPort = link.target_port?.trim() || fallbackTargetPort;
    changed ||= sourcePort !== link.source_port || targetPort !== link.target_port;
    return { ...link, source_port: sourcePort, target_port: targetPort };
  });

  return changed ? { ...topology, links } : topology;
}

function devicePortInventory(portCount: number | null | undefined, assignedPorts: string[]): string[] {
  const expectedCount = Math.max(1, portCount ?? 4);
  const inventory = Array.from(new Set(assignedPorts));

  for (let index = 1; inventory.length < expectedCount; index += 1) {
    const port = expectedCount <= 8 ? `Gi1/0/${index}` : `Eth${index}`;
    if (!inventory.includes(port)) inventory.push(port);
  }

  return inventory;
}

function arrangeTopologyHierarchically(topology: Topology): Topology {
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, string[]>();

  topology.nodes.forEach((node) => {
    incomingMap.set(node.id, 0);
    outgoingMap.set(node.id, []);
  });

  topology.links.forEach((link) => {
    if (!outgoingMap.has(link.source)) {
      outgoingMap.set(link.source, []);
    }
    if (!incomingMap.has(link.target)) {
      incomingMap.set(link.target, 0);
    }
    outgoingMap.get(link.source)?.push(link.target);
    incomingMap.set(link.target, (incomingMap.get(link.target) ?? 0) + 1);
  });

  const roots = [...topology.nodes]
    .filter((node) => (incomingMap.get(node.id) ?? 0) === 0)
    .sort((a, b) => {
      const priorities = { internet: 0, gateway: 1, router: 2, switch: 3, controller: 4, service: 5, device: 6, site: 7 };
      return (priorities[a.name.toLowerCase().includes("internet") ? "internet" : a.kind] ?? 99) - (priorities[b.name.toLowerCase().includes("internet") ? "internet" : b.kind] ?? 99);
    })
    .map((node) => node.id);

  const depthMap = new Map<string, number>();
  const queue = [...roots];

  roots.forEach((rootId) => depthMap.set(rootId, 0));

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const currentDepth = depthMap.get(currentId) ?? 0;
    const neighbors = outgoingMap.get(currentId) ?? [];

    neighbors.forEach((neighborId) => {
      const nextDepth = (depthMap.get(neighborId) ?? Number.POSITIVE_INFINITY);
      if (currentDepth + 1 < nextDepth) {
        depthMap.set(neighborId, currentDepth + 1);
        queue.push(neighborId);
      }
    });
  }

  const layerMap = new Map<number, string[]>();
  topology.nodes.forEach((node) => {
    const depth = depthMap.get(node.id) ?? 0;
    const current = layerMap.get(depth) ?? [];
    current.push(node.id);
    layerMap.set(depth, current);
  });

  Array.from(layerMap.entries()).forEach(([depth, ids]) => {
    layerMap.set(
      depth,
      ids.sort((a, b) => {
        const nodeA = topology.nodes.find((node) => node.id === a);
        const nodeB = topology.nodes.find((node) => node.id === b);
        const labelA = nodeA?.name ?? a;
        const labelB = nodeB?.name ?? b;
        return labelA.localeCompare(labelB);
      }),
    );
  });

  const orderedLayers = [...layerMap.entries()].sort(([a], [b]) => a - b);
  const maximumDepth = Math.max(...orderedLayers.map(([depth]) => depth), 0);
  const positionedNodes = topology.nodes.map((node) => {
    const depth = depthMap.get(node.id) ?? 0;
    const layerIds = orderedLayers.find(([layerDepth]) => layerDepth === depth)?.[1] ?? [];
    const layerIndex = layerIds.indexOf(node.id);
    const x = layerIds.length <= 1
      ? 0.5
      : 0.08 + layerIndex * (0.84 / (layerIds.length - 1));
    const y = maximumDepth === 0 ? 0.5 : 0.08 + depth * (0.8 / maximumDepth);

    return {
      ...node,
      floorplan_x: x,
      floorplan_y: y,
    };
  });

  return {
    ...topology,
    nodes: positionedNodes,
  };
}

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
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [activeStage, setActiveStage] = useState("DASHBOARD");
  const [selectedNode, setSelectedNode] = useState("");
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
  const [linkOperationalStatus, setLinkOperationalStatus] = useState<"up" | "down">("up");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkSourcePort, setLinkSourcePort] = useState("");
  const [linkTargetPort, setLinkTargetPort] = useState("");
  const [selectedLink, setSelectedLink] = useState<Topology["links"][number] | null>(null);
  const [selectedLinkOrigin, setSelectedLinkOrigin] = useState<{ source: string; target: string } | null>(null);
  const [detailVendor, setDetailVendor] = useState("");
  const [detailModel, setDetailModel] = useState("");
  const [detailPortCount, setDetailPortCount] = useState<number>(4);
  const [deviceAssignTarget, setDeviceAssignTarget] = useState("");
  const [deviceAssignMedium, setDeviceAssignMedium] = useState<
    "fiber" | "ethernet" | "wireless"
  >("ethernet");
  const [deviceAssignSourcePort, setDeviceAssignSourcePort] = useState("");
  const [deviceAssignTargetPort, setDeviceAssignTargetPort] = useState("");
  const [ipAllocations, setIpAllocations] = useState<IPAllocation[]>([]);
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
  const [vendorFilter, setVendorFilter] = useState("all");
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
  const [activeTopPanel, setActiveTopPanel] = useState<"health" | "search" | "terminal" | "notifications" | "settings" | "account" | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notifications, setNotifications] = useState([
    "Critical · Disk usage is above 90%",
    "Warning · PoE power usage above 80%",
    "Info · Firmware update available",
  ]);
  const [compactMode, setCompactMode] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("AETHER-IT project console ready.");
  const [canvasMode, setCanvasMode] = useState<"map" | "focus">("map");
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "online">("all");
  const [siteFilter, setSiteFilter] = useState<"all" | "sites">("all");
  const [legendFilter, setLegendFilter] = useState("all");
  const [viewRefreshToken, setViewRefreshToken] = useState(0);
  const [simulationSource, setSimulationSource] = useState("");
  const [simulationTarget, setSimulationTarget] = useState("");
  const [simulationProtocol, setSimulationProtocol] = useState<"tcp" | "udp" | "icmp">("icmp");
  const [simulationPort, setSimulationPort] = useState("");
  const [simulationResult, setSimulationResult] = useState<PacketSimulation | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("aether_theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aether_theme", nextTheme);
    setTheme(nextTheme);
  }

  function toggleTopPanel(panel: NonNullable<typeof activeTopPanel>) {
    setActiveTopPanel((current) => current === panel ? null : panel);
  }

  function signOut() {
    window.localStorage.removeItem("aether_access_token");
    window.location.assign("/login");
  }

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
      .then((loadedTopology) => {
        if (!loadedTopology.nodes.length) {
          const seededTopology = arrangeTopologyHierarchically(fallbackTopology);
          saveTopology(token, activeProjectId, seededTopology)
            .then((persistedTopology) => {
              setTopology(persistedTopology);
              setSelectedNode((current) => current || persistedTopology.nodes[0]?.id || "");
              setControlMessage("Empty project seeded with demo topology");
            })
            .catch(() => {
              setTopology(seededTopology);
              setSelectedNode((current) => current || seededTopology.nodes[0]?.id || "");
              setControlMessage("Demo topology restored");
            });
          return;
        }
        const normalizedTopology = ensureExplicitLinkPorts(loadedTopology);
        const shouldPersistNormalization = normalizedTopology !== loadedTopology;
        const arrangedTopology =
          normalizedTopology.nodes.some(
            (node) => node.floorplan_x == null || node.floorplan_y == null,
          )
            ? arrangeTopologyHierarchically(normalizedTopology)
            : normalizedTopology;
        setTopology(arrangedTopology);
        setSelectedNode((current) => current || arrangedTopology.nodes[0]?.id || "");
        if (shouldPersistNormalization) {
          saveTopology(token, activeProjectId, arrangedTopology)
            .then(setTopology)
            .catch(() => setControlMessage("Legacy links need port assignment review"));
        }
      })
      .catch(() => setTopologyLoadError(true));
  }, [activeProjectId]);

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId) {
      setIpAllocations([]);
      return;
    }

    listIpAllocations(token, activeProjectId)
      .then((allocations) => setIpAllocations(allocations))
      .catch(() => setIpAllocations([]));
  }, [activeProjectId]);

  useEffect(() => {
    const device = topology?.nodes.find((node) => node.id === selectedNode);
    if (!device) {
      setDetailVendor("");
      setDetailModel("");
      setDetailPortCount(4);
      setDeviceAssignTarget("");
      setDeviceAssignSourcePort("");
      setDeviceAssignTargetPort("");
      return;
    }
    const deviceLinks = topology?.links.filter(
      (link) => link.source === selectedNode || link.target === selectedNode,
    ) ?? [];
    const assignedPorts = deviceLinks
      .map((link) => link.source === selectedNode ? link.source_port : link.target_port)
      .filter((port): port is string => Boolean(port));
    const primaryLink = deviceLinks[0];

    setDetailVendor(device.vendor ?? "");
    setDetailModel(device.model ?? "");
    setDetailPortCount(device.port_count ?? Math.max(assignedPorts.length, 4));
    setDetailTab("overview");
    setDeviceAssignTarget(
      primaryLink
        ? primaryLink.source === selectedNode ? primaryLink.target : primaryLink.source
        : "",
    );
    setDeviceAssignMedium(primaryLink?.medium ?? "ethernet");
    setDeviceAssignSourcePort(
      primaryLink
        ? (primaryLink.source === selectedNode ? primaryLink.source_port : primaryLink.target_port) ?? ""
        : "",
    );
    setDeviceAssignTargetPort(
      primaryLink
        ? (primaryLink.source === selectedNode ? primaryLink.target_port : primaryLink.source_port) ?? ""
        : "",
    );
  }, [selectedNode, topology]);

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
  const displayedProjectName = activeProject || "No project selected";
  const selectedDevice = topology?.nodes.find((node) => node.id === selectedNode) ?? null;
  const selectedDeviceLinks =
    topology?.links.filter(
      (link) => link.source === selectedNode || link.target === selectedNode,
    ) ?? [];
  const selectedDevicePorts = selectedDevice
    ? Array.from(
        new Set(
          selectedDeviceLinks.flatMap((link) => [
            link.source === selectedNode ? link.source_port : null,
            link.target === selectedNode ? link.target_port : null,
          ]),
        ),
      ).filter((port): port is string => Boolean(port))
    : [];
  const selectedDeviceIpAllocations = selectedDevice
    ? ipAllocations.filter((allocation) => allocation.device_id === selectedDevice.id)
    : [];
  const selectedPortInventory = devicePortInventory(
    selectedDevice?.port_count,
    selectedDevicePorts,
  );
  const availableDevicePorts = selectedPortInventory.filter(
    (port) => !selectedDevicePorts.includes(port),
  );
  const assignableNodes =
    (topology?.nodes ?? []).filter((node) => node.id !== selectedNode);
  const selectedDevicePortOptions = selectedDevice ? selectedPortInventory : [];
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
  const availableVendors = Array.from(
    new Set(sourceTopology.nodes.map((node) => node.vendor).filter((vendor): vendor is string => Boolean(vendor))),
  ).sort((first, second) => first.localeCompare(second));
  const filteredNodeIds = new Set(
    sourceTopology.nodes
      .filter((node) => {
        const matchesType = typeFilter === "all" || node.kind === typeFilter;
        const matchesVendor = vendorFilter === "all" || node.vendor === vendorFilter;
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
          (legendFilter === "router" && /router/i.test(`${node.name} ${node.model ?? ""}`)) ||
          (legendFilter === "switch" && /switch|core/i.test(`${node.name} ${node.model ?? ""}`));
        return matchesType && matchesVendor && matchesSite && matchesSearch && matchesLegend;
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
      const arrangedTopology = topology ? arrangeTopologyHierarchically(topology) : null;
      if (arrangedTopology) {
        setTopology(arrangedTopology);
        const token = window.localStorage.getItem("aether_access_token");
        if (token && activeProjectId) {
          saveTopology(token, activeProjectId, arrangedTopology)
            .then(() => {
              setControlMessage("Auto-layout applied and saved");
            })
            .catch(() => {
              setControlMessage("Auto-layout applied locally; save sync failed");
            });
        } else {
          setControlMessage("Auto-layout applied and view reset");
        }
      }
      setSelectedNode(visibleNodes[0]?.id ?? arrangedTopology?.nodes[0]?.id ?? "");
      setZoom(100);
      setViewRefreshToken((current) => current + 1);
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
    setVendorFilter("all");
    setStatusFilter("all");
    setSiteFilter("all");
    setLegendFilter("all");
  }

  function resetView() {
    setZoom(100);
    setViewRefreshToken((current) => current + 1);
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
      linkSource === linkTarget ||
      !linkSourcePort.trim() ||
      !linkTargetPort.trim()
    )
      return;
    setLinkSaving(true);
    try {
      setTopology(
        await createLink(token, activeProjectId, {
          source: linkSource,
          target: linkTarget,
          medium: linkMedium,
          source_port: linkSourcePort.trim(),
          target_port: linkTargetPort.trim(),
          operational_status: "up",
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

  function connectTopologyNodes(connection: Connection) {
    if (
      !activeProjectId ||
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return;
    setLinkSource(connection.source);
    setLinkTarget(connection.target);
    setLinkSourcePort("");
    setLinkTargetPort("");
    setShowLinkForm(true);
    setControlMessage("Assign both endpoint ports to complete the link");
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
          floorplan_x: Math.max(0, Math.min(1, node.position.x / TOPOLOGY_CANVAS_WIDTH)),
          floorplan_y: Math.max(0, Math.min(1, node.position.y / TOPOLOGY_CANVAS_HEIGHT)),
        }),
      );
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to save node position",
      );
    }
  }

  useEffect(() => {
    if (!selectedLink) return;
    setSelectedLinkOrigin({ source: selectedLink.source, target: selectedLink.target });
    setLinkSource(selectedLink.source);
    setLinkTarget(selectedLink.target);
    setLinkMedium(selectedLink.medium);
    setLinkOperationalStatus(selectedLink.operational_status ?? "up");
    setLinkSourcePort(selectedLink.source_port ?? "");
    setLinkTargetPort(selectedLink.target_port ?? "");
  }, [selectedLink]);

  function selectTopologyEdge(edgeId: string) {
    const endpointPair = edgeId.replace(/^edge-/, "");
    const link = topology?.links.find((item) => {
      const edgeKey = `${item.source}-${item.target}`;
      const reverseKey = `${item.target}-${item.source}`;
      return edgeKey === endpointPair || reverseKey === endpointPair;
    });
    if (!link) return;
    setSelectedLink(link);
    setSelectedLinkOrigin({ source: link.source, target: link.target });
    setLinkSource(link.source);
    setLinkTarget(link.target);
    setLinkMedium(link.medium);
    setLinkOperationalStatus(link.operational_status ?? "up");
    setLinkSourcePort(link.source_port ?? "");
    setLinkTargetPort(link.target_port ?? "");
  }

  async function saveSelectedDevice() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedNode) return;
    const currentDevice = topology?.nodes.find((node) => node.id === selectedNode);
    if (!currentDevice) return;
    try {
      const nextTopology = await updateDevice(token, activeProjectId, selectedNode, {
        name: currentDevice.name,
        kind: currentDevice.kind,
        vendor: detailVendor || undefined,
        model: detailModel || undefined,
        port_count: detailPortCount,
      });
      setTopology(nextTopology);
      setControlMessage("Device details saved");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Unable to update device");
    }
  }

  async function saveSelectedLink() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedLink) return;
    if (!linkSourcePort.trim() || !linkTargetPort.trim()) {
      setControlMessage("Source and target ports are required");
      return;
    }
    const originalSource = selectedLinkOrigin?.source ?? selectedLink.source;
    const originalTarget = selectedLinkOrigin?.target ?? selectedLink.target;
    try {
      setTopology(await updateLink(token, activeProjectId, originalSource, originalTarget, {
        source: linkSource,
        target: linkTarget,
        medium: linkMedium,
        source_port: linkSourcePort.trim(),
        target_port: linkTargetPort.trim(),
        operational_status: linkOperationalStatus,
      }));
      setSelectedLink(null);
      setSelectedLinkOrigin(null);
      setLinkSource("");
      setLinkTarget("");
      setControlMessage("Connection details saved");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Unable to update link");
    }
  }

  async function removeSelectedLink() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedLink) return;
    const originalSource = selectedLinkOrigin?.source ?? selectedLink.source;
    const originalTarget = selectedLinkOrigin?.target ?? selectedLink.target;
    try {
      setTopology(await deleteLink(token, activeProjectId, originalSource, originalTarget));
      setSelectedLink(null);
      setSelectedLinkOrigin(null);
      setControlMessage("Link deleted");
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : "Unable to delete link");
    }
  }

  async function assignDeviceToTarget() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !selectedNode || !deviceAssignTarget) {
      setControlMessage("Choose a target device before assigning");
      return;
    }

    const localPort = deviceAssignSourcePort || selectedDevicePortOptions[0];
    const remotePort = deviceAssignTargetPort.trim();
    if (!localPort || !remotePort) {
      setControlMessage("Both device and target ports are required");
      return;
    }
    const existingLink = selectedDeviceLinks.find(
      (link) =>
        (link.source === selectedNode && link.target === deviceAssignTarget) ||
        (link.target === selectedNode && link.source === deviceAssignTarget),
    );

    try {
      const nextTopology = existingLink
        ? await updateLink(token, activeProjectId, existingLink.source, existingLink.target, {
            source: existingLink.source,
            target: existingLink.target,
            medium: deviceAssignMedium,
            source_port: existingLink.source === selectedNode ? localPort : remotePort,
            target_port: existingLink.target === selectedNode ? localPort : remotePort,
            operational_status: existingLink.operational_status ?? "up",
          })
        : await createLink(token, activeProjectId, {
            source: selectedNode,
            target: deviceAssignTarget,
            medium: deviceAssignMedium,
            source_port: localPort,
            target_port: remotePort,
            operational_status: "up",
          });
      setTopology(nextTopology);
      setControlMessage(existingLink ? "Connection assignment updated" : "Device assignment created");
    } catch (error) {
      setControlMessage(
        error instanceof Error ? error.message : "Unable to assign device",
      );
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

  async function loadBusinessArchitectureSetup() {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }

    try {
      let projectId = activeProjectId;
      if (!projectId) {
        const createdProject = await createProject(token, {
          name: "Corporate HQ Core Network",
          description: "Internet -> Router -> Firewall -> Core -> Access -> Wi-Fi and server topology",
        });
        projectId = createdProject.id;
        setProjects((current) => [createdProject, ...current]);
        setActiveProjectId(projectId);
      }

      const nextTopology = arrangeTopologyHierarchically(businessSetupTopology);
      const savedTopology = await saveTopology(token, projectId, nextTopology);
      setTopology(savedTopology);
      setSelectedNode(savedTopology.nodes[0]?.id ?? "");

      for (const allocation of businessSubnetAllocations) {
        try {
          await createIpAllocation(token, projectId, {
            address: allocation.address,
            subnet: allocation.subnet,
            description: allocation.description,
            device_id: allocation.device_id,
          });
        } catch {
          // Ignore duplicate or already-existing allocations during setup.
        }
      }

      for (const rule of businessSecurityRules) {
        try {
          await createSecurityRule(token, projectId, rule);
        } catch {
          // Ignore duplicates or existing rules during setup.
        }
      }

      setControlMessage("Corporate HQ network architecture loaded and saved");
      setViewRefreshToken((current) => current + 1);
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        window.localStorage.removeItem("aether_access_token");
        window.location.replace("/login");
        return;
      }
      setControlMessage(
        error instanceof Error ? error.message : "Unable to load network architecture",
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

  async function runPacketSimulation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = window.localStorage.getItem("aether_access_token");
    if (!token || !activeProjectId || !simulationSource || !simulationTarget) return;
    setSimulationRunning(true);
    setSimulationError("");
    try {
      setSimulationResult(await simulatePacket(token, activeProjectId, {
        source_device_id: simulationSource,
        target_device_id: simulationTarget,
        protocol: simulationProtocol,
        port: simulationProtocol === "icmp" || !simulationPort ? null : Number(simulationPort),
      }));
    } catch (error) {
      setSimulationResult(null);
      setSimulationError(error instanceof Error ? error.message : "Packet simulation failed");
    } finally {
      setSimulationRunning(false);
    }
  }

  function runAIAction(actionId: string) {
    if (actionId === "open_simulator") {
      setActiveStage("SIMULATOR");
      setActiveNav("Topology");
      return;
    }
    if (actionId === "open_topology") {
      setActiveStage("TOPOLOGY");
      setActiveNav("Topology");
      return;
    }
    if (actionId === "open_ipam") {
      window.location.assign("/ip-management");
      return;
    }
    if (actionId === "open_security") {
      window.location.assign("/security");
    }
  }

  const connectedDeviceIds = new Set(
    (topology?.links ?? []).flatMap((link) => [link.source, link.target]),
  );
  const downLinkCount = (topology?.links ?? []).filter(
    (link) => link.operational_status === "down",
  ).length;
  const isolatedDeviceCount = (topology?.nodes ?? []).filter(
    (node) => !connectedDeviceIds.has(node.id),
  ).length;
  const addressedDeviceIds = new Set(ipAllocations.map((allocation) => allocation.device_id).filter(Boolean));
  const missingAddressCount = (topology?.nodes ?? []).filter((node) => !addressedDeviceIds.has(node.id)).length;
  const operationalLinkRate = topology?.links.length
    ? Math.round(((topology.links.length - downLinkCount) / topology.links.length) * 100)
    : 100;
  const dashboardAlarms = [
    ...(downLinkCount ? [{ severity: "critical", title: `${downLinkCount} connection${downLinkCount === 1 ? "" : "s"} down`, detail: "Review link state before running simulations." }] : []),
    ...(isolatedDeviceCount ? [{ severity: "warning", title: `${isolatedDeviceCount} isolated device${isolatedDeviceCount === 1 ? "" : "s"}`, detail: "Connect the devices or document their standalone role." }] : []),
    ...(topologyLoadError ? [{ severity: "critical", title: "Topology synchronization failed", detail: "Check API health before recording infrastructure changes." }] : []),
  ];

  function runTerminalCommand(command: string) {
    const normalized = command.trim().toLowerCase();
    if (!normalized) {
      setTerminalOutput("Enter help to list available commands.");
      return;
    }
    if (normalized === "clear") {
      setTerminalOutput("");
      return;
    }
    if (normalized === "help") {
      setTerminalOutput("Available commands: help, status, devices, links, simulator, clear");
      return;
    }
    if (normalized === "status") {
      setTerminalOutput(`Engine: ${isLive ? "online" : "paused"}\nProject: ${activeProject}\nAPI sync: ${projectLoadError || topologyLoadError ? "attention required" : "connected"}`);
      return;
    }
    if (normalized === "devices") {
      setTerminalOutput(`${topology?.nodes.length ?? 0} devices recorded\n${isolatedDeviceCount} isolated devices`);
      return;
    }
    if (normalized === "links") {
      setTerminalOutput(`${topology?.links.length ?? 0} links recorded\n${downLinkCount} links down`);
      return;
    }
    if (normalized === "simulator") {
      setActiveStage("SIMULATOR");
      setActiveTopPanel(null);
      setTerminalOutput("Simulator opened.");
      return;
    }
    setTerminalOutput(`Unknown command: ${command.trim()}\nEnter help to list available commands.`);
  }
  const liveCurrentState = [
    `${topology?.nodes.length ?? 0} devices and ${topology?.links.length ?? 0} recorded links`,
    `${downLinkCount} links down and ${isolatedDeviceCount} isolated devices`,
    `${ipAllocations.length} assigned IP addresses`,
  ];
  const visibleCurrentState = aiResponse?.current_state.length
    ? aiResponse.current_state
    : liveCurrentState;
  const visibleSuggestions = aiResponse?.suggestions.length
    ? aiResponse.suggestions
    : [
        downLinkCount
          ? "Restore or document down links before validating application flows."
          : "Run representative packet traces against the intended design.",
        isolatedDeviceCount
          ? "Connect isolated devices or document their standalone role."
          : "Review recorded ports and addresses for audit completeness.",
      ];
  const visibleActions = aiResponse?.actions.length
    ? aiResponse.actions
    : [
        { id: "open_simulator", label: "Run packet trace", description: "Validate reachability and policy." },
        { id: "open_security", label: "Review security", description: "Inspect enforcement rules." },
      ];
  const searchQuery = globalSearch.trim().toLowerCase();
  const matchingDevices = searchQuery ? (topology?.nodes ?? fallbackTopology.nodes).filter((node) =>
    [node.name, node.vendor, node.model, node.kind].filter(Boolean).some((value) => value?.toLowerCase().includes(searchQuery)),
  ).slice(0, 6) : [];
  const matchingModules = searchQuery ? Object.entries(navigationRoutes).filter(([label]) =>
    label.toLowerCase().includes(searchQuery),
  ).slice(0, 5) : [];

  return (
    <main className={`console-shell ${compactMode ? "compact-console" : ""}`}>
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
          <button
            className={`health ${activeTopPanel === "health" ? "active" : ""}`}
            title="System health details"
            aria-label="System health details"
            aria-expanded={activeTopPanel === "health"}
            onClick={() => toggleTopPanel("health")}
          >
            <span className="pulse" /> SYSTEM HEALTH <b>100%</b>
          </button>
          <button
            className="icon-action theme-toggle"
            title={`Use ${theme === "light" ? "dark" : "light"} theme`}
            aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button
            className={`icon-action ${activeTopPanel === "search" ? "active" : ""}`}
            title="Search"
            aria-label="Search devices and modules"
            aria-expanded={activeTopPanel === "search"}
            onClick={() => toggleTopPanel("search")}
          >
            <Search size={18} />
          </button>
          <button
            className={`icon-action ${activeTopPanel === "terminal" ? "active" : ""}`}
            title="Terminal"
            aria-label="Project terminal"
            aria-expanded={activeTopPanel === "terminal"}
            onClick={() => toggleTopPanel("terminal")}
          >
            <SquareTerminal size={18} />
          </button>
          <button
            className={`notification icon-action ${activeTopPanel === "notifications" ? "active" : ""}`}
            title="Notifications"
            aria-label={`${notifications.length} notifications`}
            aria-expanded={activeTopPanel === "notifications"}
            onClick={() => toggleTopPanel("notifications")}
          >
            <Bell size={18} />
            {notifications.length > 0 && <i>{notifications.length}</i>}
          </button>
          <button
            className={`icon-action ${activeTopPanel === "settings" ? "active" : ""}`}
            title="Settings"
            aria-label="Console settings"
            aria-expanded={activeTopPanel === "settings"}
            onClick={() => toggleTopPanel("settings")}
          >
            <Settings size={18} />
          </button>
          <button
            className={`account-trigger ${activeTopPanel === "account" ? "active" : ""}`}
            title="Account"
            aria-label="Account menu"
            aria-expanded={activeTopPanel === "account"}
            onClick={() => toggleTopPanel("account")}
          >
            <span className="avatar">SA</span>
            <span className="user-name">Sherwin Armas</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      {activeTopPanel === "health" && <section className="ops-popover health-popover"><div className="panel-heading"><b>SYSTEM HEALTH</b><button className="panel-icon" aria-label="Close health details" onClick={() => setActiveTopPanel(null)}><X size={13} /></button></div><div className="health-metrics"><div><span>VPS engine</span><b className="healthy">{isLive ? "Online" : "Paused"}</b></div><div><span>API synchronization</span><b className={projectLoadError || topologyLoadError ? "attention" : "healthy"}>{projectLoadError || topologyLoadError ? "Attention" : "Connected"}</b></div><div><span>Devices / links</span><b>{topology?.nodes.length ?? 0} / {topology?.links.length ?? 0}</b></div><div><span>Down / isolated</span><b>{downLinkCount} / {isolatedDeviceCount}</b></div></div></section>}
      {activeTopPanel === "search" && <section className="ops-popover global-search-popover"><div className="panel-heading"><b>GLOBAL SEARCH</b><button className="panel-icon" aria-label="Close search" onClick={() => setActiveTopPanel(null)}><X size={13} /></button></div><label className="global-search-field"><Search size={14} /><input autoFocus value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search devices or modules..." /></label><div className="global-search-results">{!searchQuery && <span>Start typing to search this project.</span>}{matchingDevices.map((node) => <button key={node.id} onClick={() => { setSelectedNode(node.id); setActiveStage("DEVICE DETAILS"); setActiveNav("Topology"); setActiveTopPanel(null); }}><Server size={14} /><div><b>{node.name}</b><small>{[node.vendor, node.model].filter(Boolean).join(" · ") || node.kind}</small></div></button>)}{matchingModules.map(([label, route]) => <button key={label} onClick={() => window.location.assign(route)}><Layers3 size={14} /><div><b>{label}</b><small>Open workspace</small></div></button>)}{searchQuery && !matchingDevices.length && !matchingModules.length && <span>No matching devices or modules.</span>}</div></section>}
      {activeTopPanel === "terminal" && <section className="ops-popover terminal-popover"><div className="panel-heading"><b>PROJECT TERMINAL</b><button className="panel-icon" aria-label="Close terminal" onClick={() => setActiveTopPanel(null)}><X size={13} /></button></div><form onSubmit={(event) => { event.preventDefault(); runTerminalCommand(terminalCommand); setTerminalCommand(""); }}><input autoFocus value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} placeholder="Enter help for commands..." /><button>Run</button></form><pre>{terminalOutput}</pre></section>}
      {activeTopPanel === "notifications" && <section className="ops-popover notifications-popover"><div className="panel-heading"><b>NOTIFICATIONS</b><button className="panel-icon" aria-label="Close notifications" onClick={() => setActiveTopPanel(null)}><X size={13} /></button></div>{notifications.length ? notifications.map((notification) => <button key={notification} onClick={() => { setNotifications((current) => current.filter((item) => item !== notification)); setControlMessage(`${notification} acknowledged`); }}>{notification}<small>Acknowledge</small></button>) : <div className="popover-empty"><Check size={15} /> All caught up</div>}</section>}
      {activeTopPanel === "settings" && <section className="ops-popover settings-popover"><div className="panel-heading"><b>CONSOLE SETTINGS</b><button className="panel-icon" aria-label="Close settings" onClick={() => setActiveTopPanel(null)}><X size={13} /></button></div><label><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /> Compact operations layout</label><button onClick={toggleTheme}>{theme === "light" ? "Switch to dark theme" : "Switch to light theme"}</button><a href="/config">Open configuration workspace</a></section>}
      {activeTopPanel === "account" && <section className="ops-popover account-popover"><div className="account-summary"><span className="avatar">SA</span><div><b>Sherwin Armas</b><small>Administrator</small></div></div><a href="/members">Manage members</a><a href="/knowledge-base">Open knowledge base</a><button className="sign-out-action" onClick={signOut}>Sign out</button></section>}
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-section-label">OPERATIONS</div>
          {navigation.map(([label, Icon]) =>
            navigationRoutes[label] ? (
              <a
                key={label}
                href={navigationRoutes[label]}
                className={`nav-item nav-link ${activeNav === label ? "active" : ""}`}
                onClick={(event) => {
                  if (["Dashboard", "Projects", "Topology"].includes(label)) event.preventDefault();
                  setActiveNav(label);
                  setActiveStage(label === "Dashboard" ? "DASHBOARD" : "TOPOLOGY");
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
          <a className="nav-item nav-link" href="/knowledge-base">
            <BookOpen size={15} />
            <span>Knowledge Base</span>
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
            <button
              className={activeStage === "DEVICE DETAILS" ? "selected" : ""}
              onClick={() => setActiveStage("DEVICE DETAILS")}
            >
              <PanelRight size={14} /> DEVICE DETAILS
            </button>
            <button
              className={activeStage === "SIMULATOR" ? "selected" : ""}
              onClick={() => setActiveStage("SIMULATOR")}
            >
              <Activity size={14} /> SIMULATOR
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
          {activeStage === "DASHBOARD" ? (
            <div className="dashboard-overview">
              <div className="dashboard-heading">
                <div><span className="eyebrow">PROJECT / OPERATIONAL OVERVIEW</span><h1>{displayedProjectName}</h1><p>Current infrastructure state, coverage, notices, and priority alarms.</p></div>
                <a href="/audit"><FileCheck2 size={15} /> Run infrastructure audit</a>
              </div>
              <section className="dashboard-stat-grid" aria-label="Quick project statistics">
                {[
                  [Server, topology?.nodes.length ?? 0, "Devices", "Recorded inventory"],
                  [Cable, topology?.links.length ?? 0, "Connections", `${operationalLinkRate}% operational`],
                  [GitBranch, ipAllocations.length, "IP addresses", `${missingAddressCount} devices unassigned`],
                  [ShieldCheck, "98%", "Compliance", "Current project score"],
                  [Activity, downLinkCount, "Down links", downLinkCount ? "Attention required" : "All links available"],
                  [Network, isolatedDeviceCount, "Isolated", isolatedDeviceCount ? "Review topology" : "All devices connected"],
                ].map(([Icon, value, label, detail]) => {
                  const MetricIcon = Icon as LucideIcon;
                  return <article className="dashboard-stat" key={String(label)}><div><MetricIcon size={17} /><span>{String(label)}</span></div><strong>{String(value)}</strong><small>{String(detail)}</small></article>;
                })}
              </section>
              <div className="dashboard-detail-grid">
                <section className="dashboard-section dashboard-modules">
                  <header><div><span className="eyebrow">WORKSPACES</span><h2>Infrastructure summary</h2></div><small>{navigation.length} operational areas</small></header>
                  <div className="dashboard-module-grid">
                    {[
                      ["Topology", Network, `${topology?.nodes.length ?? 0} devices · ${topology?.links.length ?? 0} links`, "/"],
                      ["Devices", Server, `${topology?.nodes.filter((node) => node.kind === "device").length ?? 0} managed assets`, "/devices"],
                      ["IP Management", GitBranch, `${ipAllocations.length} allocations`, "/ip-management"],
                      ["Floorplans", Layers3, "Physical placement and plans", "/floorplans"],
                      ["Security", LockKeyhole, "Policy and enforcement rules", "/security"],
                      ["Compliance", ShieldCheck, "Audit readiness and controls", "/compliance"],
                      ["Cabling", Cable, `${topology?.links.filter((link) => link.medium !== "wireless").length ?? 0} wired links`, "/cabling"],
                      ["Reports", FileCheck2, "Metrics and project exports", "/reports"],
                    ].map(([label, Icon, summary, href]) => {
                      const ModuleIcon = Icon as LucideIcon;
                      return <a href={String(href)} key={String(label)} onClick={(event) => { if (label === "Topology") { event.preventDefault(); setActiveNav("Topology"); setActiveStage("TOPOLOGY"); } }}><ModuleIcon size={17} /><div><b>{String(label)}</b><span>{String(summary)}</span></div><ChevronDown size={14} /></a>;
                    })}
                  </div>
                </section>
                <div className="dashboard-operations">
                  <section className="dashboard-section dashboard-alarms"><header><div><span className="eyebrow">PRIORITY</span><h2>Alarms</h2></div><b>{dashboardAlarms.length}</b></header>{dashboardAlarms.length ? dashboardAlarms.map((alarm) => <div className={`dashboard-alert ${alarm.severity}`} key={alarm.title}><Bell size={15} /><div><b>{alarm.title}</b><span>{alarm.detail}</span></div></div>) : <div className="dashboard-clear"><Check size={17} /><div><b>No active infrastructure alarms</b><span>Recorded links and device connectivity are healthy.</span></div></div>}</section>
                  <section className="dashboard-section dashboard-notices"><header><div><span className="eyebrow">ACTIVITY</span><h2>Notices</h2></div><b>{notifications.length}</b></header>{notifications.slice(0, 4).map((notice) => <button key={notice} onClick={() => setNotifications((current) => current.filter((item) => item !== notice))}><CircleDot size={13} /><span>{notice}</span><small>Acknowledge</small></button>)}</section>
                </div>
              </div>
            </div>
          ) : !['TOPOLOGY', 'DEVICE DETAILS', 'SIMULATOR'].includes(activeStage) ? (
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
                  <span className="eyebrow">
                    {activeStage === "TOPOLOGY" ? "TOPOLOGY / LIVE MAP" : activeStage === "SIMULATOR" ? "SIMULATION / PACKET TRACE" : "ASSET / DEVICE DETAILS"}
                  </span>
                  <h1>{activeStage === "TOPOLOGY" ? "Infrastructure topology" : activeStage === "SIMULATOR" ? "Multi-vendor packet simulator" : selectedDevice?.name ?? "Device details"}</h1>
                  <span className="topology-summary">
                    {activeStage === "SIMULATOR"
                      ? "Trace reachability, ports, latency, and security policy"
                      : activeStage === "DEVICE DETAILS"
                      ? "Metadata, ports, addressing, and connection assignment"
                      : topologyLoadError
                      ? "Topology unavailable"
                      : `${topology?.nodes.length ?? 0} devices · ${topology?.links.length ?? 0} links`}
                  </span>
                </div>
                <div className="toolbar-actions">
                  {activeStage === "TOPOLOGY" && !topology?.nodes.length && (
                    <button onClick={loadDemoTopology}>
                      <Database size={14} /> Load demo
                    </button>
                  )}
                  {activeStage === "DEVICE DETAILS" ? (
                    <>
                      <select aria-label="Selected device" value={selectedNode} onChange={(event) => setSelectedNode(event.target.value)}>
                        {(topology?.nodes ?? []).map((node) => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setActiveStage("TOPOLOGY")}>
                        <Network size={14} /> Back to topology
                      </button>
                    </>
                  ) : activeStage === "SIMULATOR" ? (
                    <button onClick={() => setActiveStage("TOPOLOGY")}>
                      <Network size={14} /> Back to topology
                    </button>
                  ) : (
                    <>
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
                  <button onClick={loadBusinessArchitectureSetup}>
                    <Database size={14} /> Load setup
                  </button>
                  <button onClick={resetView}>
                    <Eye size={14} /> View
                  </button>
                  <button
                    className={showMiniMap ? "selected" : ""}
                    aria-pressed={showMiniMap}
                    title={showMiniMap ? "Hide topology overview map" : "Show topology overview map"}
                    onClick={() => setShowMiniMap((current) => !current)}
                  >
                    <Network size={14} /> {showMiniMap ? "Hide map" : "Show map"}
                  </button>
                    </>
                  )}
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
                  <input required placeholder="Source port e.g. Gi1/0/1" value={linkSourcePort} onChange={(event) => setLinkSourcePort(event.target.value)} />
                  <input required placeholder="Target port e.g. Gi1/0/24" value={linkTargetPort} onChange={(event) => setLinkTargetPort(event.target.value)} />
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
                  <select value={linkSource} onChange={(event) => setLinkSource(event.target.value)}>
                    <option value="">Source device</option>
                    {(topology?.nodes ?? []).map((node) => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                  <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}>
                    <option value="">Target device</option>
                    {(topology?.nodes ?? []).map((node) => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                  <select value={linkMedium} onChange={(event) => setLinkMedium(event.target.value as typeof linkMedium)}>
                    <option value="ethernet">Ethernet</option>
                    <option value="fiber">Fiber</option>
                    <option value="wireless">Wireless</option>
                  </select>
                  <select aria-label="Connection status" value={linkOperationalStatus} onChange={(event) => setLinkOperationalStatus(event.target.value as typeof linkOperationalStatus)}>
                    <option value="up">Operational</option>
                    <option value="down">Down / disabled</option>
                  </select>
                  <input aria-label="Source port" placeholder="Source port" value={linkSourcePort} onChange={(event) => setLinkSourcePort(event.target.value)} />
                  <input aria-label="Target port" placeholder="Target port" value={linkTargetPort} onChange={(event) => setLinkTargetPort(event.target.value)} />
                  <button type="button" onClick={saveSelectedLink}>Save connection</button>
                  <button type="button" onClick={removeSelectedLink}>Delete connection</button>
                  <button type="button" onClick={() => {
                    setSelectedLink(null);
                    setSelectedLinkOrigin(null);
                    setLinkSource("");
                    setLinkTarget("");
                  }}>Close</button>
                </div>
              )}
              {activeStage === "SIMULATOR" && (
                <section className="simulator-workspace">
                  <form className="simulator-controls panel" onSubmit={runPacketSimulation}>
                    <div className="panel-heading"><b>PACKET PARAMETERS</b></div>
                    <label className="detail-field">
                      <span>Source device</span>
                      <select required value={simulationSource} onChange={(event) => setSimulationSource(event.target.value)}>
                        <option value="">Choose source</option>
                        {(topology?.nodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                      </select>
                    </label>
                    <label className="detail-field">
                      <span>Destination device</span>
                      <select required value={simulationTarget} onChange={(event) => setSimulationTarget(event.target.value)}>
                        <option value="">Choose destination</option>
                        {(topology?.nodes ?? []).filter((node) => node.id !== simulationSource).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                      </select>
                    </label>
                    <label className="detail-field">
                      <span>Protocol</span>
                      <select value={simulationProtocol} onChange={(event) => setSimulationProtocol(event.target.value as typeof simulationProtocol)}>
                        <option value="icmp">ICMP</option>
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                      </select>
                    </label>
                    {simulationProtocol !== "icmp" && (
                      <label className="detail-field">
                        <span>Destination port</span>
                        <input required type="number" min={1} max={65535} value={simulationPort} onChange={(event) => setSimulationPort(event.target.value)} placeholder="e.g. 443" />
                      </label>
                    )}
                    <button className="simulation-run" disabled={simulationRunning || !simulationSource || !simulationTarget}>
                      <Activity size={15} /> {simulationRunning ? "Tracing..." : "Run packet trace"}
                    </button>
                    {simulationError && <p className="simulation-error">{simulationError}</p>}
                  </form>
                  <div className="simulation-results panel">
                    <div className="panel-heading"><b>TRACE RESULT</b></div>
                    {!simulationResult ? (
                      <div className="simulation-empty"><Activity size={28} /><span>Select endpoints and run a trace.</span></div>
                    ) : (
                      <>
                        <div className={`simulation-verdict ${simulationResult.disposition}`}>
                          <strong>{simulationResult.disposition.toUpperCase()}</strong>
                          <span>{simulationResult.reason}</span>
                          <small>{simulationResult.protocol.toUpperCase()}{simulationResult.port ? `/${simulationResult.port}` : ""} · {simulationResult.total_latency_ms} ms</small>
                        </div>
                        {simulationResult.matched_rule_name && <div className="matched-rule"><ShieldCheck size={14} /> Policy: {simulationResult.matched_rule_name}{simulationResult.enforcement_device_name ? ` · enforced at ${simulationResult.enforcement_device_name}` : " · global"}</div>}
                        <div className="simulation-hops">
                          {simulationResult.hops.map((hop, index) => (
                            <div className="simulation-hop" key={hop.device_id}>
                              <span className="hop-index">{index + 1}</span>
                              <div><b>{hop.name}</b><small>{[hop.vendor, hop.model].filter(Boolean).join(" · ") || "Generic device"}</small></div>
                              <div><span>{hop.ip_address ?? "No IP"}</span><small>{hop.ingress_port ?? "Origin"} → {hop.egress_port ?? "Destination"}</small></div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}
              <div className={`content-grid ${activeStage === "SIMULATOR" ? "simulator-hidden" : activeStage === "DEVICE DETAILS" ? "device-details-view" : "topology-view"}`}>
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
                        aria-pressed={enabledLayers.includes(item)}
                        title={enabledLayers.includes(item) ? `Hide ${item}` : `Show ${item}`}
                      >
                        <span className={`layer-dot dot-${index}`} />
                        <span>{item}</span>
                        {enabledLayers.includes(item) ? <Eye size={12} /> : <EyeOff size={12} />}
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
                      <select
                        aria-label="Filter topology by vendor"
                        value={vendorFilter}
                        onChange={(event) => setVendorFilter(event.target.value)}
                      >
                        <option value="all">All vendors</option>
                        {availableVendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}
                      </select>
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
                                : label === "Router"
                                  ? "router"
                                  : label === "Switch"
                                    ? "switch"
                                  : "all";
                      return (
                        <button
                          className={`legend-row ${legendFilter === filter ? "selected" : ""}`}
                          key={`${label}-${index}`}
                          onClick={() => setLegendFilter((current) => current === filter ? "all" : filter)}
                          aria-pressed={legendFilter === filter}
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
                    onNodeClick={(nodeId) => {
                      setSelectedNode(nodeId);
                      setActiveStage("DEVICE DETAILS");
                    }}
                    onConnect={connectTopologyNodes}
                    onNodeDragStop={persistNodePosition}
                    onEdgeClick={selectTopologyEdge}
                    fitViewTrigger={viewRefreshToken}
                    showMiniMap={showMiniMap}
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
                    <button className="panel-icon" title="Back to topology" onClick={() => setActiveStage("TOPOLOGY")}>
                      <X size={15} />
                    </button>
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
                    <>
                      <dl className="spec-list">
                        <div>
                          <dt>Device</dt>
                          <dd>{selectedDevice?.name ?? "No device selected"}</dd>
                        </div>
                        <div>
                          <dt>Device ID</dt>
                          <dd>{selectedDevice?.id ?? "Not available"}</dd>
                        </div>
                        <div>
                          <dt>Kind</dt>
                          <dd>{selectedDevice?.kind ?? "unknown"}</dd>
                        </div>
                        <div>
                          <dt>Vendor</dt>
                          <dd>{selectedDevice?.vendor ?? "Custom"}</dd>
                        </div>
                        <div>
                          <dt>Model</dt>
                          <dd>{selectedDevice?.model ?? "Not specified"}</dd>
                        </div>
                        <div>
                          <dt>Ports</dt>
                          <dd>{selectedDevice?.port_count ?? selectedPortInventory.length}</dd>
                        </div>
                        <div>
                          <dt>Connections</dt>
                          <dd>{selectedDeviceLinks.length}</dd>
                        </div>
                        <div>
                          <dt>Used ports</dt>
                          <dd>{selectedDevicePorts.length}</dd>
                        </div>
                        <div>
                          <dt>Available ports</dt>
                          <dd>{availableDevicePorts.length}</dd>
                        </div>
                        <div>
                          <dt>IP address</dt>
                          <dd>{selectedDeviceIpAllocations.map((allocation) => allocation.address).join(", ") || "Not assigned"}</dd>
                        </div>
                      </dl>
                      {selectedDevice && (
                        <div className="detail-message">
                          <b>Edit device metadata</b>
                          <label className="detail-field">
                            <span>Vendor</span>
                            <input value={detailVendor} onChange={(event) => setDetailVendor(event.target.value)} placeholder="e.g. HP" />
                          </label>
                          <label className="detail-field">
                            <span>Model</span>
                            <input value={detailModel} onChange={(event) => setDetailModel(event.target.value)} placeholder="e.g. LaserJet" />
                          </label>
                          <label className="detail-field">
                            <span>Total ports</span>
                            <input type="number" min={1} max={96} value={detailPortCount} onChange={(event) => setDetailPortCount(Number(event.target.value) || 1)} placeholder="e.g. 24" />
                          </label>
                          <button type="button" className="save-detail-button" onClick={saveSelectedDevice}>Save device</button>
                        </div>
                      )}
                      {selectedDevice && (
                        <div className="detail-message">
                          <b>Connection assignment</b>
                          <label className="detail-field">
                            <span>Connected device</span>
                            <select value={deviceAssignTarget} onChange={(event) => setDeviceAssignTarget(event.target.value)}>
                              <option value="">Attach to another node</option>
                              {assignableNodes.map((node) => (
                                <option key={node.id} value={node.id}>{node.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="detail-field">
                            <span>Connection medium</span>
                            <select value={deviceAssignMedium} onChange={(event) => setDeviceAssignMedium(event.target.value as typeof deviceAssignMedium)}>
                              <option value="ethernet">Ethernet</option>
                              <option value="fiber">Fiber</option>
                              <option value="wireless">Wireless</option>
                            </select>
                          </label>
                          <label className="detail-field">
                            <span>Selected device port</span>
                            <select value={deviceAssignSourcePort} onChange={(event) => setDeviceAssignSourcePort(event.target.value)}>
                              <option value="">Choose a port</option>
                              {selectedDevicePortOptions.map((port) => (
                                <option key={port} value={port}>{port}</option>
                              ))}
                            </select>
                          </label>
                          <label className="detail-field">
                            <span>Connected device port</span>
                            <input value={deviceAssignTargetPort} onChange={(event) => setDeviceAssignTargetPort(event.target.value)} placeholder="e.g. Gi1/0/24" />
                          </label>
                          <button type="button" onClick={assignDeviceToTarget}>
                            {selectedDeviceLinks.some(
                              (link) =>
                                (link.source === selectedNode && link.target === deviceAssignTarget) ||
                                (link.target === selectedNode && link.source === deviceAssignTarget),
                            ) ? "Update connection" : "Assign link"}
                          </button>
                        </div>
                      )}
                      {selectedDevice && selectedDeviceIpAllocations.length > 0 && (
                        <div className="detail-message">
                          <b>IP assignments</b>
                          <ul className="ip-list">
                            {selectedDeviceIpAllocations.map((allocation) => (
                              <li key={allocation.id}>
                                <strong>{allocation.address}</strong> · {allocation.subnet}
                                {allocation.description ? ` · ${allocation.description}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {detailTab === "ports" && (
                    <div className="port-panel">
                      <b>Port inventory</b>
                      <div className="port-grid">
                        {selectedPortInventory.map((port) => {
                          const associatedLink = selectedDeviceLinks.find(
                            (link) =>
                              (link.source === selectedNode && link.source_port === port) ||
                              (link.target === selectedNode && link.target_port === port),
                          );
                          const isAvailable = !selectedDevicePorts.includes(port);
                          return (
                            <div key={port} className={`port-chip ${isAvailable ? "available" : "used"}`}>
                              <span>{port}</span>
                              <small>
                                {associatedLink ? `${associatedLink.medium} link` : isAvailable ? "Available" : "Used"}
                              </small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="detail-message compact">
                        <b>Available ports</b>
                        <span>{availableDevicePorts.length > 0 ? availableDevicePorts.join(", ") : "No free ports remaining"}</span>
                      </div>
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
                          <small>{link.medium} · {link.operational_status ?? "up"}</small>
                          <button
                            type="button"
                            className="panel-icon"
                            title="Edit connection"
                            aria-label={`Edit ${link.source} to ${link.target} connection`}
                            onClick={() => selectTopologyEdge(`edge-${link.source}-${link.target}`)}
                          >
                            <Settings size={12} />
                          </button>
                        </div>
                      ))}
                  </div>
                </aside>
              </div>
              {activeStage === "TOPOLOGY" && <div className="bottom-strip topology-alerts">
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
                  <div className="alert-grid">
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
                </div>
              </div>}
            </>
          )}
          {controlMessage && (
            <div className="control-message" role="status">
              {controlMessage}
            </div>
          )}
        </section>
        <aside className="ai-side-panel" aria-label="AI operations assistant">
          <div className="ai-side-header">
            <div className="ai-side-title">
              <span className="ai-orbit"><Sparkles size={16} /></span>
              <div><b>AETHER AI</b><small>Project operations assistant</small></div>
            </div>
            <span className="ai-grounding"><span className="pulse" /> GROUNDED</span>
          </div>

          <section className="ai-insight-section">
            <div className="ai-section-title"><Activity size={14} /><b>CURRENT STATE</b></div>
            <div className="ai-state-grid">
              {visibleCurrentState.map((item, index) => (
                <div className="ai-state-row" key={item}><span>{index + 1}</span><p>{item}</p></div>
              ))}
            </div>
          </section>

          <section className="ai-insight-section">
            <div className="ai-section-title"><Lightbulb size={14} /><b>SUGGESTIONS</b></div>
            <div className="ai-suggestion-list">
              {visibleSuggestions.map((suggestion) => <p key={suggestion}>{suggestion}</p>)}
            </div>
          </section>

          {aiResponse && (
            <section className="ai-answer">
              <span>AI RESPONSE</span>
              <p>{aiResponse.answer}</p>
              <small>{aiResponse.grounded_node_count} nodes · {aiResponse.grounded_link_count} links · {aiResponse.cached ? "cached" : "fresh"}</small>
            </section>
          )}

          <section className="ai-insight-section ai-actions-section">
            <div className="ai-section-title"><Zap size={14} /><b>ACTIONS</b></div>
            <div className="ai-action-list">
              {visibleActions.map((action) => (
                <button key={action.id} type="button" onClick={() => runAIAction(action.id)}>
                  <span><b>{action.label}</b><small>{action.description}</small></span>
                  <ChevronDown size={14} />
                </button>
              ))}
            </div>
          </section>

          <div className="ai-quick-prompts">
            {["What needs attention?", "Assess current risk", "What should I do next?"].map((prompt) => (
              <button key={prompt} type="button" onClick={() => setAiQuery(prompt)}>{prompt}</button>
            ))}
          </div>
          <form className="ai-side-command" onSubmit={submitAIQuery}>
            <textarea
              id="ai-command"
              value={aiQuery}
              onChange={(event) => setAiQuery(event.target.value)}
              placeholder="Ask about this project..."
              rows={3}
            />
            <button disabled={aiLoading || !activeProjectId || !aiQuery.trim()}>
              <Sparkles size={14} /> {aiLoading ? "Analyzing..." : "Ask AETHER"}
            </button>
          </form>
          {aiError && <p className="ai-side-error">{aiError}</p>}
        </aside>
      </div>
      <footer className="statusbar">
        <span>
          PROJECT: <b>{displayedProjectName}</b>
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
