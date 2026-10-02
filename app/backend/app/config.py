from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, BaseSettings, Field, validator


class Settings(BaseSettings):
    app_name: str = "FarmWith Auth API"
    database_url: str = Field(..., env="DATABASE_URL")
    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    session_secret_key: str = Field(..., env="SESSION_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    remember_me_expire_days: int = Field(default=30, env="REMEMBER_ME_EXPIRE_DAYS")

    enable_sso: bool = Field(default=False, env="ENABLE_SSO")
    oidc_provider_name: str = Field(default="Authentik", env="OIDC_PROVIDER_NAME")
    admin_sso_email: Optional[str] = Field(default=None, env="ADMIN_SSO_EMAIL")
    oidc_client_id: Optional[str] = Field(default=None, env="OIDC_CLIENT_ID")
    oidc_client_secret: Optional[str] = Field(default=None, env="OIDC_CLIENT_SECRET")
    oidc_configuration_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_CONFIGURATION_URL")
    oidc_authorize_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_AUTHORIZE_URL")
    oidc_token_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_TOKEN_URL")
    oidc_userinfo_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_USERINFO_URL")
    oidc_logout_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_LOGOUT_URL")

    frontend_url: AnyHttpUrl = Field(default="https://farmwith.in", env="FRONTEND_URL")
    backend_url: AnyHttpUrl = Field(default="https://api.farmwith.in", env="BACKEND_URL")
    allowed_origins: List[AnyHttpUrl] = Field(
        default_factory=lambda: [
            "https://farmwith.in",
            "https://farmwith.online",
            "http://localhost:5173",
        ],
        env="ALLOWED_ORIGINS",
    )

    smtp_host: str = Field(default="email-smtp.ap-south-1.amazonaws.com", env="SMTP_HOST")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_username: Optional[str] = Field(default=None, env="SMTP_USERNAME")
    smtp_password: Optional[str] = Field(default=None, env="SMTP_PASSWORD")
    smtp_from: str = Field(default="admin@farmwith.in", env="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, env="SMTP_USE_TLS")
    email_verification_expire_hours: int = Field(default=24, env="EMAIL_VERIFICATION_EXPIRE_HOURS")

    contribution_inbox: Optional[str] = Field(default=None, env=["CONTRIBUTION_INBOX", "SMTP_CONTRIBUTION_INBOX"])

    class Config:
        env_file = ".env"
        case_sensitive = False

        @classmethod
        def parse_env_var(cls, field_name, raw_val):  # type: ignore[override]
            if field_name == "allowed_origins" and isinstance(raw_val, str):
                return [origin.strip() for origin in raw_val.split(",") if origin.strip()]
            return cls.json_loads(raw_val)

    @validator("oidc_client_id", "oidc_client_secret", pre=True)
    def empty_str_to_none(cls, v):  # type: ignore[override]
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @validator("admin_sso_email", pre=True)
    def empty_admin_email_to_none(cls, v):  # type: ignore[override]
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @validator("enable_sso", pre=True)
    def parse_enable_sso(cls, v):  # type: ignore[override]
        if isinstance(v, str):
            return v.strip().lower() in {"1", "true", "yes", "on"}
        return v

    @validator(
        "oidc_configuration_url",
        "oidc_authorize_url",
        "oidc_token_url",
        "oidc_userinfo_url",
        "oidc_logout_url",
        pre=True,
    )
    def allow_empty_urls(cls, v):  # type: ignore[override]
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @property
    def sso_enabled(self) -> bool:
        if not self.enable_sso:
            return False
        return bool(
            self.oidc_client_id
            and self.oidc_client_secret
            and (
                self.oidc_configuration_url
                or (
                    self.oidc_authorize_url
                    and self.oidc_token_url
                    and self.oidc_userinfo_url
                )
            )
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
