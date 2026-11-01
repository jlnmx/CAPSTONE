from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

PROFILE_PICTURE_MAX_CHARS = 400_000

BINAN_BARANGAYS = (
    "Biñan (Poblacion)", "Bungahan", "Canlalay", "Casile", "De La Paz", "Ganado", "Langkiwa", "Loma",
    "Malaban", "Malamig", "Mamplasan", "Platero", "San Antonio", "San Francisco (Halang)", "San Jose",
    "San Vicente", "Santo Domingo", "Santo Niño", "Santo Tomas", "Soro-Soro", "Timbao", "Tubigan", "Zapote",
)


class IncidentCreate(BaseModel):
    id: str | None = None
    type: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1)
    severity: Literal["low", "medium", "moderity", "high", "critical"] = "medium"
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


class HouseholdMembersUpdate(BaseModel):
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


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
    role: Literal["Resident", "Responder"] = "Resident"
    responderType: Literal["Official", "Volunteer"] | None = None
    responderOrganization: Literal["PNP", "BFP", "POSO", "BCDRRMO", "Barangay Responder"] | None = None
    responderBarangay: str | None = Field(default=None, max_length=120)
    verificationDocumentBase64: str | None = Field(default=None, max_length=5_600_000)
    verificationDocumentMimeType: Literal["image/jpeg", "image/png", "image/webp"] | None = None
    verificationDocumentName: str | None = Field(default=None, max_length=255)
    profilePicture: str | None = Field(default=None, max_length=PROFILE_PICTURE_MAX_CHARS)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_responder_organization(self):
        if self.role != "Responder":
            return self
        if not self.responderOrganization:
            raise ValueError("Choose your responder organization.")
        if self.responderOrganization == "Barangay Responder":
            if self.responderBarangay not in BINAN_BARANGAYS:
                raise ValueError("Choose the barangay you serve as a Barangay Responder.")
        else:
            self.responderBarangay = None
        return self


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


class SelfProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    birthday: date | None = None
    sex: Literal["Male", "Female"] | None = None
    currentAddress: str | None = Field(default=None, max_length=500)


class ResidentProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    birthday: date
    sex: Literal["Male", "Female"]
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(min_length=1, max_length=500)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class ProfilePictureUpdate(BaseModel):
    profilePicture: str = Field(max_length=PROFILE_PICTURE_MAX_CHARS)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ChatbotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatbotRequest(BaseModel):
    messages: list[ChatbotMessage] = Field(min_length=1, max_length=12)
    context: str = Field(default="", max_length=12000)


class NotificationPreferencesUpdate(BaseModel):
    emailEnabled: bool | None = None
    smsEnabled: bool | None = None


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


class ResponderApplicationReview(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=1000)


class DisasterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=2000)
    severity: Literal['low', 'medium', 'high', 'critical'] = 'medium'
    status: Literal['Upcoming', 'Active', 'Archived'] = 'Upcoming'
    affectedAreas: int = Field(default=0, ge=0)
    affectedBarangays: list[str] = Field(default_factory=list, max_length=50)
    startedAt: datetime | None = None


class IncidentStatusUpdate(BaseModel):
    status: Literal['reported', 'acknowledged', 'in_progress', 'resolved']
    # None means the client did not send the field: the server keeps the stored value (or fills a default on acknowledgement).
    actionNotes: str | None = Field(default=None, max_length=2000)
    # None means the client did not send the field, so the server may fill a default on acknowledgement.
    responsePeople: str | None = Field(default=None, max_length=500)
    responseOrganizations: str | None = Field(default=None, max_length=500)
    responseEtaMinutes: int | None = Field(default=None, ge=0, le=10080)
    responseNotes: str | None = Field(default=None, max_length=2000)


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


class EvacuationRegistrationCenterUpdate(BaseModel):
    centerId: str = Field(min_length=1, max_length=160)


class CenterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    location: str = Field(default='', max_length=255)
    capacity: int = Field(default=0, ge=0)
    currentOccupancy: int = Field(default=0, ge=0)
    status: Literal['available', 'limited', 'full', 'closed'] = 'available'
    coordinatorName: str = Field(default='', max_length=160)
    contactNumber: str = Field(default='', max_length=40)
    notes: str = Field(default='', max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class CenterCapacityUpdate(BaseModel):
    capacity: int = Field(ge=1)
