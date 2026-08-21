from datetime import datetime, timezone
import csv
import io
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
from backend.models.import_job import ImportSummary
from backend.models.export import ProjectExport
from backend.models.config import ConfigPreviewRequest, ConfigPreviewResponse
from backend.models.ai import AIQueryRequest, AIQueryResponse
from backend.models.membership import MembershipResponse, RoleUpdate
from backend.models.ip_allocation import IPAllocationCreate, IPAllocationResponse
from backend.models.security_rule import SecurityRuleCreate, SecurityRuleResponse
from backend.models.task import TaskCreate, TaskResponse
from backend.models.asset import AssetCreate, AssetResponse
from backend.core.ai import answer_query
from backend.core.config_generator import render_config
from backend.core.pdf_export import render_as_built_pdf


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
    if any(
        ((other.source == payload.source and other.target == payload.target) or (other.source == payload.target and other.target == payload.source))
        and not (other.source == source and other.target == target)
        for other in topology.links
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A connection already exists between these devices")
    link.medium = payload.medium
    link.source_port = payload.source_port
    link.target_port = payload.target_port
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
    for existing in store.list_security_rules(project_id, user.organization_id):
        if (existing.source, existing.destination, existing.protocol, existing.port) == (payload.source, payload.destination, payload.protocol, payload.port):
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
    return await answer_query(payload.query, topology)


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
