from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    phone_number: str = Field(min_length=10, max_length=10, regex=r"^\d{10}$")
    company_name: str | None = None


class UserRead(UserBase):
    id: str
    created_at: datetime
    role: str = "user"
    name: str | None = None
    phone_number: str | None = None
    company_name: str | None = None
    email_verified_at: datetime | None = None

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthConfigResponse(BaseModel):
    enable_sso: bool
    oidc_provider_name: str


class MessageResponse(BaseModel):
    detail: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8)


class ContributionRequest(BaseModel):
    site_id: str | None = None
    site_name: str | None = None
    idea_id: str | None = None
    idea_title: str | None = None
    name: str = Field(min_length=1)
    contact: str = Field(min_length=3)
    contribution_type: str = Field(min_length=3)
    pledge_amount: Decimal | None = Field(default=None, gt=0)
    note: str | None = None


class DashboardEventRead(BaseModel):
    id: str
    project_title: str
    event_type: str
    summary: str
    amount_delta: Decimal | None = None
    created_at: datetime

    class Config:
        orm_mode = True


class DashboardItemRead(BaseModel):
    id: str
    site_id: str
    site_name: str
    project_id: str | None = None
    project_title: str
    kind: str
    contribution_type: str
    classification: str | None = None
    status: str
    requested_amount: Decimal | None = None
    accepted_amount: Decimal | None = None
    currency: str
    note: str | None = None
    latest_update: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class DashboardSummary(BaseModel):
    active_items: int
    funding_items: int
    support_items: int
    open_items: int
    total_pledged: Decimal = Decimal("0")


class DashboardResponse(BaseModel):
    profile: UserRead
    summary: DashboardSummary
    items: list[DashboardItemRead]
    recent_events: list[DashboardEventRead]


class DashboardTopUpRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    note: str | None = None


class DashboardNoteRequest(BaseModel):
    note: str | None = None
