from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Vendor = Literal["cisco_ios", "mikrotik_routeros", "fortinet_fortios"]


class ConfigPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor: Vendor
    hostname: str = Field(min_length=1, max_length=64)
    management_ip: str = Field(min_length=1, max_length=64)
    vlan_id: int = Field(default=10, ge=1, le=4094)


class ConfigPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendor: Vendor
    template_version: str
    generated_config: str
    ai_suggested: bool = False