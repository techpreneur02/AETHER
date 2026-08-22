from ipaddress import ip_address, ip_network

import networkx as nx

from backend.models.ip_allocation import IPAllocationResponse
from backend.models.security_rule import SecurityRuleResponse
from backend.models.simulation import PacketSimulationRequest, PacketSimulationResponse, SimulationHop
from backend.models.topology import Topology, TopologyLink


MEDIUM_LATENCY_MS = {"fiber": 0.2, "ethernet": 0.5, "wireless": 2.0}


def _device_ip(device_id: str, allocations: list[IPAllocationResponse]) -> str | None:
    allocation = next((item for item in allocations if item.device_id == device_id), None)
    return allocation.address if allocation else None


def _address_matches(rule_value: str, packet_ip: str | None) -> bool:
    normalized = rule_value.strip().lower()
    if normalized in {"any", "0.0.0.0/0", "::/0"}:
        return True
    if packet_ip is None:
        return False
    try:
        packet_address = ip_address(packet_ip)
        return packet_address in ip_network(rule_value.strip(), strict=False)
    except ValueError:
        return normalized == packet_ip.lower()


def _rule_matches(
    rule: SecurityRuleResponse,
    request: PacketSimulationRequest,
    source_ip: str | None,
    target_ip: str | None,
) -> bool:
    protocol_matches = rule.protocol == "any" or rule.protocol == request.protocol
    requested_port = "any" if request.port is None else str(request.port)
    port_matches = rule.port.lower() == "any" or rule.port == requested_port
    return (
        protocol_matches
        and port_matches
        and _address_matches(rule.source, source_ip)
        and _address_matches(rule.destination, target_ip)
    )


def _find_link(topology: Topology, first: str, second: str) -> TopologyLink:
    return next(
        link
        for link in topology.links
        if {link.source, link.target} == {first, second}
    )


def simulate_packet(
    topology: Topology,
    allocations: list[IPAllocationResponse],
    rules: list[SecurityRuleResponse],
    request: PacketSimulationRequest,
) -> PacketSimulationResponse:
    nodes = {node.id: node for node in topology.nodes}
    source_ip = _device_ip(request.source_device_id, allocations)
    target_ip = _device_ip(request.target_device_id, allocations)
    base_response = {
        "protocol": request.protocol,
        "port": request.port,
        "source_ip": source_ip,
        "target_ip": target_ip,
    }

    if request.source_device_id not in nodes or request.target_device_id not in nodes:
        return PacketSimulationResponse(
            **base_response,
            reachable=False,
            disposition="unreachable",
            reason="Source and target must both exist in the project topology",
        )

    graph = nx.Graph()
    graph.add_nodes_from(nodes)
    for link in topology.links:
        if link.operational_status == "down":
            continue
        graph.add_edge(
            link.source,
            link.target,
            weight=MEDIUM_LATENCY_MS[link.medium],
        )

    try:
        path = nx.shortest_path(
            graph,
            request.source_device_id,
            request.target_device_id,
            weight="weight",
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return PacketSimulationResponse(
            **base_response,
            reachable=False,
            disposition="unreachable",
            reason="No active topology path connects the selected devices",
        )

    hops: list[SimulationHop] = []
    total_latency = 0.0
    for index, device_id in enumerate(path):
        node = nodes[device_id]
        incoming_link = _find_link(topology, path[index - 1], device_id) if index > 0 else None
        outgoing_link = _find_link(topology, device_id, path[index + 1]) if index < len(path) - 1 else None
        if outgoing_link:
            total_latency += MEDIUM_LATENCY_MS[outgoing_link.medium]
        hops.append(
            SimulationHop(
                device_id=device_id,
                name=node.name,
                vendor=node.vendor,
                model=node.model,
                ip_address=_device_ip(device_id, allocations),
                ingress_port=(
                    incoming_link.target_port
                    if incoming_link and incoming_link.target == device_id
                    else incoming_link.source_port if incoming_link else None
                ),
                egress_port=(
                    outgoing_link.source_port
                    if outgoing_link and outgoing_link.source == device_id
                    else outgoing_link.target_port if outgoing_link else None
                ),
            )
        )

    matched_rule = next(
        (
            rule
            for rule in rules
            if (rule.device_id is None or rule.device_id in path)
            and _rule_matches(rule, request, source_ip, target_ip)
        ),
        None,
    )
    enforcement_device = nodes.get(matched_rule.device_id) if matched_rule and matched_rule.device_id else None
    if matched_rule and matched_rule.action == "deny":
        return PacketSimulationResponse(
            **base_response,
            reachable=False,
            disposition="blocked",
            reason=f"Blocked by security rule: {matched_rule.name}",
            total_latency_ms=round(total_latency, 2),
            matched_rule_id=matched_rule.id,
            matched_rule_name=matched_rule.name,
            enforcement_device_id=matched_rule.device_id,
            enforcement_device_name=enforcement_device.name if enforcement_device else None,
            hops=hops,
        )

    return PacketSimulationResponse(
        **base_response,
        reachable=True,
        disposition="delivered",
        reason="Packet delivered across the modeled topology",
        total_latency_ms=round(total_latency, 2),
        matched_rule_id=matched_rule.id if matched_rule else None,
        matched_rule_name=matched_rule.name if matched_rule else None,
        enforcement_device_id=matched_rule.device_id if matched_rule else None,
        enforcement_device_name=enforcement_device.name if enforcement_device else None,
        hops=hops,
    )