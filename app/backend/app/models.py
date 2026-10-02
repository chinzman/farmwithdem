from datetime import datetime, timezone
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .database import Base

class User(Base):
    __tablename__ = "users"

    # Supabase uses BigInt auto-incrementing ID, not UUID
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    # Supabase uses 'username' instead of 'email' as the main field
    username = Column(String(255), unique=True, index=True, nullable=False)
    
    # Supabase uses 'password_hash' instead of 'hashed_password'
    password_hash = Column(String(255), nullable=True)

    full_name = Column(String(255), nullable=False, default="")
    phone_number = Column(String(50), nullable=True)
    company_name = Column(String(255), nullable=True)

    # Login tracking
    login_attempts = Column(Integer, default=0)
    last_attempt = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    role = Column(String(20), default="user", nullable=False)

    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    email_verification_token_hash = Column(String(255), nullable=True, index=True)
    email_verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # OIDC fields
    oidc_sub = Column(String(255), nullable=True)
    oidc_issuer = Column(String(255), nullable=True)
    oidc_email = Column(String(255), nullable=True)
    auth_method = Column(String(50), default='local')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    dashboard_items = relationship("DashboardItem", back_populates="user", cascade="all, delete-orphan")

    def mark_sso(self, provider: str, subject: str) -> None:
        self.auth_provider = provider
        self.oidc_sub = subject
        self.auth_method = 'oidc'
        self.role = "admin"
        self.email_verified_at = self.email_verified_at or datetime.now(timezone.utc)

    # Property to maintain compatibility with your existing code
    @property
    def email(self):
        return self.username

    @property
    def name(self):
        return self.full_name

    @property
    def hashed_password(self):
        return self.password_hash

    @property
    def is_email_verified(self):
        return self.email_verified_at is not None

    @property
    def is_admin(self):
        return self.role == "admin"

    def mark_email_verified(self) -> None:
        self.email_verified_at = datetime.now(timezone.utc)
        self.email_verification_token_hash = None
        self.email_verification_token_expires_at = None


class DashboardItem(Base):
    __tablename__ = "dashboard_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    site_id = Column(String(80), nullable=False, default="tiruvallur-40-acre")
    site_name = Column(String(255), nullable=False, default="Tiruvallur 40-acre hub")
    project_id = Column(String(255), nullable=True, index=True)
    project_title = Column(String(255), nullable=False)
    kind = Column(String(50), nullable=False, default="enquiry")
    contribution_type = Column(String(100), nullable=False)
    classification = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="open")
    requested_amount = Column(Numeric(12, 2), nullable=True)
    accepted_amount = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(8), nullable=False, default="INR")
    note = Column(Text, nullable=True)
    latest_update = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="dashboard_items")
    events = relationship(
        "DashboardEvent",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="DashboardEvent.created_at.desc()",
    )


class DashboardEvent(Base):
    __tablename__ = "dashboard_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    item_id = Column(BigInteger, ForeignKey("dashboard_items.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    summary = Column(Text, nullable=False)
    amount_delta = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("DashboardItem", back_populates="events")
