from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=160)
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["open", "in_progress", "done"] = "open"
    assignee: str = Field(default="", max_length=120)
    due_date: str = Field(default="", max_length=20)


class TaskResponse(TaskCreate):
    id: str
