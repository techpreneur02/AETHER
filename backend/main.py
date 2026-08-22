from datetime import datetime, timezone
import csv
import io
import json
import os
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware

from backend.core.security import create_access_token, decode_access_token, hash_password, verify_password
from backend.core.store import StoredUser, Store, create_store
from backend.models.auth import LoginRequest, TokenResponse, UserCreate, UserResponse
from backend.models.project import ProjectCreate, ProjectResponse
from backend.models.topology import Topology, TopologyNode
from backend.models.device import DeviceCreate, DeviceResponse
from backend.models.link import LinkCreate
from backend.models.position import PositionUpdate
from backend.models.import_job import ImportSummary, UniversalImportSummary
from backend.models.export import ProjectExport
from backend.models.config import ConfigPreviewRequest, ConfigPreviewResponse
from backend.models.ai import AIQueryRequest, AIQueryResponse, HelpdeskResponse
from backend.models.membership import MembershipResponse, RoleUpdate
from backend.models.ip_allocation import IPAllocationCreate, IPAllocationResponse
from backend.models.security_rule import SecurityRuleCreate, SecurityRuleResponse
from backend.models.task import TaskCreate, TaskResponse
from backend.models.asset import AssetCreate, AssetResponse
from backend.models.simulation import PacketSimulationRequest, PacketSimulationResponse
from backend.models.assessment import AssessmentEvaluation, ClientAssessment, DesignRequirements, NetworkDesign
from backend.core.ai import add_ai_design_narrative, answer_helpdesk_query, answer_query
from backend.core.config_generator import render_config
from backend.core.pdf_export import render_as_built_pdf
from backend.core.simulator import simulate_packet


store: Store = create_store()
bearer = HTTPBearer(auto_error=False)
app = FastAPI(title="AETHER-IT API", version="0.1.0")
UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "floorplans"
ALLOWED_FLOORPLAN_TYPES = {"image/png", "image/jpeg", "application/pdf"}
cors_origins = [origin.strip() for origin in os.getenv("AETHER_CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def user_response(user: StoredUser) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, organization_id=user.organization_id, role=user.role)  # type: ignore[arg-type]


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> StoredUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        claims = decode_access_token(credentials.credentials)
        user = store.get_user(claims["sub"])
    except (ValueError, KeyError, TypeError):
        user = None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication")
    return user


def editor_user(user: StoredUser = Depends(current_user)) -> StoredUser:
    if user.role not in {"admin", "tech"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write access required")
    return user


def admin_user(user: StoredUser = Depends(current_user)) -> StoredUser:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "aether-it-api",
        "storage": os.getenv("AETHER_STORAGE", "sqlite").lower(),
        "gemini": "configured" if os.getenv("GEMINI_API_KEY") else "unconfigured",
    }


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate) -> TokenResponse:
    email = str(payload.email).lower()
    if store.find_user_by_email(email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = StoredUser(str(uuid4()), email, hash_password(payload.password), str(uuid4()), "admin")
    store.save_user(user)
    return TokenResponse(access_token=create_access_token(user_id=user.id, organization_id=user.organization_id, role=user.role), user=user_response(user))


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    user = store.find_user_by_email(str(payload.email).lower())
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(user_id=user.id, organization_id=user.organization_id, role=user.role), user=user_response(user))


@app.get("/projects", response_model=list[ProjectResponse])
def list_projects(user: StoredUser = Depends(current_user)) -> list[ProjectResponse]:
    return store.list_projects(user.organization_id)


@app.get("/organization/members", response_model=list[MembershipResponse])
def list_members(user: StoredUser = Depends(current_user)) -> list[MembershipResponse]:
    return [MembershipResponse(id=member.id, email=member.email, organization_id=member.organization_id, role=member.role) for member in store.list_users(user.organization_id)]  # type: ignore[arg-type]


@app.patch("/organization/members/{member_id}/role", response_model=MembershipResponse)
def update_member_role(member_id: str, payload: RoleUpdate, user: StoredUser = Depends(admin_user)) -> MembershipResponse:
    member = store.get_user(member_id)
    if member is None or member.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.role == "admin" and payload.role != "admin":
        admins = [candidate for candidate in store.list_users(user.organization_id) if candidate.role == "admin"]
        if len(admins) <= 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization must retain an administrator")
    member.role = payload.role
    store.save_user(member)
    return MembershipResponse(id=member.id, email=member.email, organization_id=member.organization_id, role=member.role)  # type: ignore[arg-type]


@app.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: StoredUser = Depends(editor_user)) -> ProjectResponse:
    project = ProjectResponse(id=str(uuid4()), organization_id=user.organization_id, created_at=datetime.now(timezone.utc), **payload.model_dump())
    store.save_project(project)
    return project


