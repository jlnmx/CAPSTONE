from datetime import date, datetime
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PROFILE_PICTURE_MAX_CHARS = 400_000

BINAN_BARANGAYS = (
    "Biñan (Poblacion)", "Bungahan", "Canlalay", "Casile", "De La Paz", "Ganado", "Langkiwa", "Loma",
    "Malaban", "Malamig", "Mamplasan", "Platero", "San Antonio", "San Francisco (Halang)", "San Jose",
    "San Vicente", "Santo Domingo", "Santo Niño", "Santo Tomas", "Soro-Soro", "Timbao", "Tubigan", "Zapote",
)

class PushDeviceInput(BaseModel):
    token: str = Field(min_length=10, max_length=255, pattern=r"^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$")
    notificationChannelVersion: int = Field(default=2, ge=2)


class MapCoordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class MapPlaceSearch(BaseModel):
    query: str = Field(min_length=2, max_length=160)

    @field_validator("query")
    @classmethod
    def trim_search_query(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Enter at least two characters to search.")
        return normalized


class MapRouteRequest(BaseModel):
    origin: MapCoordinate
    destination: MapCoordinate
    travelMode: Literal["DRIVE", "WALK", "TWO_WHEELER"]


class IncidentCreate(BaseModel):
    id: str | None = None
    type: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    severity: Literal["low", "medium", "moderity", "high", "critical"] = "medium"
    location: str = Field(min_length=1, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    photoUris: list[str] = Field(default_factory=list, max_length=4)
    createdAt: datetime | None = None

    @field_validator("photoUris")
    @classmethod
    def validate_photos(cls, values: list[str]) -> list[str]:
        for value in values:
            if len(value) > 1_500_000 or not re.fullmatch(
                r"data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}",
                value,
            ):
                raise ValueError("Incident photos must be JPEG, PNG, or WebP images no larger than 1.5 MB each.")
        return values


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
    entityType: Literal["incident", "evacuee", "evacuation_registration"]
    operation: Literal["create"]
    payload: dict[str, Any]


class SyncBatch(BaseModel):
    events: list[SyncEvent] = Field(default_factory=list, max_length=100)


class HouseholdMemberInput(BaseModel):
    name: str = Field(default="", max_length=160)
    firstName: str | None = Field(default=None, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str | None = Field(default=None, max_length=120)
    suffix: str | None = Field(default=None, max_length=30)
    profilePicture: str | None = Field(default=None, max_length=800000)
    age: int | None = Field(default=None, ge=0, le=150)
    sex: Literal["Male", "Female"] | None = None
    contactNumber: str | None = Field(default=None, max_length=40)
    relationship: str = Field(min_length=1, max_length=80)

    @field_validator("sex", mode="before")
    @classmethod
    def blank_sex_is_none(cls, value):
        return value or None

    @model_validator(mode="after")
    def compose_name(self):
        parts = (self.firstName, self.middleName, self.lastName, self.suffix)
        composed = " ".join(part.strip() for part in parts if part and part.strip())
        self.name = composed or self.name.strip()
        if not self.name:
            raise ValueError("A household member needs a name.")
        return self


class HouseholdMembersUpdate(BaseModel):
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)


class UserRegistration(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    suffix: str | None = Field(default=None, max_length=20)
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
    facePhotoBase64: str | None = Field(default=None, max_length=5_600_000)
    facePhotoMimeType: Literal["image/jpeg", "image/png", "image/webp"] | None = None
    facePhotoName: str | None = Field(default=None, max_length=255)
    faceConsent: bool = False
    profilePicture: str | None = Field(default=None, max_length=PROFILE_PICTURE_MAX_CHARS)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)
    registrationToken: str = Field(min_length=20, max_length=100)

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
    suffix: str | None = Field(default=None, max_length=20)
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
    passwordChangeToken: str | None = Field(default=None, min_length=20, max_length=100)
    passwordChangeOtp: str | None = Field(default=None, pattern=r"^\d{6}$")
    emailChangeToken: str | None = Field(default=None, min_length=20, max_length=100)
    emailChangeOtp: str | None = Field(default=None, pattern=r"^\d{6}$")


class SelfProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    suffix: str | None = Field(default=None, max_length=20)
    position: str | None = Field(default=None, max_length=120)
    birthday: date | None = None
    sex: Literal["Male", "Female"] | None = None
    currentAddress: str | None = Field(default=None, max_length=500)


class ResidentProfileUpdate(BaseModel):
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    suffix: str | None = Field(default=None, max_length=20)
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
    keepLoggedIn: bool = False


class RefreshTokenInput(BaseModel):
    refreshToken: str = Field(min_length=32, max_length=256)


class LogoutRequest(BaseModel):
    preserveRefreshToken: str | None = Field(default=None, min_length=32, max_length=256)


class ChatbotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatbotRequest(BaseModel):
    messages: list[ChatbotMessage] = Field(min_length=1, max_length=12)
    context: str = Field(default="", max_length=12000)


class NotificationPreferencesUpdate(BaseModel):
    emailEnabled: bool | None = None
    smsEnabled: bool | None = None
    dispatchSirenEnabled: bool | None = None


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


class RegistrationOtpRequest(BaseModel):
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    channel: Literal["email", "sms"]


class RegistrationOtpVerification(BaseModel):
    registrationToken: str = Field(min_length=20, max_length=100)
    otp: str = Field(pattern=r"^\d{6}$")


class PasswordChangeOtpRequest(BaseModel):
    channel: Literal["email", "sms"]
    currentPassword: str = Field(min_length=1, max_length=128)


class EmailChangeOtpRequest(BaseModel):
    newEmail: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    currentPassword: str = Field(min_length=1, max_length=128)
    channel: Literal["email", "sms"] = "sms"


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    birthday: date
    mobileNumber: str = Field(pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str = Field(min_length=1, max_length=500)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["Responder", "Resident", "Administrator"]
    status: Literal["Active", "Inactive", "Pending"] = "Active"
    isSuperAdmin: bool = False
    adminCategory: Literal["BCDRRMO", "CSWD"] | None = None

    @model_validator(mode="after")
    def validate_admin_category(self):
        if self.role == "Administrator" and not self.isSuperAdmin and self.adminCategory is None:
            raise ValueError("Choose BCDRRMO or CSWD for a sub-admin account.")
        if self.role != "Administrator" and self.adminCategory is not None:
            raise ValueError("Only administrator accounts can have a sub-admin category.")
        if self.isSuperAdmin and self.adminCategory is not None:
            raise ValueError("Superadmin accounts do not use a sub-admin category.")
        return self


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=240)
    email: str | None = Field(default=None, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=255)
    birthday: date | None = None
    mobileNumber: str | None = Field(default=None, pattern=r"^(09\d{9}|\+639\d{9}|639\d{9})$")
    currentAddress: str | None = Field(default=None, min_length=1, max_length=500)
    role: Literal["Responder", "Resident", "Administrator"] | None = None
    status: Literal["Active", "Inactive", "Pending"] | None = None
    adminCategory: Literal["BCDRRMO", "CSWD"] | None = None


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


class IncidentDispatch(BaseModel):
    responderIds: list[str] = Field(min_length=1, max_length=50)

    @field_validator("responderIds")
    @classmethod
    def require_unique_responders(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("A responder can only be selected once.")
        if any(not responder_id.strip() for responder_id in value):
            raise ValueError("Responder IDs cannot be blank.")
        return value


class IncidentResponsePhotoCreate(BaseModel):
    photoUri: str = Field(min_length=32, max_length=1_500_000)
    caption: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ResponderPresenceUpdate(BaseModel):
    availability: Literal["available", "busy"] = "available"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0, le=100_000)
    city: str | None = Field(default=None, max_length=100)
    barangay: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both location coordinates must be supplied together.")
        if self.city and "binan" not in self.city.casefold().replace("ñ", "n"):
            self.barangay = None
        return self


class EvacueeStatusUpdate(BaseModel):
    evacuationStatus: Literal['registered', 'checked_in', 'evacuated', 'released']


class EvacuationRegistrationCreate(BaseModel):
    id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,100}$")
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


class AdminEvacuationRegistrationCreate(BaseModel):
    residentUserId: str | None = Field(default=None, max_length=160)
    centerId: str = Field(min_length=1, max_length=160)
    firstName: str = Field(min_length=1, max_length=120)
    middleName: str | None = Field(default=None, max_length=120)
    lastName: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=150)
    sex: Literal["Female", "Male", "Other"]
    contactNumber: str | None = Field(default=None, max_length=40)
    address: str = Field(min_length=1, max_length=500)
    householdSize: int = Field(ge=1, le=21)
    members: list[HouseholdMemberInput] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def household_size_matches_members(self):
        if self.householdSize != len(self.members) + 1:
            raise ValueError("Household size must match the evacuee and listed household members.")
        return self


class EvacuationRegistrationStatusUpdate(BaseModel):
    status: Literal['released']


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


class CenterDetailsUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    location: str = Field(default='', max_length=255)
    capacity: int = Field(ge=1)
    status: Literal['available', 'limited', 'full', 'closed']
    coordinatorName: str = Field(default='', max_length=160)
    contactNumber: str = Field(default='', max_length=40)
    notes: str = Field(default='', max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
