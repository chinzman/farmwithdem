import hashlib
import secrets
from datetime import datetime, timedelta, timezone
import smtplib
from email.message import EmailMessage
from authlib.integrations.starlette_client import OAuth
from httpx import HTTPError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .database import get_db
from .dependencies import get_current_user
from .security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
SSO_CLIENT_NAME = "authentik"
_sso_client_registered = False
if settings.sso_enabled:
    register_kwargs = {
        "name": SSO_CLIENT_NAME,
        "client_id": settings.oidc_client_id,
        "client_secret": settings.oidc_client_secret,
        "client_kwargs": {"scope": "openid email profile"},
    }
    if settings.oidc_configuration_url:
        register_kwargs["server_metadata_url"] = str(settings.oidc_configuration_url)
    else:
        register_kwargs.update(
            {
                "api_base_url": str(settings.oidc_userinfo_url).rsplit("/", 1)[0]
                if settings.oidc_userinfo_url
                else None,
                "access_token_url": str(settings.oidc_token_url) if settings.oidc_token_url else None,
                "authorize_url": str(settings.oidc_authorize_url) if settings.oidc_authorize_url else None,
                "userinfo_endpoint": str(settings.oidc_userinfo_url) if settings.oidc_userinfo_url else None,
            }
        )
    oauth.register(**{k: v for k, v in register_kwargs.items() if v is not None})
    _sso_client_registered = True


def _is_sso_available() -> bool:
    return settings.sso_enabled and _sso_client_registered


def _get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.username == email).first()


def _get_user_by_phone(db: Session, phone_number: str):
    return db.query(models.User).filter(models.User.phone_number == phone_number).first()


def _is_admin_email(email: str | None) -> bool:
    if not email or not settings.admin_sso_email:
        return False
    return email.strip().lower() == settings.admin_sso_email.strip().lower()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_verification_email(token: str) -> tuple[str, str]:
    verify_url = f"{settings.frontend_url}/verify-email?token={token}"
    subject = "Verify your FarmWith email"
    body = (
        "Hello,\n\n"
        "Welcome to FarmWith. Please verify your email address to finish creating your account.\n\n"
        f"Verify your email: {verify_url}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you did not create this account, you can ignore this email."
    )
    return subject, body


def _send_verification_email(*, to_address: str, token: str) -> None:
    subject, body = _build_verification_email(token)
    _send_email(to_address=to_address, subject=subject, body=body)


def _issue_email_verification_token(user: models.User) -> str:
    token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = _hash_token(token)
    user.email_verification_token_expires_at = _utcnow() + timedelta(
        hours=settings.email_verification_expire_hours
    )
    return token


@router.post("/register", response_model=schemas.MessageResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    phone_user = _get_user_by_phone(db, payload.phone_number)
    if phone_user is not None and phone_user.username != payload.email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered with us - use that email id to login",
        )

    if user is not None and user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_was_created = False
    if user is None:
        user = models.User(username=payload.email)
        user_was_created = True

    user.full_name = payload.name
    user.password_hash = get_password_hash(payload.password)
    user.phone_number = payload.phone_number
    user.company_name = payload.company_name
    user.auth_method = "local"
    user.role = "user"
    user.email_verified_at = None
    token = _issue_email_verification_token(user)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        _send_verification_email(to_address=payload.email, token=token)
    except RuntimeError as exc:
        if user_was_created:
            db.delete(user)
            db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - network errors
        if user_was_created:
            db.delete(user)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send verification email",
        ) from exc

    return schemas.MessageResponse(detail="Verification email sent. Please check your inbox.")


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if user is None or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before signing in",
        )

    if not verify_password(payload.password, user.password_hash):
        # Update login attempts
        user.login_attempts += 1
        user.last_attempt = _utcnow()
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Reset login attempts on successful login
    user.login_attempts = 0
    user.last_login = _utcnow()
    db.commit()

    if user.role != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please use admin SSO to sign in")

    expires_delta = None
    if payload.remember:
        expires_delta = timedelta(days=settings.remember_me_expire_days)

    token = create_access_token(str(user.id), expires_delta=expires_delta)
    return schemas.TokenResponse(access_token=token)

@router.get("/config", response_model=schemas.AuthConfigResponse)
def auth_config():
    return schemas.AuthConfigResponse(
        enable_sso=_is_sso_available(),
        oidc_provider_name=settings.oidc_provider_name,
    )


@router.get("/verify-email", response_model=schemas.MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = _hash_token(token)
    user = (
        db.query(models.User)
        .filter(models.User.email_verification_token_hash == token_hash)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

    if user.email_verification_token_expires_at and user.email_verification_token_expires_at < _utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired",
        )

    user.mark_email_verified()
    db.add(user)
    db.commit()
    return schemas.MessageResponse(detail="Email verified successfully. You can now sign in.")


@router.post("/resend-verification", response_model=schemas.MessageResponse)
def resend_verification(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.is_email_verified:
        return schemas.MessageResponse(detail="Email already verified")

    token = _issue_email_verification_token(user)
    db.add(user)
    db.commit()

    try:
        _send_verification_email(to_address=payload.email, token=token)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send verification email",
        ) from exc

    return schemas.MessageResponse(detail="Verification email sent. Please check your inbox.")



@router.post("/forgot", response_model=schemas.MessageResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_password = secrets.token_urlsafe(8)
    user.password_hash = get_password_hash(new_password)
    db.add(user)
    db.commit()

    try:
        _send_email(
            to_address=payload.email,
            subject="Your FarmWith password has been reset",
            body=(
                "Hello,\n\n"
                "Your password has been reset by an administrator.\n"
                f"New password: {new_password}\n\n"
                "Please sign in and update your password if needed."
            ),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send reset email",
        ) from exc

    return schemas.MessageResponse(detail="Password reset email sent")


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/sso/login")
async def sso_login(request: Request):
    if not _is_sso_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SSO is disabled or misconfigured"
        )

    redirect_uri = f"{settings.backend_url}/auth/sso/callback"
    try:
        return await oauth.create_client(SSO_CLIENT_NAME).authorize_redirect(request, redirect_uri)
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO provider is unavailable",
        ) from exc


@router.get("/sso/callback")
async def sso_callback(request: Request, db: Session = Depends(get_db)):
    if not _is_sso_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SSO is disabled or misconfigured"
        )

    client = oauth.create_client(SSO_CLIENT_NAME)
    try:
        token = await client.authorize_access_token(request)
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO provider is unavailable",
        ) from exc
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO authorization failed")

    userinfo = token.get("userinfo")
    if userinfo is None:
        try:
            userinfo = await client.parse_id_token(request, token)
        except HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SSO provider is unavailable",
            ) from exc

    email = userinfo.get("email")
    subject = userinfo.get("sub") or secrets.token_hex(16)

    if email is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not provided by identity provider")

    if not _is_admin_email(email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This SSO account is not authorized as admin")

    user = _get_user_by_email(db, email)
    if user is None:
        # Some databases enforce a NOT NULL constraint on password_hash; use a
        # placeholder so SSO-only accounts can be created without local
        # credentials.
        user = models.User(
            username=email,
            password_hash="sso-placeholder",
            auth_method="oidc",
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    user.mark_sso(settings.oidc_provider_name, subject)
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(str(user.id))
    redirect_url = f"{settings.frontend_url}/sso/callback?token={access_token}"
    return RedirectResponse(url=redirect_url)


def _send_email(*, to_address: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP settings are not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise RuntimeError(f"SMTP error: {exc}") from exc
    except OSError as exc:
        raise RuntimeError(f"SMTP connection error: {exc}") from exc