@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, user: StoredUser = Depends(current_user)) -> ProjectResponse:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def evaluate_assessment(assessment: ClientAssessment) -> AssessmentEvaluation:
    maturity = assessment.documentation_quality + assessment.resilience + assessment.security + assessment.scalability
    evidence = min(len(assessment.security_controls), 4) + (2 if assessment.backup_status == "tested" else 1 if assessment.backup_status == "partial" else 0)
    score = min(100, round((maturity / 20) * 80 + (evidence / 6) * 20))
    grade = "critical" if score < 30 else "at_risk" if score < 50 else "developing" if score < 70 else "managed" if score < 90 else "optimized"
    strengths: list[str] = []
    gaps: list[str] = []
    recommendations: list[str] = []
    dimensions = {
        "Infrastructure documentation": assessment.documentation_quality,
        "Service resilience": assessment.resilience,
        "Security maturity": assessment.security,
        "Growth readiness": assessment.scalability,
    }
    for label, value in dimensions.items():
        (strengths if value >= 4 else gaps).append(f"{label}: {value}/5")
    if assessment.backup_status != "tested":
        gaps.append("Backups are not recorded as regularly tested")
        recommendations.append("Implement monitored backups and complete a documented restoration test.")
    if not assessment.security_controls:
        gaps.append("No security controls were recorded")
        recommendations.append("Document identity, firewall, endpoint, logging, and vulnerability controls.")
    if assessment.documentation_quality < 4:
        recommendations.append("Complete the device, link, port, IP, ownership, and dependency records in the digital twin.")
    if assessment.resilience < 4:
        recommendations.append("Remove single points of failure for internet, core switching, power, and critical services.")
    if assessment.scalability < 4:
        recommendations.append("Reserve addressing, switch capacity, wireless density, and uplink bandwidth for forecast growth.")
    if not recommendations:
        recommendations.append("Maintain quarterly evidence reviews and validate representative failover scenarios.")
    return AssessmentEvaluation(score=score, grade=grade, strengths=strengths, gaps=gaps, recommendations=recommendations[:6])


def build_network_design(requirements: DesignRequirements, assessment: ClientAssessment | None) -> NetworkDesign:
    vendors = requirements.preferred_vendors or ["Multi-vendor"]
    availability = {
        "standard": "Single edge with protected configuration backups",
        "high": "Dual WAN-ready edge and redundant core/distribution paths",
        "mission_critical": "Diverse carriers, firewall HA, dual core, and redundant power domains",
    }[requirements.availability_target]
    architecture = [availability, "Layered edge, core/distribution, access, and service zones"]
    if requirements.segmentation_required:
        architecture.append("VLAN and policy segmentation for users, servers, voice, guest, IoT, cameras, and management")
    if requirements.wireless_scope != "none":
        architecture.append(f"Controller-managed {requirements.wireless_scope} wireless with capacity-based AP placement")
    topology = ["Internet/SD-WAN -> security edge -> resilient core -> access switches -> endpoint and service zones"]
    if requirements.cloud_services or requirements.remote_users:
        topology.append("Identity-aware remote access and controlled cloud egress through the security edge")
    recommendations = [
        f"Design for {requirements.growth_percent}% growth without replacing the core platform.",
        f"Use {', '.join(vendors)} standards with documented lifecycle and support ownership.",
        "Validate application flows, failover, monitoring, backup, and rollback before handover.",
    ]
    if assessment:
        recommendations.extend(evaluate_assessment(assessment).recommendations[:3])
    vlan_lines = ["10 management", "20 corporate-users", "30 servers", "40 voice", "50 guest", "60 iot-cameras"] if requirements.segmentation_required else ["10 business-lan"]
    configurations = {
        "baseline": "\n".join(["hostname <site-role-id>", "ntp server <trusted-ntp>", "logging host <syslog-ip>", "aaa authentication centralized", "snmpv3 enable", "disable unused services"]),
        "segmentation": "\n".join(f"vlan {line}" for line in vlan_lines),
        "edge_policy": "default deny inbound\nallow established sessions\nallow required published services only\nlog denied traffic\nrestrict management to management VLAN",
    }
    narrative = f"Recommended {requirements.budget_band} design for {requirements.availability_target.replace('_', ' ')} availability, using {', '.join(vendors)} where practical."
    return NetworkDesign(requirements=requirements, architecture=architecture, topology_suggestions=topology, recommendations=recommendations[:8], configurations=configurations, ai_narrative=narrative)


