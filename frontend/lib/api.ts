const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "/api");

type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
    organization_id: string;
    role: "admin" | "tech" | "viewer";
  };
};

export type Project = {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  archived: boolean;
  created_at: string;
};

export type Topology = {
  nodes: { id: string; name: string; kind: "device" | "site" | "service"; vendor?: string | null; model?: string | null; port_count?: number | null; floorplan_x?: number; floorplan_y?: number }[];
  links: { source: string; target: string; medium: "fiber" | "ethernet" | "wireless"; source_port?: string | null; target_port?: string | null; operational_status?: "up" | "down" }[];
};

export type ConfigPreview = {
  vendor: "cisco_ios" | "mikrotik_routeros" | "fortinet_fortios";
  template_version: string;
  generated_config: string;
  ai_suggested: boolean;
};

export type AIQueryResponse = {
  answer: string;
  ai_suggested: boolean;
  grounded_node_count: number;
  grounded_link_count: number;
  cached: boolean;
  current_state: string[];
  suggestions: string[];
  actions: { id: string; label: string; description: string }[];
};

export type HelpdeskResponse = {
  answer: string;
  sources: string[];
  ai_suggested: boolean;
  cached: boolean;
};

export type PacketSimulation = {
  reachable: boolean;
  disposition: "delivered" | "blocked" | "unreachable";
  reason: string;
  protocol: "tcp" | "udp" | "icmp";
  port: number | null;
  source_ip: string | null;
  target_ip: string | null;
  total_latency_ms: number;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  enforcement_device_id: string | null;
  enforcement_device_name: string | null;
  hops: {
    device_id: string;
    name: string;
    vendor: string | null;
    model: string | null;
    ip_address: string | null;
    ingress_port: string | null;
    egress_port: string | null;
  }[];
};

export type Membership = {
  id: string;
  email: string;
  organization_id: string;
  role: "admin" | "tech" | "viewer";
};

export type IPAllocation = {
  id: string;
  address: string;
  subnet: string;
  description: string;
  device_id: string | null;
};

export type SecurityRule = {
  id: string;
  name: string;
  action: "allow" | "deny";
  protocol: "tcp" | "udp" | "icmp" | "any";
  source: string;
  destination: string;
  port: string;
  device_id: string | null;
};

export type ProjectTask = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "done";
  assignee: string;
  due_date: string;
};

export type InfrastructureAsset = {
  id: string;
  project_id: string;
  category: "camera" | "rack" | "power" | "wireless" | "cabling";
  name: string;
  status: "planned" | "active" | "warning" | "retired";
  location: string;
  details: string;
};

export async function authenticate(
  path: "/auth/login" | "/auth/register",
  payload: Record<string, string>,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Authentication failed");
  }
  return response.json();
}

export async function listProjects(token: string): Promise<Project[]> {
  const response = await fetch(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "Unable to load projects");
  return response.json();
}

export async function createProject(token: string, payload: { name: string; description: string }): Promise<Project> {
  const response = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "Unable to create project");
  return response.json();
}

export async function getTopology(token: string, projectId: string): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/topology`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to load topology");
  return response.json();
}

export async function saveTopology(token: string, projectId: string, topology: Topology): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/topology`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(topology),
  });
  if (!response.ok) throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "Unable to save topology");
  return response.json();
}

