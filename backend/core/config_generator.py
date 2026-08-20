from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from backend.models.config import ConfigPreviewRequest


TEMPLATE_ROOT = Path(__file__).resolve().parent.parent / "templates"
environment = Environment(loader=FileSystemLoader(TEMPLATE_ROOT), undefined=StrictUndefined, autoescape=False)


def render_config(request: ConfigPreviewRequest) -> str:
    template = environment.get_template(f"{request.vendor}.j2")
    return template.render(**request.model_dump())