@app.put("/projects/{project_id}/assessment", response_model=AssessmentEvaluation)
def save_client_assessment(project_id: str, payload: ClientAssessment, user: StoredUser = Depends(editor_user)) -> AssessmentEvaluation:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.client_assessment = payload
    store.update_project(project)
    return evaluate_assessment(payload)


@app.post("/projects/{project_id}/design", response_model=NetworkDesign)
async def generate_network_design(project_id: str, payload: DesignRequirements, user: StoredUser = Depends(editor_user)) -> NetworkDesign:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    design = await add_ai_design_narrative(build_network_design(payload, project.client_assessment), project.client_assessment)
    project.network_design = design
    store.update_project(project)
    return design


@app.get("/projects/{project_id}/topology", response_model=Topology, response_model_exclude_none=True)
def get_topology(project_id: str, user: StoredUser = Depends(current_user)) -> Topology:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return store.get_topology(project_id, user.organization_id) or Topology()


@app.get("/api/graph", response_model=Topology, response_model_exclude_none=True)
@app.get("/graph", response_model=Topology, response_model_exclude_none=True)
def get_graph(project_id: str, user: StoredUser = Depends(current_user)) -> Topology:
    return get_topology(project_id, user)


@app.put("/projects/{project_id}/topology", response_model=Topology, response_model_exclude_none=True)
def save_topology(project_id: str, topology: Topology, user: StoredUser = Depends(editor_user)) -> Topology:
    if not store.save_topology(project_id, user.organization_id, topology):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return topology


@app.put("/api/graph", response_model=Topology, response_model_exclude_none=True)
@app.put("/graph", response_model=Topology, response_model_exclude_none=True)
def save_graph(project_id: str, topology: Topology, user: StoredUser = Depends(editor_user)) -> Topology:
    return save_topology(project_id, topology, user)


@app.get("/api/dashboard")
@app.get("/dashboard")
def get_dashboard(project_id: str, user: StoredUser = Depends(current_user)) -> dict[str, Any]:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    return {
        "project": project,
        "nodes": topology.nodes,
        "links": topology.links,
        "node_count": len(topology.nodes),
        "link_count": len(topology.links),
        "task_count": len(store.list_tasks(project_id, user.organization_id)),
        "security_rule_count": len(store.list_security_rules(project_id, user.organization_id)),
        "ip_allocation_count": len(store.list_ip_allocations(project_id, user.organization_id)),
    }


@app.post("/projects/{project_id}/simulate/packet", response_model=PacketSimulationResponse)
def simulate_project_packet(
    project_id: str,
    payload: PacketSimulationRequest,
    user: StoredUser = Depends(current_user),
) -> PacketSimulationResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    return simulate_packet(
        topology,
        store.list_ip_allocations(project_id, user.organization_id),
        store.list_security_rules(project_id, user.organization_id),
        payload,
    )


