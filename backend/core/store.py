from dataclasses import dataclass
import json
import sqlite3
from typing import Any, Protocol

from backend.models.project import ProjectResponse
from backend.models.topology import Topology
from backend.models.ip_allocation import IPAllocationResponse
from backend.models.security_rule import SecurityRuleResponse
from backend.models.task import TaskResponse
from backend.models.asset import AssetResponse


@dataclass
class StoredUser:
    id: str
    email: str
    password_hash: str
    organization_id: str
    role: str


class Store(Protocol):
    def reset(self) -> None: ...
    def find_user_by_email(self, email: str) -> StoredUser | None: ...
    def get_user(self, user_id: str) -> StoredUser | None: ...
    def save_user(self, user: StoredUser) -> None: ...
    def list_users(self, organization_id: str) -> list[StoredUser]: ...
    def list_projects(self, organization_id: str) -> list[ProjectResponse]: ...
    def get_project(self, project_id: str, organization_id: str) -> ProjectResponse | None: ...
    def save_project(self, project: ProjectResponse) -> None: ...
    def update_project(self, project: ProjectResponse) -> None: ...
    def get_topology(self, project_id: str, organization_id: str) -> Topology | None: ...
    def save_topology(self, project_id: str, organization_id: str, topology: Topology) -> bool: ...
    def list_ip_allocations(self, project_id: str, organization_id: str) -> list[IPAllocationResponse]: ...
    def save_ip_allocation(self, project_id: str, organization_id: str, allocation: IPAllocationResponse) -> bool: ...
    def delete_ip_allocation(self, project_id: str, organization_id: str, allocation_id: str) -> bool: ...
    def list_security_rules(self, project_id: str, organization_id: str) -> list[SecurityRuleResponse]: ...
    def save_security_rule(self, project_id: str, organization_id: str, rule: SecurityRuleResponse) -> bool: ...
    def delete_security_rule(self, project_id: str, organization_id: str, rule_id: str) -> bool: ...
    def list_tasks(self, project_id: str, organization_id: str) -> list[TaskResponse]: ...
    def save_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool: ...
    def update_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool: ...
    def delete_task(self, project_id: str, organization_id: str, task_id: str) -> bool: ...
    def list_assets(self, project_id: str, organization_id: str, category: str | None = None) -> list[AssetResponse]: ...
    def save_asset(self, project_id: str, organization_id: str, asset: AssetResponse) -> bool: ...
    def delete_asset(self, project_id: str, organization_id: str, asset_id: str) -> bool: ...


