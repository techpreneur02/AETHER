from datetime import datetime, timezone

from backend.core.store import SQLiteStore
from backend.models.project import ProjectResponse
from backend.models.topology import Topology

from backend.core.graph import TopologyGraph
from backend.models.topology import Topology


def test_graph_sync_preserves_topology_state() -> None:
    topology = Topology.model_validate(
        {
            "nodes": [
                {"id": "core-01", "name": "Core switch", "kind": "device"},
                {"id": "site-a", "name": "Site A", "kind": "site"},
            ],
            "links": [
                {"source": "core-01", "target": "site-a", "medium": "fiber"}
            ],
        }
    )
    graph = TopologyGraph()

    graph.sync(topology)

    assert graph.node_count() == 2
    assert graph.link_count() == 1
    assert graph.has_node("core-01")
    assert graph.snapshot() == topology


def test_topology_rejects_unknown_fields() -> None:
    try:
        Topology.model_validate({"nodes": [], "links": [], "unexpected": True})
    except ValueError:
        return

    raise AssertionError("Topology should reject unknown fields")


def test_sqlite_store_persists_graph_across_reboots(tmp_path) -> None:
    database_path = tmp_path / "aether.sqlite3"
    organization_id = "org-001"
    project = ProjectResponse(
        id="project-001",
        name="Persisted company audit",
        description="Network assessment",
        organization_id=organization_id,
        created_at=datetime.now(timezone.utc),
    )
    topology = Topology.model_validate(
        {
            "nodes": [
                {"id": "firewall-001", "name": "Firewall", "kind": "device"},
                {"id": "core-001", "name": "Core switch", "kind": "device"},
            ],
            "links": [{"source": "firewall-001", "target": "core-001", "medium": "fiber"}],
        }
    )

    first_store = SQLiteStore(str(database_path))
    first_store.save_project(project)
    assert first_store.save_topology(project.id, organization_id, topology) is True
    first_store.connection.close()

    rebooted_store = SQLiteStore(str(database_path))
    assert rebooted_store.get_project(project.id, organization_id) == project
    assert rebooted_store.get_topology(project.id, organization_id) == topology
    rebooted_store.connection.close()