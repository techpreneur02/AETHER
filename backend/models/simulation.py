from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PacketSimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_device_id: str = Field(min_length=1)
    target_device_id: str = Field(min_length=1)
    protocol: Literal["tcp", "udp", "icmp"] = "icmp"
    port: int | None = Field(default=None, ge=1, le=65535)


class SimulationHop(BaseModel):
    device_id: str
    name: str
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    ingress_port: str | None = None
    egress_port: str | None = None


class PacketSimulationResponse(BaseModel):
    reachable: bool
    disposition: Literal["delivered", "blocked", "unreachable"]
    reason: str
    protocol: Literal["tcp", "udp", "icmp"]
    port: int | None = None
    source_ip: str | None = None
    target_ip: str | None = None
    total_latency_ms: float = 0
    matched_rule_id: str | None = None
    matched_rule_name: str | None = None
    enforcement_device_id: str | None = None
    enforcement_device_name: str | None = None
    hops: list[SimulationHop] = Field(default_factory=list)