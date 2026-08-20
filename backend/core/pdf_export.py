from html import escape

from backend.models.project import ProjectResponse
from backend.models.topology import Topology


def build_as_built_html(project: ProjectResponse, topology: Topology) -> str:
    nodes = "".join(f"<tr><td>{escape(node.name)}</td><td>{escape(node.kind)}</td></tr>" for node in topology.nodes)
    links = "".join(f"<tr><td>{escape(link.source)}</td><td>{escape(link.target)}</td><td>{escape(link.medium)}</td></tr>" for link in topology.links)
    return f"""<!doctype html><html><head><meta charset='utf-8'><style>
body {{ font-family: sans-serif; color: #152333; margin: 36px; }} h1 {{ color: #0b6174; }} h2 {{ border-bottom: 1px solid #b8cbd2; padding-bottom: 5px; }} table {{ border-collapse: collapse; width: 100%; margin-bottom: 24px; }} th, td {{ border: 1px solid #c8d5da; padding: 7px; text-align: left; }} th {{ background: #eaf3f5; }} .meta {{ color: #56717b; }}
</style></head><body><h1>AETHER-IT As-Built</h1><p class='meta'>Project: {escape(project.name)}<br>Organization: {escape(project.organization_id)}<br>Created: {project.created_at.isoformat()}</p><h2>Devices ({len(topology.nodes)})</h2><table><tr><th>Name</th><th>Kind</th></tr>{nodes or '<tr><td colspan="2">No devices</td></tr>'}</table><h2>Links ({len(topology.links)})</h2><table><tr><th>Source</th><th>Target</th><th>Medium</th></tr>{links or '<tr><td colspan="3">No links</td></tr>'}</table></body></html>"""


def render_as_built_pdf(project: ProjectResponse, topology: Topology) -> bytes:
    from weasyprint import HTML

    return HTML(string=build_as_built_html(project, topology)).write_pdf()