class MemoryStore:
    def __init__(self) -> None:
        self.users: dict[str, StoredUser] = {}
        self.projects: dict[str, ProjectResponse] = {}
        self.topologies: dict[str, Topology] = {}
        self.ip_allocations: dict[str, list[IPAllocationResponse]] = {}
        self.security_rules: dict[str, list[SecurityRuleResponse]] = {}
        self.tasks: dict[str, list[TaskResponse]] = {}
        self.assets: dict[str, list[AssetResponse]] = {}

    def reset(self) -> None:
        self.users.clear()
        self.projects.clear()
        self.topologies.clear()
        self.ip_allocations.clear()
        self.security_rules.clear()
        self.tasks.clear()
        self.assets.clear()

    def find_user_by_email(self, email: str) -> StoredUser | None:
        return next((user for user in self.users.values() if user.email == email), None)

    def get_user(self, user_id: str) -> StoredUser | None:
        return self.users.get(user_id)

    def save_user(self, user: StoredUser) -> None:
        self.users[user.id] = user

    def list_users(self, organization_id: str) -> list[StoredUser]:
        return [user for user in self.users.values() if user.organization_id == organization_id]

    def list_projects(self, organization_id: str) -> list[ProjectResponse]:
        return [project for project in self.projects.values() if project.organization_id == organization_id]

    def get_project(self, project_id: str, organization_id: str) -> ProjectResponse | None:
        project = self.projects.get(project_id)
        return project if project and project.organization_id == organization_id else None

    def save_project(self, project: ProjectResponse) -> None:
        self.projects[project.id] = project

    def update_project(self, project: ProjectResponse) -> None:
        self.projects[project.id] = project

    def get_topology(self, project_id: str, organization_id: str) -> Topology | None:
        project = self.get_project(project_id, organization_id)
        return self.topologies.get(project_id) if project else None

    def save_topology(self, project_id: str, organization_id: str, topology: Topology) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.topologies[project_id] = topology
        return True

    def list_ip_allocations(self, project_id: str, organization_id: str) -> list[IPAllocationResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        return self.ip_allocations.get(project_id, [])

    def save_ip_allocation(self, project_id: str, organization_id: str, allocation: IPAllocationResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.ip_allocations.setdefault(project_id, []).append(allocation)
        return True

    def delete_ip_allocation(self, project_id: str, organization_id: str, allocation_id: str) -> bool:
        allocations = self.ip_allocations.get(project_id, [])
        remaining = [allocation for allocation in allocations if allocation.id != allocation_id]
        if len(remaining) == len(allocations):
            return False
        self.ip_allocations[project_id] = remaining
        return True

    def list_security_rules(self, project_id: str, organization_id: str) -> list[SecurityRuleResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        return self.security_rules.get(project_id, [])

    def save_security_rule(self, project_id: str, organization_id: str, rule: SecurityRuleResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.security_rules.setdefault(project_id, []).append(rule)
        return True

    def delete_security_rule(self, project_id: str, organization_id: str, rule_id: str) -> bool:
        rules = self.security_rules.get(project_id, [])
        remaining = [rule for rule in rules if rule.id != rule_id]
        if len(remaining) == len(rules):
            return False
        self.security_rules[project_id] = remaining
        return True

    def list_tasks(self, project_id: str, organization_id: str) -> list[TaskResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        return self.tasks.get(project_id, [])

    def save_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.tasks.setdefault(project_id, []).append(task)
        return True

    def update_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        tasks = self.tasks.get(project_id, [])
        for index, current in enumerate(tasks):
            if current.id == task.id:
                tasks[index] = task
                return True
        return False

    def delete_task(self, project_id: str, organization_id: str, task_id: str) -> bool:
        tasks = self.tasks.get(project_id, [])
        remaining = [task for task in tasks if task.id != task_id]
        if len(remaining) == len(tasks):
            return False
        self.tasks[project_id] = remaining
        return True

    def list_assets(self, project_id: str, organization_id: str, category: str | None = None) -> list[AssetResponse]:
        assets = self.assets.get(project_id, []) if self.get_project(project_id, organization_id) else []
        return [asset for asset in assets if category is None or asset.category == category]

    def save_asset(self, project_id: str, organization_id: str, asset: AssetResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.assets.setdefault(project_id, []).append(asset)
        return True

    def delete_asset(self, project_id: str, organization_id: str, asset_id: str) -> bool:
        assets = self.assets.get(project_id, [])
        remaining = [asset for asset in assets if asset.id != asset_id]
        if len(remaining) == len(assets):
            return False
        self.assets[project_id] = remaining
        return True


class SQLiteStore(MemoryStore):
    """SQLite-backed store with an in-memory cache rehydrated on every process start."""

    def __init__(self, database_path: str) -> None:
        super().__init__()
        self.database_path = database_path
        self.connection = sqlite3.connect(database_path, check_same_thread=False)
        self.connection.execute("CREATE TABLE IF NOT EXISTS aether_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.connection.commit()
        self._load()

    def _load(self) -> None:
        values = dict(self.connection.execute("SELECT key, value FROM aether_state"))
        for document in json.loads(values.get("users", "[]")):
            self.users[document["id"]] = StoredUser(**document)
        for document in json.loads(values.get("projects", "[]")):
            project = ProjectResponse.model_validate(document)
            self.projects[project.id] = project
        for project_id, document in json.loads(values.get("topologies", "{}" )).items():
            self.topologies[project_id] = Topology.model_validate(document)
        for project_id, documents in json.loads(values.get("ip_allocations", "{}" )).items():
            self.ip_allocations[project_id] = [IPAllocationResponse.model_validate(document) for document in documents]
        for project_id, documents in json.loads(values.get("security_rules", "{}" )).items():
            self.security_rules[project_id] = [SecurityRuleResponse.model_validate(document) for document in documents]
        for project_id, documents in json.loads(values.get("tasks", "{}" )).items():
            self.tasks[project_id] = [TaskResponse.model_validate(document) for document in documents]
        for project_id, documents in json.loads(values.get("assets", "{}" )).items():
            self.assets[project_id] = [AssetResponse.model_validate(document) for document in documents]

    def _persist(self) -> None:
        values = {
            "users": [user.__dict__ for user in self.users.values()],
            "projects": [project.model_dump(mode="json") for project in self.projects.values()],
            "topologies": {project_id: topology.model_dump(mode="json") for project_id, topology in self.topologies.items()},
            "ip_allocations": {project_id: [allocation.model_dump(mode="json") for allocation in values] for project_id, values in self.ip_allocations.items()},
            "security_rules": {project_id: [rule.model_dump(mode="json") for rule in values] for project_id, values in self.security_rules.items()},
            "tasks": {project_id: [task.model_dump(mode="json") for task in values] for project_id, values in self.tasks.items()},
            "assets": {project_id: [asset.model_dump(mode="json") for asset in values] for project_id, values in self.assets.items()},
        }
        self.connection.executemany("INSERT INTO aether_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [(key, json.dumps(value)) for key, value in values.items()])
        self.connection.commit()

    def reset(self) -> None:
        super().reset()
        self._persist()

    def save_user(self, user: StoredUser) -> None:
        super().save_user(user)
        self._persist()

    def save_project(self, project: ProjectResponse) -> None:
        super().save_project(project)
        self._persist()

    def update_project(self, project: ProjectResponse) -> None:
        super().update_project(project)
        self._persist()

    def save_topology(self, project_id: str, organization_id: str, topology: Topology) -> bool:
        saved = super().save_topology(project_id, organization_id, topology)
        if saved:
            self._persist()
        return saved

    def save_ip_allocation(self, project_id: str, organization_id: str, allocation: IPAllocationResponse) -> bool:
        saved = super().save_ip_allocation(project_id, organization_id, allocation)
        if saved:
            self._persist()
        return saved

    def delete_ip_allocation(self, project_id: str, organization_id: str, allocation_id: str) -> bool:
        deleted = super().delete_ip_allocation(project_id, organization_id, allocation_id)
        if deleted:
            self._persist()
        return deleted

    def save_security_rule(self, project_id: str, organization_id: str, rule: SecurityRuleResponse) -> bool:
        saved = super().save_security_rule(project_id, organization_id, rule)
        if saved:
            self._persist()
        return saved

    def delete_security_rule(self, project_id: str, organization_id: str, rule_id: str) -> bool:
        deleted = super().delete_security_rule(project_id, organization_id, rule_id)
        if deleted:
            self._persist()
        return deleted

    def save_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        saved = super().save_task(project_id, organization_id, task)
        if saved:
            self._persist()
        return saved

    def update_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        updated = super().update_task(project_id, organization_id, task)
        if updated:
            self._persist()
        return updated

    def delete_task(self, project_id: str, organization_id: str, task_id: str) -> bool:
        deleted = super().delete_task(project_id, organization_id, task_id)
        if deleted:
            self._persist()
        return deleted

    def save_asset(self, project_id: str, organization_id: str, asset: AssetResponse) -> bool:
        saved = super().save_asset(project_id, organization_id, asset)
        if saved:
            self._persist()
        return saved

    def delete_asset(self, project_id: str, organization_id: str, asset_id: str) -> bool:
        deleted = super().delete_asset(project_id, organization_id, asset_id)
        if deleted:
            self._persist()
        return deleted


class MongoStore:
    def __init__(self, url: str, database_name: str) -> None:
        from pymongo import MongoClient

        self.client = MongoClient(url, serverSelectionTimeoutMS=5000)
        database = self.client[database_name]
        self.database = database
        self.users = database.users
        self.projects = database.projects
        self.users.create_index("email", unique=True)
        self.projects.create_index("organization_id")
        self.assets = database.assets
        self.projects.create_index("organization_id")

    def reset(self) -> None:
        self.users.delete_many({})
        self.projects.delete_many({})
        self.database.ip_allocations.delete_many({})
        self.database.security_rules.delete_many({})
        self.database.tasks.delete_many({})
        self.database.assets.delete_many({})

    @staticmethod
    def _user(document: dict[str, Any]) -> StoredUser:
        return StoredUser(document["_id"], document["email"], document["password_hash"], document["organization_id"], document["role"])

    @staticmethod
    def _project(document: dict[str, Any]) -> ProjectResponse:
        return ProjectResponse(id=document["_id"], name=document["name"], description=document.get("description", ""), organization_id=document["organization_id"], archived=document.get("archived", False), created_at=document["created_at"], floorplan_path=document.get("floorplan_path"), floorplan_content_type=document.get("floorplan_content_type"), client_assessment=document.get("client_assessment"), network_design=document.get("network_design"))

    def find_user_by_email(self, email: str) -> StoredUser | None:
        document = self.users.find_one({"email": email})
        return self._user(document) if document else None

    def get_user(self, user_id: str) -> StoredUser | None:
        document = self.users.find_one({"_id": user_id})
        return self._user(document) if document else None

    def save_user(self, user: StoredUser) -> None:
        self.users.insert_one({"_id": user.id, "email": user.email, "password_hash": user.password_hash, "organization_id": user.organization_id, "role": user.role})

    def list_users(self, organization_id: str) -> list[StoredUser]:
        return [self._user(document) for document in self.users.find({"organization_id": organization_id})]

    def list_projects(self, organization_id: str) -> list[ProjectResponse]:
        return [self._project(document) for document in self.projects.find({"organization_id": organization_id})]

    def get_project(self, project_id: str, organization_id: str) -> ProjectResponse | None:
        document = self.projects.find_one({"_id": project_id, "organization_id": organization_id})
        return self._project(document) if document else None

    def save_project(self, project: ProjectResponse) -> None:
        self.projects.insert_one(project.model_dump() | {"_id": project.id})

    def update_project(self, project: ProjectResponse) -> None:
        self.projects.replace_one({"_id": project.id, "organization_id": project.organization_id}, project.model_dump() | {"_id": project.id})

    def get_topology(self, project_id: str, organization_id: str) -> Topology | None:
        from backend.models.topology import Topology

        document = self.database.topologies.find_one({"_id": project_id, "organization_id": organization_id})
        return Topology.model_validate(document["topology"]) if document else None

    def save_topology(self, project_id: str, organization_id: str, topology: Topology) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.database.topologies.replace_one(
            {"_id": project_id, "organization_id": organization_id},
            {"_id": project_id, "organization_id": organization_id, "topology": topology.model_dump()},
            upsert=True,
        )
        return True

    def list_ip_allocations(self, project_id: str, organization_id: str) -> list[IPAllocationResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        documents = self.database.ip_allocations.find({"project_id": project_id, "organization_id": organization_id})
        return [IPAllocationResponse(id=document["_id"], address=document["address"], subnet=document["subnet"], description=document.get("description", ""), device_id=document.get("device_id")) for document in documents]

    def save_ip_allocation(self, project_id: str, organization_id: str, allocation: IPAllocationResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.database.ip_allocations.insert_one(allocation.model_dump() | {"_id": allocation.id, "project_id": project_id, "organization_id": organization_id})
        return True

    def delete_ip_allocation(self, project_id: str, organization_id: str, allocation_id: str) -> bool:
        result = self.database.ip_allocations.delete_one({"_id": allocation_id, "project_id": project_id, "organization_id": organization_id})
        return result.deleted_count > 0

    def list_security_rules(self, project_id: str, organization_id: str) -> list[SecurityRuleResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        documents = self.database.security_rules.find({"project_id": project_id, "organization_id": organization_id})
        return [SecurityRuleResponse(id=document["_id"], name=document["name"], action=document["action"], protocol=document["protocol"], source=document["source"], destination=document["destination"], port=document.get("port", "any")) for document in documents]

    def save_security_rule(self, project_id: str, organization_id: str, rule: SecurityRuleResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.database.security_rules.insert_one(rule.model_dump() | {"_id": rule.id, "project_id": project_id, "organization_id": organization_id})
        return True

    def delete_security_rule(self, project_id: str, organization_id: str, rule_id: str) -> bool:
        result = self.database.security_rules.delete_one({"_id": rule_id, "project_id": project_id, "organization_id": organization_id})
        return result.deleted_count > 0

    def list_tasks(self, project_id: str, organization_id: str) -> list[TaskResponse]:
        if self.get_project(project_id, organization_id) is None:
            return []
        documents = self.database.tasks.find({"project_id": project_id, "organization_id": organization_id})
        return [TaskResponse(id=document["_id"], title=document["title"], priority=document["priority"], status=document["status"], assignee=document.get("assignee", ""), due_date=document.get("due_date", "")) for document in documents]

    def save_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.database.tasks.insert_one(task.model_dump() | {"_id": task.id, "project_id": project_id, "organization_id": organization_id})
        return True

    def update_task(self, project_id: str, organization_id: str, task: TaskResponse) -> bool:
        result = self.database.tasks.replace_one({"_id": task.id, "project_id": project_id, "organization_id": organization_id}, task.model_dump() | {"_id": task.id, "project_id": project_id, "organization_id": organization_id})
        return result.matched_count > 0

    def delete_task(self, project_id: str, organization_id: str, task_id: str) -> bool:
        result = self.database.tasks.delete_one({"_id": task_id, "project_id": project_id, "organization_id": organization_id})
        return result.deleted_count > 0

    def list_assets(self, project_id: str, organization_id: str, category: str | None = None) -> list[AssetResponse]:
        query: dict[str, Any] = {"project_id": project_id, "organization_id": organization_id}
        if category:
            query["category"] = category
        return [AssetResponse.model_validate(document | {"id": document["_id"]}) for document in self.assets.find(query)]

    def save_asset(self, project_id: str, organization_id: str, asset: AssetResponse) -> bool:
        if self.get_project(project_id, organization_id) is None:
            return False
        self.assets.insert_one(asset.model_dump() | {"_id": asset.id, "organization_id": organization_id})
        return True

    def delete_asset(self, project_id: str, organization_id: str, asset_id: str) -> bool:
        result = self.assets.delete_one({"_id": asset_id, "project_id": project_id, "organization_id": organization_id})
        return result.deleted_count > 0


def create_store() -> Store:
    import os

    storage = os.getenv("AETHER_STORAGE", "sqlite").lower()
    if storage == "sqlite":
        return SQLiteStore(os.getenv("AETHER_SQLITE_PATH", "aether_it.sqlite3"))
    if storage == "mongo":
        return MongoStore(os.getenv("MONGODB_URL", "mongodb://localhost:27017"), os.getenv("MONGODB_DATABASE", "aether_it"))
    return MemoryStore()