@app.post("/projects/{project_id}/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(project_id: str, payload: DeviceCreate, user: StoredUser = Depends(editor_user)) -> DeviceResponse:
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    device_id = str(uuid4())
    topology.nodes.append(TopologyNode(id=device_id, **payload.model_dump()))
    store.save_topology(project_id, user.organization_id, topology)
    return DeviceResponse(id=device_id, **payload.model_dump())


@app.delete("/projects/{project_id}/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(project_id: str, device_id: str, user: StoredUser = Depends(editor_user)) -> None:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    if not any(node.id == device_id for node in topology.nodes):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    topology.nodes = [node for node in topology.nodes if node.id != device_id]
    topology.links = [link for link in topology.links if link.source != device_id and link.target != device_id]
    store.save_topology(project_id, user.organization_id, topology)


@app.patch("/projects/{project_id}/devices/{device_id}", response_model=DeviceResponse)
def update_device(project_id: str, device_id: str, payload: DeviceCreate, user: StoredUser = Depends(editor_user)) -> DeviceResponse:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    device = next((node for node in topology.nodes if node.id == device_id), None)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    device.name = payload.name
    device.kind = payload.kind
    device.vendor = payload.vendor
    device.model = payload.model
    store.save_topology(project_id, user.organization_id, topology)
    return DeviceResponse(id=device_id, **payload.model_dump())


@app.post("/projects/{project_id}/links", response_model=Topology, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
def create_link(project_id: str, payload: LinkCreate, user: StoredUser = Depends(editor_user)) -> Topology:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    node_ids = {node.id for node in topology.nodes}
    if payload.source not in node_ids or payload.target not in node_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Both link endpoints must be project devices")
    if payload.source == payload.target:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A device cannot link to itself")
    if any(
        (link.source == payload.source and link.target == payload.target)
        or (link.source == payload.target and link.target == payload.source)
        for link in topology.links
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A connection already exists between these devices")
    topology.links.append(payload)
    store.save_topology(project_id, user.organization_id, topology)
    return topology


@app.delete("/projects/{project_id}/links/{source}/{target}", response_model=Topology, response_model_exclude_none=True)
def delete_link(project_id: str, source: str, target: str, user: StoredUser = Depends(editor_user)) -> Topology:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    original_count = len(topology.links)
    topology.links = [link for link in topology.links if not (link.source == source and link.target == target)]
    if len(topology.links) == original_count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    store.save_topology(project_id, user.organization_id, topology)
    return topology


@app.patch("/projects/{project_id}/links/{source}/{target}", response_model=Topology, response_model_exclude_none=True)
def update_link(project_id: str, source: str, target: str, payload: LinkCreate, user: StoredUser = Depends(editor_user)) -> Topology:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    link = next((item for item in topology.links if item.source == source and item.target == target), None)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

    node_ids = {node.id for node in topology.nodes}
    if payload.source not in node_ids or payload.target not in node_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Both link endpoints must be project devices")
    if payload.source == payload.target:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A device cannot link to itself")

    candidate_pairs = {(payload.source, payload.target), (payload.target, payload.source)}
    if any(
        other is not link and ((other.source, other.target) in candidate_pairs or (other.target, other.source) in candidate_pairs)
        for other in topology.links
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A connection already exists between these devices")

    link.source = payload.source
    link.target = payload.target
    link.medium = payload.medium
    link.source_port = payload.source_port
    link.target_port = payload.target_port
    link.operational_status = payload.operational_status
    store.save_topology(project_id, user.organization_id, topology)
    return topology


@app.get("/projects/{project_id}/ip-allocations", response_model=list[IPAllocationResponse])
def list_ip_allocations(project_id: str, user: StoredUser = Depends(current_user)) -> list[IPAllocationResponse]:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return store.list_ip_allocations(project_id, user.organization_id)


@app.post("/projects/{project_id}/ip-allocations", response_model=IPAllocationResponse, status_code=status.HTTP_201_CREATED)
def create_ip_allocation(project_id: str, payload: IPAllocationCreate, user: StoredUser = Depends(editor_user)) -> IPAllocationResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    for existing in store.list_ip_allocations(project_id, user.organization_id):
        if existing.address == payload.address:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Address already allocated in this project")
    allocation = IPAllocationResponse(id=str(uuid4()), **payload.model_dump())
    store.save_ip_allocation(project_id, user.organization_id, allocation)
    return allocation


@app.delete("/projects/{project_id}/ip-allocations/{allocation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ip_allocation(project_id: str, allocation_id: str, user: StoredUser = Depends(editor_user)) -> None:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not store.delete_ip_allocation(project_id, user.organization_id, allocation_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found")


@app.get("/projects/{project_id}/security-rules", response_model=list[SecurityRuleResponse])
def list_security_rules(project_id: str, user: StoredUser = Depends(current_user)) -> list[SecurityRuleResponse]:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return store.list_security_rules(project_id, user.organization_id)


@app.post("/projects/{project_id}/security-rules", response_model=SecurityRuleResponse, status_code=status.HTTP_201_CREATED)
def create_security_rule(project_id: str, payload: SecurityRuleCreate, user: StoredUser = Depends(editor_user)) -> SecurityRuleResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    if payload.device_id and not any(node.id == payload.device_id for node in topology.nodes):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enforcement device must belong to the project topology")
    for existing in store.list_security_rules(project_id, user.organization_id):
        if (existing.source, existing.destination, existing.protocol, existing.port, existing.device_id) == (payload.source, payload.destination, payload.protocol, payload.port, payload.device_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An equivalent rule already exists")
    rule = SecurityRuleResponse(id=str(uuid4()), **payload.model_dump())
    store.save_security_rule(project_id, user.organization_id, rule)
    return rule


@app.delete("/projects/{project_id}/security-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_security_rule(project_id: str, rule_id: str, user: StoredUser = Depends(editor_user)) -> None:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not store.delete_security_rule(project_id, user.organization_id, rule_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Security rule not found")


@app.get("/projects/{project_id}/tasks", response_model=list[TaskResponse])
def list_tasks(project_id: str, user: StoredUser = Depends(current_user)) -> list[TaskResponse]:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return store.list_tasks(project_id, user.organization_id)


@app.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(project_id: str, payload: TaskCreate, user: StoredUser = Depends(editor_user)) -> TaskResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    task = TaskResponse(id=str(uuid4()), **payload.model_dump())
    store.save_task(project_id, user.organization_id, task)
    return task


@app.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(project_id: str, task_id: str, payload: TaskCreate, user: StoredUser = Depends(editor_user)) -> TaskResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    task = TaskResponse(id=task_id, **payload.model_dump())
    if not store.update_task(project_id, user.organization_id, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@app.delete("/projects/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(project_id: str, task_id: str, user: StoredUser = Depends(editor_user)) -> None:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not store.delete_task(project_id, user.organization_id, task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@app.get("/projects/{project_id}/assets", response_model=list[AssetResponse])
def list_assets(project_id: str, category: str | None = None, user: StoredUser = Depends(current_user)) -> list[AssetResponse]:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return store.list_assets(project_id, user.organization_id, category)


@app.post("/projects/{project_id}/assets", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(project_id: str, payload: AssetCreate, user: StoredUser = Depends(editor_user)) -> AssetResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    asset = AssetResponse(id=str(uuid4()), project_id=project_id, **payload.model_dump())
    store.save_asset(project_id, user.organization_id, asset)
    return asset


@app.delete("/projects/{project_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(project_id: str, asset_id: str, user: StoredUser = Depends(editor_user)) -> None:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not store.delete_asset(project_id, user.organization_id, asset_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")


@app.patch("/projects/{project_id}/devices/{device_id}/position", response_model=Topology, response_model_exclude_none=True)
def update_device_position(project_id: str, device_id: str, payload: PositionUpdate, user: StoredUser = Depends(editor_user)) -> Topology:
    topology = store.get_topology(project_id, user.organization_id)
    if topology is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project or topology not found")
    device = next((node for node in topology.nodes if node.id == device_id), None)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    device.floorplan_x = payload.floorplan_x
    device.floorplan_y = payload.floorplan_y
    store.save_topology(project_id, user.organization_id, topology)
    return topology


def normalize_inventory_row(row: dict[str, Any]) -> tuple[str, str, str | None, str | None]:
    lowered = {str(key).strip().lower(): value for key, value in row.items()}
    name = str(lowered.get("name") or lowered.get("hostname") or lowered.get("device") or lowered.get("asset") or lowered.get("ip") or lowered.get("address") or "").strip()
    kind = str(lowered.get("kind") or lowered.get("type") or lowered.get("category") or "device").strip().lower()
    kind = kind if kind in {"device", "site", "service"} else "device"
    vendor = str(lowered.get("vendor") or lowered.get("manufacturer") or "").strip() or None
    model = str(lowered.get("model") or lowered.get("product") or "").strip() or None
    return name, kind, vendor, model


def parse_universal_inventory(filename: str, content: bytes) -> tuple[str, list[tuple[str, str, str | None, str | None]], list[str]]:
    suffix = Path(filename).suffix.lower()
    warnings: list[str] = []
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("This binary file cannot be read as inventory evidence. Export it as CSV, JSON, XML, or plain text first.") from error
    rows: list[dict[str, Any]] = []
    source_format = suffix.lstrip(".") or "text"
    if suffix == ".json" or text.lstrip().startswith(("[", "{")):
        source_format = "json"
        document = json.loads(text)
        if isinstance(document, dict):
            document = document.get("devices") or document.get("nodes") or document.get("assets") or document.get("inventory") or [document]
        if not isinstance(document, list):
            raise ValueError("JSON inventory must be a list or contain devices, nodes, assets, or inventory")
        rows = [item for item in document if isinstance(item, dict)]
    elif suffix == ".xml" or text.lstrip().startswith("<"):
        source_format = "xml"
        root = ElementTree.fromstring(content)
        for element in root.findall(".//host") + root.findall(".//device") + root.findall(".//asset") + root.findall(".//node"):
            hostname = element.find("./hostnames/hostname")
            address = element.find("./address")
            rows.append({
                "name": element.get("name") or (hostname.get("name") if hostname is not None else None) or (address.get("addr") if address is not None else None) or element.findtext("name") or element.findtext("hostname") or element.findtext("address"),
                "kind": element.get("kind") or element.findtext("kind") or element.findtext("type"),
                "vendor": element.get("vendor") or element.findtext("vendor") or element.findtext("manufacturer"),
                "model": element.get("model") or element.findtext("model"),
            })
    elif suffix == ".csv" or ("," in text.splitlines()[0] if text.splitlines() else False):
        source_format = "csv"
        rows = list(csv.DictReader(io.StringIO(text)))
    else:
        source_format = "text"
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith(("#", ";", "//")):
                continue
            parts = [part.strip() for part in stripped.replace("|", ",").split(",")]
            rows.append({"name": parts[0], "kind": parts[1] if len(parts) > 1 else "device", "vendor": parts[2] if len(parts) > 2 else None, "model": parts[3] if len(parts) > 3 else None})
        warnings.append("Plain text was interpreted as one asset per line: name, kind, vendor, model.")
    normalized = [normalize_inventory_row(row) for row in rows]
    normalized = [row for row in normalized if row[0]]
    if not normalized:
        raise ValueError("No recognizable infrastructure records were found in this file")
    return source_format, normalized, warnings


@app.post("/projects/{project_id}/import/auto", response_model=UniversalImportSummary)
async def import_infrastructure_auto(project_id: str, file: UploadFile = File(...), user: StoredUser = Depends(editor_user)) -> UniversalImportSummary:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Infrastructure evidence must be 10 MB or smaller")
    try:
        source_format, records, warnings = parse_universal_inventory(file.filename or "inventory.txt", content)
    except (ValueError, json.JSONDecodeError, ElementTree.ParseError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    known_names = {node.name.strip().casefold() for node in topology.nodes}
    imported = 0
    skipped = 0
    for name, kind, vendor, model in records:
        if name.casefold() in known_names:
            skipped += 1
            continue
        topology.nodes.append(TopologyNode(id=str(uuid4()), name=name, kind=kind, vendor=vendor, model=model))  # type: ignore[arg-type]
        known_names.add(name.casefold())
        imported += 1
    store.save_topology(project_id, user.organization_id, topology)
    return UniversalImportSummary(imported=imported, skipped=skipped, topology_nodes=len(topology.nodes), source_format=source_format, warnings=warnings)


@app.post("/projects/{project_id}/import/csv", response_model=ImportSummary)
async def import_devices_csv(project_id: str, file: UploadFile = File(...), user: StoredUser = Depends(editor_user)) -> ImportSummary:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    if file.content_type not in {"text/csv", "application/vnd.ms-excel", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Import must be a CSV file")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="CSV must be 5 MB or smaller")
    try:
        rows = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        if not rows.fieldnames or "name" not in rows.fieldnames:
            raise ValueError("CSV must include a name column")
        imported = 0
        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                raise ValueError("Every CSV row must include a name")
            kind = (row.get("kind") or "device").strip()
            if kind not in {"device", "site", "service"}:
                raise ValueError(f"Unsupported device kind: {kind}")
            topology.nodes.append(TopologyNode(id=str(uuid4()), name=name, kind=kind, vendor=(row.get("vendor") or "").strip(), model=(row.get("model") or "").strip()))  # type: ignore[arg-type]
            imported += 1
    except (UnicodeDecodeError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    store.save_topology(project_id, user.organization_id, topology)
    return ImportSummary(imported=imported, topology_nodes=len(topology.nodes))


@app.post("/projects/{project_id}/import/nmap", response_model=ImportSummary)
async def import_nmap_xml(project_id: str, file: UploadFile = File(...), user: StoredUser = Depends(editor_user)) -> ImportSummary:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if file.content_type not in {"application/xml", "text/xml", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Import must be an Nmap XML file")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Nmap XML must be 10 MB or smaller")
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid Nmap XML") from error
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    imported = 0
    for host in root.findall(".//host"):
        hostname = host.find("./hostnames/hostname")
        address = host.find("./address")
        name = (hostname.get("name") if hostname is not None else None) or (address.get("addr") if address is not None else None)
        if not name:
            continue
        topology.nodes.append(TopologyNode(id=str(uuid4()), name=name, kind="device"))
        imported += 1
    store.save_topology(project_id, user.organization_id, topology)
    return ImportSummary(imported=imported, topology_nodes=len(topology.nodes))


@app.get("/projects/{project_id}/export/json", response_model=ProjectExport)
def export_project_json(project_id: str, user: StoredUser = Depends(current_user)) -> ProjectExport:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectExport(project=project, topology=store.get_topology(project_id, user.organization_id) or Topology())


@app.get("/projects/{project_id}/export/pdf")
def export_project_pdf(project_id: str, user: StoredUser = Depends(current_user)) -> Response:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    pdf = render_as_built_pdf(project, topology)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{project.id}-as-built.pdf"'})


@app.post("/projects/{project_id}/config/preview", response_model=ConfigPreviewResponse)
def preview_config(project_id: str, payload: ConfigPreviewRequest, user: StoredUser = Depends(current_user)) -> ConfigPreviewResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ConfigPreviewResponse(vendor=payload.vendor, template_version="1.0.0", generated_config=render_config(payload), ai_suggested=False)


@app.post("/projects/{project_id}/ai/query", response_model=AIQueryResponse)
async def query_project_ai(project_id: str, payload: AIQueryRequest, user: StoredUser = Depends(current_user)) -> AIQueryResponse:
    if store.get_project(project_id, user.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    topology = store.get_topology(project_id, user.organization_id) or Topology()
    return await answer_query(
        payload.query,
        topology,
        len(store.list_ip_allocations(project_id, user.organization_id)),
        len(store.list_security_rules(project_id, user.organization_id)),
    )


@app.post("/ai/helpdesk", response_model=HelpdeskResponse)
async def query_helpdesk(payload: AIQueryRequest, user: StoredUser = Depends(current_user)) -> HelpdeskResponse:
    return await answer_helpdesk_query(payload.query)


@app.post("/projects/{project_id}/floorplan", response_model=ProjectResponse)
async def upload_floorplan(project_id: str, file: UploadFile = File(...), user: StoredUser = Depends(editor_user)) -> ProjectResponse:
    project = store.get_project(project_id, user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if file.content_type not in ALLOWED_FLOORPLAN_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Floorplan must be PNG, JPEG, or PDF")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Floorplan must be 10 MB or smaller")
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    suffix = ".pdf" if file.content_type == "application/pdf" else ".png" if file.content_type == "image/png" else ".jpg"
    destination = UPLOAD_ROOT / f"{project_id}{suffix}"
    destination.write_bytes(content)
    project.floorplan_path = str(destination.relative_to(UPLOAD_ROOT.parent.parent))
    project.floorplan_content_type = file.content_type
    store.update_project(project)
    return project
