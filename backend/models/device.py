from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DeviceKind = Literal["device", "site", "service"]


class DeviceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    kind: DeviceKind = "device"
    vendor: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    port_count: int | None = Field(default=None, ge=1, le=96)


class DeviceResponse(DeviceCreate):
    id: str