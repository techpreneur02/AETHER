from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AssetCategory = Literal["camera", "rack", "power", "wireless", "cabling"]


class AssetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: AssetCategory
    name: str = Field(min_length=1, max_length=160)
    status: Literal["planned", "active", "warning", "retired"] = "planned"
    location: str = Field(default="", max_length=160)
    details: str = Field(default="", max_length=500)


class AssetResponse(AssetCreate):
    id: str
    project_id: str