export async function createDevice(token: string, projectId: string, payload: { name: string; kind: "device" | "site" | "service"; vendor?: string; model?: string; port_count?: number }) {
  const response = await fetch(`${API_URL}/projects/${projectId}/devices`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Unable to create device");
  return response.json();
}

export async function deleteDevice(token: string, projectId: string, deviceId: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/devices/${deviceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to delete device");
}

export async function updateDevice(token: string, projectId: string, deviceId: string, payload: { name: string; kind: "device" | "site" | "service"; vendor?: string; model?: string; port_count?: number }) {
  const response = await fetch(`${API_URL}/projects/${projectId}/devices/${deviceId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to update device");
  }
  return response.json();
}

export async function createLink(token: string, projectId: string, payload: { source: string; target: string; medium: "fiber" | "ethernet" | "wireless"; source_port: string; target_port: string; operational_status?: "up" | "down" }): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Unable to create link");
  return response.json();
}

export async function updateLink(token: string, projectId: string, source: string, target: string, payload: { source: string; target: string; medium: "fiber" | "ethernet" | "wireless"; source_port: string; target_port: string; operational_status?: "up" | "down" }): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/links/${source}/${target}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Unable to update link");
  return response.json();
}

export async function deleteLink(token: string, projectId: string, source: string, target: string): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/links/${source}/${target}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to delete link");
  return response.json();
}

export async function uploadFloorplan(token: string, projectId: string, file: File): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/projects/${projectId}/floorplan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to upload floorplan");
  }
  return response.json();
}

export async function updateDevicePosition(token: string, projectId: string, deviceId: string, position: { floorplan_x: number; floorplan_y: number }): Promise<Topology> {
  const response = await fetch(`${API_URL}/projects/${projectId}/devices/${deviceId}/position`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(position),
  });
  if (!response.ok) throw new Error("Unable to save device position");
  return response.json();
}

export type ImportSummary = { imported: number; topology_nodes: number };

export async function importDevices(token: string, projectId: string, file: File, format: "csv" | "nmap"): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/projects/${projectId}/import/${format}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Unable to import ${format.toUpperCase()}`);
  }
  return response.json();
}

export async function exportProjectJson(token: string, projectId: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/projects/${projectId}/export/json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to export project");
  return response.blob();
}

export async function exportProjectPdf(token: string, projectId: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/projects/${projectId}/export/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to export project PDF");
  return response.blob();
}

export async function previewConfig(token: string, projectId: string, payload: { vendor: ConfigPreview["vendor"]; hostname: string; management_ip: string; vlan_id: number }): Promise<ConfigPreview> {
  const response = await fetch(`${API_URL}/projects/${projectId}/config/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Unable to generate config preview");
  return response.json();
}

export async function queryProjectAI(token: string, projectId: string, query: string): Promise<AIQueryResponse> {
  const response = await fetch(`${API_URL}/projects/${projectId}/ai/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error("Unable to query project AI");
  return response.json();
}

export async function queryHelpdesk(token: string, query: string): Promise<HelpdeskResponse> {
  const response = await fetch(`${API_URL}/ai/helpdesk`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(response.status === 401 ? "AUTH_REQUIRED" : detail?.detail ?? "Helpdesk is unavailable");
  }
  return response.json();
}

export async function simulatePacket(
  token: string,
  projectId: string,
  payload: {
    source_device_id: string;
    target_device_id: string;
    protocol: "tcp" | "udp" | "icmp";
    port: number | null;
  },
): Promise<PacketSimulation> {
  const response = await fetch(`${API_URL}/projects/${projectId}/simulate/packet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to run packet simulation");
  }
  return response.json();
}

export async function listMembers(token: string): Promise<Membership[]> {
  const response = await fetch(`${API_URL}/organization/members`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to load organization members");
  return response.json();
}

export async function updateMemberRole(token: string, memberId: string, role: Membership["role"]): Promise<Membership> {
  const response = await fetch(`${API_URL}/organization/members/${memberId}/role`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to update member role");
  }
  return response.json();
}

export async function listIpAllocations(token: string, projectId: string): Promise<IPAllocation[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/ip-allocations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to load IP allocations");
  return response.json();
}

export async function createIpAllocation(token: string, projectId: string, payload: { address: string; subnet: string; description: string; device_id?: string | null }): Promise<IPAllocation> {
  const response = await fetch(`${API_URL}/projects/${projectId}/ip-allocations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to create IP allocation");
  }
  return response.json();
}

export async function deleteIpAllocation(token: string, projectId: string, allocationId: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/ip-allocations/${allocationId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Unable to delete IP allocation");
  }
}

export async function listSecurityRules(token: string, projectId: string): Promise<SecurityRule[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/security-rules`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to load security rules");
  return response.json();
}

export async function createSecurityRule(token: string, projectId: string, payload: Omit<SecurityRule, "id" | "device_id"> & { device_id?: string | null }): Promise<SecurityRule> {
  const response = await fetch(`${API_URL}/projects/${projectId}/security-rules`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.detail ?? "Unable to create security rule"); }
  return response.json();
}

export async function deleteSecurityRule(token: string, projectId: string, ruleId: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/security-rules/${ruleId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to delete security rule");
}

export async function listTasks(token: string, projectId: string): Promise<ProjectTask[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to load tasks");
  return response.json();
}

export async function createTask(token: string, projectId: string, payload: Omit<ProjectTask, "id">): Promise<ProjectTask> {
  const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Unable to create task");
  return response.json();
}

export async function updateTask(token: string, projectId: string, taskId: string, payload: Omit<ProjectTask, "id">): Promise<ProjectTask> {
  const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Unable to update task");
  return response.json();
}

export async function deleteTask(token: string, projectId: string, taskId: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to delete task");
}

export async function listAssets(token: string, projectId: string, category: InfrastructureAsset["category"]): Promise<InfrastructureAsset[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/assets?category=${category}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to load assets");
  return response.json();
}

export async function createAsset(token: string, projectId: string, payload: Omit<InfrastructureAsset, "id" | "project_id">): Promise<InfrastructureAsset> {
  const response = await fetch(`${API_URL}/projects/${projectId}/assets`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Unable to create asset");
  return response.json();
}

export async function deleteAsset(token: string, projectId: string, assetId: string): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/assets/${assetId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to delete asset");
}
