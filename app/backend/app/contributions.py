from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from . import schemas
from .dashboard import record_contribution_activity
from .config import settings
from .dependencies import get_current_user
from .models import User
from .auth import _send_email
from .database import get_db

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.post("", response_model=schemas.MessageResponse)
@router.post("/", response_model=schemas.MessageResponse)
def submit_contribution(
    payload: schemas.ContributionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.contribution_inbox:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contribution inbox is not configured",
        )

    idea_label = payload.idea_title or payload.idea_id or "General support"
    note = payload.note or "(no additional note provided)"
    subject = f"New FarmWith contribution interest: {idea_label}"
    lines = [
        f"Contributor: {payload.name}",
        f"Contact: {payload.contact}",
        f"Idea: {idea_label}",
        f"Contribution type: {payload.contribution_type}",
        f"Note: {note}",
        f"User account: {current_user.username}",
    ]
    body = "\n".join(lines)

    try:
        _send_email(to_address=settings.contribution_inbox, subject=subject, body=body)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - SMTP/network issues
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send contribution request",
        ) from exc

    record_contribution_activity(db, current_user, payload)

    return schemas.MessageResponse(detail="Contribution submitted successfully")
