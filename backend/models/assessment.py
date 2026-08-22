from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClientAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_contact: str = Field(default="", max_length=120)
    site_count: int = Field(default=1, ge=1, le=500)
    user_count: int = Field(default=1, ge=1, le=100000)
    critical_services: list[str] = Field(default_factory=list, max_length=30)
    internet_providers: str = Field(default="", max_length=300)
    current_pain_points: list[str] = Field(default_factory=list, max_length=30)
    security_controls: list[str] = Field(default_factory=list, max_length=30)
    backup_status: Literal["unknown", "none", "partial", "tested"] = "unknown"
    documentation_quality: int = Field(default=1, ge=1, le=5)
    resilience: int = Field(default=1, ge=1, le=5)
    security: int = Field(default=1, ge=1, le=5)
    scalability: int = Field(default=1, ge=1, le=5)
    notes: str = Field(default="", max_length=4000)


class AssessmentEvaluation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: int = Field(ge=0, le=100)
    grade: Literal["critical", "at_risk", "developing", "managed", "optimized"]
    strengths: list[str]
    gaps: list[str]
    recommendations: list[str]


class DesignRequirements(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objectives: list[str] = Field(min_length=1, max_length=30)
    availability_target: Literal["standard", "high", "mission_critical"] = "high"
    growth_percent: int = Field(default=25, ge=0, le=500)
    remote_users: int = Field(default=0, ge=0, le=100000)
    wireless_scope: Literal["none", "office", "campus", "warehouse", "hospitality"] = "office"
    preferred_vendors: list[str] = Field(default_factory=list, max_length=20)
    compliance: list[str] = Field(default_factory=list, max_length=20)
    cloud_services: list[str] = Field(default_factory=list, max_length=30)
    segmentation_required: bool = True
    budget_band: Literal["essential", "balanced", "strategic"] = "balanced"
    constraints: str = Field(default="", max_length=4000)


class NetworkDesign(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirements: DesignRequirements
    architecture: list[str]
    topology_suggestions: list[str]
    recommendations: list[str]
    configurations: dict[str, str]
    ai_narrative: str
    ai_suggested: bool = False