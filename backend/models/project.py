from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.models.assessment import ClientAssessment, NetworkDesign


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)


class ProjectResponse(ProjectCreate):
    model_config = ConfigDict(extra="forbid")

    id: str
    organization_id: str
    archived: bool = False
    created_at: datetime
    floorplan_path: str | None = None
    floorplan_content_type: str | None = None
    client_assessment: ClientAssessment | None = None
    network_design: NetworkDesign | None = None