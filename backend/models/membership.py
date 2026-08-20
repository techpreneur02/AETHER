from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


class MembershipResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    email: EmailStr
    organization_id: str
    role: Literal["admin", "tech", "viewer"]


class RoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["admin", "tech", "viewer"]