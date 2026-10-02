from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from . import auth, contributions, dashboard
from .config import settings
from .database import Base, engine, ensure_dashboard_table_columns, ensure_user_table_columns

ensure_user_table_columns()
ensure_dashboard_table_columns()
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret_key)

app.include_router(auth.router)
app.include_router(contributions.router)
app.include_router(dashboard.router)


@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}
