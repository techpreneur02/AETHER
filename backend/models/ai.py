from pydantic import BaseModel, ConfigDict, Field


class AIQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=1000)


class AIAction(BaseModel):
    id: str
    label: str
    description: str


class AIQueryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str
    ai_suggested: bool
    grounded_node_count: int = Field(ge=0)
    grounded_link_count: int = Field(ge=0)
    cached: bool = False
    current_state: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    actions: list[AIAction] = Field(default_factory=list)