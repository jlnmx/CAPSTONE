from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    id: str | None = None
    type: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1)
    severity: Literal["low", "medium", "moderity", "high", "critical"]
    location: str = Field(min_length=1, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    photoUris: list[str] = Field(default_factory=list)
    createdAt: datetime | None = None


class EvacueeCreate(BaseModel):
    id: str | None = None
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=150)
    sex: str = Field(min_length=1, max_length=40)
    contactNumber: str | None = Field(default=None, max_length=40)
    address: str | None = None
    householdSize: int | None = Field(default=None, ge=1, le=100)
    barangay: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    createdAt: datetime | None = None


class SyncEvent(BaseModel):
    entityType: Literal["incident", "evacuee"]
    operation: Literal["create"]
    payload: dict[str, Any]


class SyncBatch(BaseModel):
    events: list[SyncEvent] = Field(default_factory=list, max_length=100)
