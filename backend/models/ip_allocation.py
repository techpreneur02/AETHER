from pydantic import BaseModel, ConfigDict, Field


class IPAllocationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str = Field(min_length=1, max_length=45)
    subnet: str = Field(min_length=1, max_length=45)
    description: str = Field(default="", max_length=240)
    device_id: str | None = None


class IPAllocationResponse(IPAllocationCreate):
    id: str
