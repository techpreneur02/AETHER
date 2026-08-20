from pydantic import BaseModel, ConfigDict, Field


class ImportSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    imported: int = Field(ge=0)
    topology_nodes: int = Field(ge=0)