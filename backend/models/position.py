from pydantic import BaseModel, ConfigDict, Field


class PositionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    floorplan_x: float = Field(ge=0, le=1)
    floorplan_y: float = Field(ge=0, le=1)