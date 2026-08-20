from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LinkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    medium: Literal["fiber", "ethernet", "wireless"]
    source_port: str | None = None
    target_port: str | None = None