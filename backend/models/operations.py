from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


OperationsTarget = Literal["linux_vps", "windows_server", "cpanel"]
OperationsCommand = Literal[
    "ping",
    "traceroute",
    "network_summary",
    "dns_lookup",
    "service_status",
    "recent_logs",
    "account_summary",
    "domains",
    "email_accounts",
]


class OperationsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: OperationsTarget
    command: OperationsCommand
    argument: str = Field(default="", max_length=253)


class OperationsTargetStatus(BaseModel):
    target: OperationsTarget
    available: bool
    detail: str


class OperationsResult(BaseModel):
    target: OperationsTarget
    command: OperationsCommand
    output: str
    exit_code: int
    duration_ms: int