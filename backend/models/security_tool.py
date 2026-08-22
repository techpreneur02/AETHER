from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


SecurityToolId = Literal["wireshark", "nmap", "kali", "splunk", "nessus", "openvas", "tcpdump"]
SecurityToolAction = Literal["status", "version", "launch_profile", "nmap_host_discovery", "capture_plan"]


class SecurityToolCatalogItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: SecurityToolId
    name: str
    category: str
    summary: str
    command_name: str | None = None
    installed: bool = False
    configured: bool = False
    enabled: bool = False
    status: str
    actions: list[SecurityToolAction]


class SecurityToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: SecurityToolId
    action: SecurityToolAction
    target: str = Field(default="", max_length=253)


class SecurityToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: SecurityToolId
    action: SecurityToolAction
    output: str
    exit_code: int
    duration_ms: int
    guarded: bool = True
