from pydantic import BaseModel, ConfigDict, Field


class ImportSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    imported: int = Field(ge=0)
    topology_nodes: int = Field(ge=0)


class UniversalImportSummary(ImportSummary):
    source_format: str
    skipped: int = Field(ge=0)
    warnings: list[str] = Field(default_factory=list)