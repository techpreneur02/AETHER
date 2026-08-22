from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TopologyNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: Literal["device", "site", "service"]
    vendor: str | None = None
    model: str | None = None
    port_count: int | None = Field(default=None, ge=1, le=96)
    floorplan_x: float | None = Field(default=None, ge=0, le=1)
    floorplan_y: float | None = Field(default=None, ge=0, le=1)


class TopologyLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    medium: Literal["fiber", "ethernet", "wireless"]
    source_port: str | None = None
    target_port: str | None = None
    operational_status: Literal["up", "down"] = "up"


class Topology(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[TopologyNode] = Field(default_factory=list)
    links: list[TopologyLink] = Field(default_factory=list)