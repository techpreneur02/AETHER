from datetime import datetime, timezone
import asyncio

from backend.core.store import SQLiteStore
from backend.models.project import ProjectResponse
from backend.models.topology import Topology
from backend.core.simulator import simulate_packet
from backend.core.ai import answer_query
from backend.models.ip_allocation import IPAllocationResponse
from backend.models.security_rule import SecurityRuleResponse
from backend.models.simulation import PacketSimulationRequest

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


def test_ai_guidance_returns_state_suggestions_and_safe_actions(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    topology = Topology.model_validate({
        "nodes": [
            {"id": "firewall", "name": "Firewall", "kind": "device"},
            {"id": "server", "name": "Server", "kind": "service"},
        ],
        "links": [],
    })

    result = asyncio.run(answer_query("What needs attention?", topology))

    assert result.current_state == [
        "2 devices and 0 recorded links",
        "0 links down and 2 isolated devices",
        "0 IP allocations and 0 security rules",
    ]
    assert any("isolated" in suggestion for suggestion in result.suggestions)
    assert {action.id for action in result.actions} == {"open_topology", "open_ipam", "open_security"}


def test_packet_simulation_returns_weighted_port_aware_path() -> None:
    topology = Topology.model_validate({
        "nodes": [
            {"id": "pc", "name": "User PC", "kind": "device", "vendor": "Dell"},
            {"id": "switch", "name": "Access Switch", "kind": "device", "vendor": "Aruba"},
            {"id": "server", "name": "Application Server", "kind": "service", "vendor": "HPE"},
        ],
        "links": [
            {"source": "pc", "target": "switch", "medium": "ethernet", "source_port": "Eth0", "target_port": "Gi1/0/7"},
            {"source": "switch", "target": "server", "medium": "fiber", "source_port": "SFP1", "target_port": "NIC1"},
        ],
    })
    allocations = [
        IPAllocationResponse(id="ip-1", address="10.0.10.20", subnet="10.0.10.0/24", device_id="pc"),
        IPAllocationResponse(id="ip-2", address="10.0.50.10", subnet="10.0.50.0/24", device_id="server"),
    ]

    result = simulate_packet(
        topology,
        allocations,
        [],
        PacketSimulationRequest(source_device_id="pc", target_device_id="server", protocol="tcp", port=443),
    )

    assert result.disposition == "delivered"
    assert result.reachable is True
    assert result.total_latency_ms == 0.7
    assert [hop.device_id for hop in result.hops] == ["pc", "switch", "server"]
    assert result.hops[1].ingress_port == "Gi1/0/7"
    assert result.hops[1].egress_port == "SFP1"


def test_packet_simulation_reports_matching_deny_rule() -> None:
    topology = Topology.model_validate({
        "nodes": [
            {"id": "guest", "name": "Guest Client", "kind": "device"},
            {"id": "server", "name": "Server", "kind": "service"},
        ],
        "links": [
            {"source": "guest", "target": "server", "medium": "wireless", "source_port": "WLAN", "target_port": "NIC1"},
        ],
    })
    allocations = [
        IPAllocationResponse(id="ip-1", address="172.16.90.20", subnet="172.16.90.0/24", device_id="guest"),
        IPAllocationResponse(id="ip-2", address="10.0.50.10", subnet="10.0.50.0/24", device_id="server"),
    ]
    rules = [SecurityRuleResponse(
        id="rule-1",
        name="Block guest SSH",
        action="deny",
        protocol="tcp",
        source="172.16.90.0/24",
        destination="10.0.50.0/24",
        port="22",
    )]

    result = simulate_packet(
        topology,
        allocations,
        rules,
        PacketSimulationRequest(source_device_id="guest", target_device_id="server", protocol="tcp", port=22),
    )

    assert result.disposition == "blocked"
    assert result.reachable is False
    assert result.matched_rule_id == "rule-1"
    assert len(result.hops) == 2


def test_packet_simulation_excludes_down_links() -> None:
    topology = Topology.model_validate({
        "nodes": [
            {"id": "client", "name": "Client", "kind": "device"},
            {"id": "switch", "name": "Switch", "kind": "device"},
            {"id": "server", "name": "Server", "kind": "service"},
        ],
        "links": [
            {"source": "client", "target": "switch", "medium": "ethernet", "operational_status": "up"},
            {"source": "switch", "target": "server", "medium": "fiber", "operational_status": "down"},
        ],
    })

    result = simulate_packet(
        topology,
        [],
        [],
        PacketSimulationRequest(source_device_id="client", target_device_id="server", protocol="icmp"),
    )

    assert result.disposition == "unreachable"
    assert result.reason == "No active topology path connects the selected devices"
    assert result.hops == []


def test_packet_simulation_only_applies_policy_on_traversed_device() -> None:
    topology = Topology.model_validate({
        "nodes": [
            {"id": "client", "name": "Client", "kind": "device"},
            {"id": "core", "name": "Core Router", "kind": "device"},
            {"id": "firewall", "name": "Edge Firewall", "kind": "device"},
            {"id": "server", "name": "Server", "kind": "service"},
        ],
        "links": [
            {"source": "client", "target": "core", "medium": "ethernet"},
            {"source": "core", "target": "server", "medium": "fiber"},
        ],
    })
    allocations = [
        IPAllocationResponse(id="ip-1", address="10.0.10.20", subnet="10.0.10.0/24", device_id="client"),
        IPAllocationResponse(id="ip-2", address="10.0.50.10", subnet="10.0.50.0/24", device_id="server"),
    ]
    rule = SecurityRuleResponse(
        id="rule-1",
        name="Firewall web deny",
        action="deny",
        protocol="tcp",
        source="any",
        destination="10.0.50.0/24",
        port="443",
        device_id="firewall",
    )
    request = PacketSimulationRequest(source_device_id="client", target_device_id="server", protocol="tcp", port=443)

    bypassed = simulate_packet(topology, allocations, [rule], request)
    topology.links.append(Topology.model_validate({
        "links": [{"source": "core", "target": "firewall", "medium": "fiber"}],
    }).links[0])
    topology.links = [link for link in topology.links if {link.source, link.target} != {"core", "server"}]
    topology.links.append(Topology.model_validate({
        "links": [{"source": "firewall", "target": "server", "medium": "fiber"}],
    }).links[0])
    enforced = simulate_packet(topology, allocations, [rule], request)

    assert bypassed.disposition == "delivered"
    assert enforced.disposition == "blocked"
    assert enforced.enforcement_device_id == "firewall"
    assert enforced.enforcement_device_name == "Edge Firewall"


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