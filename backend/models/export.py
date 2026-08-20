from pydantic import BaseModel, ConfigDict

from backend.models.project import ProjectResponse
from backend.models.topology import Topology


class ProjectExport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project: ProjectResponse
    topology: Topology