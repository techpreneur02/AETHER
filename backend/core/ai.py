import asyncio
import hashlib
import os
import time

from backend.models.ai import AIQueryResponse
from backend.models.topology import Topology


AI_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, AIQueryResponse]] = {}


def operational_guidance(topology: Topology, ip_allocation_count: int, security_rule_count: int) -> tuple[list[str], list[str], list[dict[str, str]]]:
    connected_ids = {endpoint for link in topology.links for endpoint in (link.source, link.target)}
    isolated_count = sum(node.id not in connected_ids for node in topology.nodes)
    down_link_count = sum(link.operational_status == "down" for link in topology.links)
    missing_ip_count = max(len(topology.nodes) - ip_allocation_count, 0)
    current_state = [
        f"{len(topology.nodes)} devices and {len(topology.links)} recorded links",
        f"{down_link_count} links down and {isolated_count} isolated devices",
        f"{ip_allocation_count} IP allocations and {security_rule_count} security rules",
    ]
    suggestions: list[str] = []
    actions: list[dict[str, str]] = []
    if down_link_count:
        suggestions.append("Review down connections before relying on simulated reachability.")
        actions.append({"id": "open_simulator", "label": "Test reachability", "description": "Open the packet simulator with the current project."})
    if isolated_count:
        suggestions.append("Connect isolated devices or document why they are intentionally standalone.")
        actions.append({"id": "open_topology", "label": "Review topology", "description": "Return to the topology editor and assign missing links."})
    if missing_ip_count:
        suggestions.append(f"Assign addressing to up to {missing_ip_count} devices that have no recorded IP allocation.")
        actions.append({"id": "open_ipam", "label": "Assign IP addresses", "description": "Open IP Management for this project."})
    if security_rule_count == 0:
        suggestions.append("Record security policy so simulations can identify allowed and blocked flows.")
        actions.append({"id": "open_security", "label": "Define policy", "description": "Open project security-rule management."})
    if not suggestions:
        suggestions.append("Run representative packet traces and review the results against the intended design.")
        actions.append({"id": "open_simulator", "label": "Run packet trace", "description": "Validate an application flow across the recorded topology."})
    return current_state, suggestions[:3], actions[:3]


def project_context(topology: Topology) -> str:
    nodes = ", ".join(f"{node.name} ({node.kind})" for node in topology.nodes) or "none"
    links = ", ".join(f"{link.source} -> {link.target} via {link.medium}" for link in topology.links) or "none"
    return f"Nodes: {nodes}\nLinks: {links}"


async def answer_query(query: str, topology: Topology, ip_allocation_count: int = 0, security_rule_count: int = 0) -> AIQueryResponse:
    cache_key = hashlib.sha256((query.strip().lower() + topology.model_dump_json() + f"{ip_allocation_count}:{security_rule_count}").encode()).hexdigest()
    cached = _cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1].model_copy(update={"cached": True})
    api_key = os.getenv("GEMINI_API_KEY")
    current_state, suggestions, actions = operational_guidance(topology, ip_allocation_count, security_rule_count)
    if not api_key:
        result = AIQueryResponse(
            answer="Gemini is not configured on this server. The query was not sent outside AETHER-IT.",
            ai_suggested=True,
            grounded_node_count=len(topology.nodes),
            grounded_link_count=len(topology.links),
            current_state=current_state,
            suggestions=suggestions,
            actions=actions,
        )
        _cache[cache_key] = (time.time() + AI_CACHE_TTL_SECONDS, result)
        return result

    from google import genai

    prompt = (
        "You are an infrastructure assistant. Answer only from the supplied project context. "
        "If the context does not support an answer, say so. Mark suggestions as non-authoritative.\n\n"
        f"PROJECT CONTEXT\n{project_context(topology)}\n\nUSER QUERY\n{query}"
    )
    client = genai.Client(api_key=api_key)
    response = await asyncio.to_thread(client.models.generate_content, model="gemini-3-flash-preview", contents=prompt)
    result = AIQueryResponse(
        answer=response.text or "Gemini returned no answer.",
        ai_suggested=True,
        grounded_node_count=len(topology.nodes),
        grounded_link_count=len(topology.links),
        current_state=current_state,
        suggestions=suggestions,
        actions=actions,
    )
    _cache[cache_key] = (time.time() + AI_CACHE_TTL_SECONDS, result)
    return result