from datetime import date, datetime
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


class HouseholdMemberInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    relationship: str = Field(min_length=1, max_length=80)


class UserRegistration(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    birthday: date
    sex: Literal["Male", "Female"]
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(default="", max_length=500)
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=8, max_length=128)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class ResidentProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    birthday: date
    sex: Literal["Male", "Female"]
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(min_length=1, max_length=500)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class ResidentAccountUpdate(BaseModel):
    email: str | None = Field(default=None, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    mobileNumber: str | None = Field(default=None, pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentPassword: str | None = Field(default=None, min_length=1, max_length=128)
    newPassword: str | None = Field(default=None, min_length=8, max_length=128)


class ResidentProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    birthday: date
    sex: Literal["Male", "Female"]
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(min_length=1, max_length=500)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    channel: Literal["email", "sms"]


class PasswordResetOtpVerification(BaseModel):
    resetToken: str = Field(min_length=20, max_length=100)
    otp: str = Field(pattern=r"^\d{6}$")


class PasswordResetCompletion(BaseModel):
    resetToken: str = Field(min_length=20, max_length=100)
    otp: str = Field(pattern=r"^\d{6}$")
    newPassword: str = Field(min_length=8, max_length=128)


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    birthday: date
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(min_length=1, max_length=500)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["Responder", "Resident", "Administrator"]
    status: Literal["Active", "Inactive", "Pending"] = "Active"


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=240)
    email: str | None = Field(default=None, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    birthday: date | None = None
    mobileNumber: str | None = Field(default=None, pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str | None = Field(default=None, min_length=1, max_length=500)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: Literal["Responder", "Resident", "Administrator"] | None = None
    status: Literal["Active", "Inactive", "Pending"] | None = None


class DisasterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=2000)
    severity: Literal['low', 'medium', 'high', 'critical'] = 'medium'
    status: Literal['Upcoming', 'Active', 'Archived'] = 'Upcoming'
    affectedAreas: int = Field(default=0, ge=0)
    startedAt: datetime | None = None


class IncidentStatusUpdate(BaseModel):
    status: Literal['reported', 'acknowledged', 'in_progress', 'resolved']
    actionNotes: str = Field(default='', max_length=2000)


class EvacueeStatusUpdate(BaseModel):
    evacuationStatus: Literal['registered', 'checked_in', 'evacuated', 'released']


class EvacuationRegistrationCreate(BaseModel):
    centerId: str = Field(min_length=1, max_length=160)
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=150)
    sex: Literal["Female", "Male", "Other"]
    contactNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    address: str = Field(min_length=1, max_length=500)
    householdSize: int = Field(ge=1, le=21)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class EvacuationRegistrationStatusUpdate(BaseModel):
    status: Literal['checked_in', 'evacuated', 'released']


class CenterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    location: str = Field(default='', max_length=255)
    capacity: int = Field(default=0, ge=0)
    currentOccupancy: int = Field(default=0, ge=0)
    status: Literal['available', 'limited', 'full', 'closed'] = 'available'
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
