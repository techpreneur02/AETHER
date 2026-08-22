import asyncio
import hashlib
import os
import time

from backend.models.ai import AIQueryResponse, HelpdeskResponse
from backend.models.assessment import ClientAssessment, NetworkDesign
from backend.models.topology import Topology


AI_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, AIQueryResponse]] = {}
_helpdesk_cache: dict[str, tuple[float, HelpdeskResponse]] = {}

HELPDESK_GUIDE: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("Getting started", ("start", "sign in", "login", "project", "workspace"), "Sign in, select the correct company project in the top bar, and confirm the VPS Engine is online before recording or changing infrastructure."),
    ("Infrastructure audit", ("audit", "discover", "inventory", "evidence", "import", "export"), "Start with the site and room scope, record devices and IP allocations, add physical and logical links with exact ports, review imported evidence, run audit checks, then export JSON and PDF records."),
    ("Build and edit the topology", ("topology", "device", "wire", "link", "port", "connect", "grid", "map"), "Open Topology, add or select devices, drag them on the snap grid, and connect device handles. Select a wire to edit its endpoints, ports, medium, or Up/Down state, then save and use Fit View."),
    ("Devices, ports, and IP addresses", ("ip", "address", "subnet", "device details", "available", "assigned"), "Select a device and open Device Details to maintain its vendor, model, type, port count, and assignments. Use IP Management to record addresses, CIDR subnets, descriptions, and device mappings."),
    ("Simulator and security", ("simulate", "simulation", "packet", "reach", "blocked", "security", "rule", "firewall"), "Open Simulator, choose source and destination devices, select protocol and destination port, then run the trace. Use Security to record allow or deny rules and assign the enforcement device."),
    ("Reports and AI assistant", ("report", "assistant", "suggestion", "current state", "action", "compliance"), "Review Current State, Suggestions, and Actions in the assistant panel. Validate generated guidance, then use Compliance and Reports to review gaps and export the project record."),
    ("Users and access control", ("user", "member", "role", "access", "admin", "password"), "Administrators manage organization members in Members. Assign the least privilege role required, use unique credentials, and review access after staff changes and at least quarterly."),
    ("Service operations", ("health", "service", "docker", "502", "unavailable", "troubleshoot"), "Check the public console and API health endpoint, confirm Nginx, frontend, API, and MongoDB containers are running, inspect recent logs, then test sign-in and one saved topology change."),
    ("Backup and upgrades", ("backup", "restore", "upgrade", "deploy", "maintenance"), "Back up MongoDB and record the deployed commit before upgrades. Run tests and the production build, rebuild only required services, restart Nginx when upstream containers change, and complete health and functional checks."),
)


def helpdesk_matches(query: str) -> list[tuple[str, str]]:
    normalized = query.lower()
    matches = [(title, guidance) for title, keywords, guidance in HELPDESK_GUIDE if any(keyword in normalized for keyword in keywords)]
    return matches[:3] or [("Getting started", HELPDESK_GUIDE[0][2])]


async def answer_helpdesk_query(query: str) -> HelpdeskResponse:
    normalized = query.strip().lower()
    cache_key = hashlib.sha256(normalized.encode()).hexdigest()
    cached = _helpdesk_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1].model_copy(update={"cached": True})

    matches = helpdesk_matches(query)
    sources = [title for title, _ in matches]
    fallback = "\n\n".join(guidance for _, guidance in matches)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        result = HelpdeskResponse(answer=fallback, sources=sources, ai_suggested=False)
    else:
        from google import genai

        guide_context = "\n".join(f"{title}: {guidance}" for title, _, guidance in HELPDESK_GUIDE)
        prompt = (
            "You are the AETHER-IT product helpdesk. Answer the user's how-to question using only the supplied guide. "
            "Give concise, ordered instructions. Do not claim the product performs live network scanning. "
            "If the guide does not contain the answer, say that and direct the user to an administrator.\n\n"
            f"AETHER-IT GUIDE\n{guide_context}\n\nUSER QUESTION\n{query}"
        )
        client = genai.Client(api_key=api_key)
        response = await asyncio.to_thread(client.models.generate_content, model="gemini-3-flash-preview", contents=prompt)
        result = HelpdeskResponse(answer=response.text or fallback, sources=sources, ai_suggested=True)

    _helpdesk_cache[cache_key] = (time.time() + AI_CACHE_TTL_SECONDS, result)
    return result


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


async def add_ai_design_narrative(design: NetworkDesign, assessment: ClientAssessment | None) -> NetworkDesign:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return design
    from google import genai

    prompt = (
        "You are a senior multi-vendor network architect. Review the supplied client requirements, assessment, and deterministic engineer proposal. "
        "Return one concise paragraph identifying the design rationale, major tradeoff, and highest-priority validation. "
        "Do not invent products, prices, topology facts, or compliance guarantees. Do not output configuration commands.\n\n"
        f"REQUIREMENTS\n{design.requirements.model_dump_json()}\n\n"
        f"ASSESSMENT\n{assessment.model_dump_json() if assessment else 'not completed'}\n\n"
        f"ENGINEER PROPOSAL\n{design.model_dump_json()}"
    )
    try:
        client = genai.Client(api_key=api_key)
        response = await asyncio.to_thread(client.models.generate_content, model="gemini-3-flash-preview", contents=prompt)
        if response.text:
            return design.model_copy(update={"ai_narrative": response.text.strip(), "ai_suggested": True})
    except Exception:
        return design
    return design