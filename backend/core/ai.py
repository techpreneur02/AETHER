import asyncio
import hashlib
import os
import time

from backend.models.ai import AIQueryResponse
from backend.models.topology import Topology


AI_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, AIQueryResponse]] = {}


def project_context(topology: Topology) -> str:
    nodes = ", ".join(f"{node.name} ({node.kind})" for node in topology.nodes) or "none"
    links = ", ".join(f"{link.source} -> {link.target} via {link.medium}" for link in topology.links) or "none"
    return f"Nodes: {nodes}\nLinks: {links}"


async def answer_query(query: str, topology: Topology) -> AIQueryResponse:
    cache_key = hashlib.sha256((query.strip().lower() + topology.model_dump_json()).encode()).hexdigest()
    cached = _cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1].model_copy(update={"cached": True})
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        result = AIQueryResponse(
            answer="Gemini is not configured on this server. The query was not sent outside AETHER-IT.",
            ai_suggested=True,
            grounded_node_count=len(topology.nodes),
            grounded_link_count=len(topology.links),
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
    )
    _cache[cache_key] = (time.time() + AI_CACHE_TTL_SECONDS, result)
    return result