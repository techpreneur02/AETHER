from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SecurityRuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    action: Literal["allow", "deny"] = "deny"
    protocol: Literal["tcp", "udp", "icmp", "any"] = "tcp"
    source: str = Field(min_length=1, max_length=64)
    destination: str = Field(min_length=1, max_length=64)
    port: str = Field(default="any", max_length=32)


class SecurityRuleResponse(SecurityRuleCreate):
    id: str
