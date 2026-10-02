from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy import inspect, text

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_user_table_columns() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    column_definitions = {
        "full_name": "VARCHAR(255) DEFAULT '' NOT NULL",
        "phone_number": "VARCHAR(50)",
        "company_name": "VARCHAR(255)",
        "role": "VARCHAR(20) DEFAULT 'user' NOT NULL",
        "email_verified_at": "TIMESTAMP WITH TIME ZONE",
        "email_verification_token_hash": "VARCHAR(255)",
        "email_verification_token_expires_at": "TIMESTAMP WITH TIME ZONE",
    }

    with engine.begin() as connection:
        for column_name, column_type in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(f'ALTER TABLE users ADD COLUMN {column_name} {column_type}'))


def ensure_dashboard_table_columns() -> None:
    inspector = inspect(engine)
    if "dashboard_items" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("dashboard_items")}
    column_definitions = {
        "site_id": "VARCHAR(80) DEFAULT 'tiruvallur-40-acre' NOT NULL",
        "site_name": "VARCHAR(255) DEFAULT 'Tiruvallur 40-acre hub' NOT NULL",
        "project_id": "VARCHAR(255)",
        "project_title": "VARCHAR(255) DEFAULT '' NOT NULL",
        "kind": "VARCHAR(50) DEFAULT 'enquiry' NOT NULL",
        "contribution_type": "VARCHAR(100) DEFAULT '' NOT NULL",
        "classification": "VARCHAR(50)",
        "status": "VARCHAR(50) DEFAULT 'open' NOT NULL",
        "requested_amount": "NUMERIC(12, 2)",
        "accepted_amount": "NUMERIC(12, 2)",
        "currency": "VARCHAR(8) DEFAULT 'INR' NOT NULL",
        "note": "TEXT",
        "latest_update": "TEXT",
        "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, column_type in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(f'ALTER TABLE dashboard_items ADD COLUMN {column_name} {column_type}'))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
