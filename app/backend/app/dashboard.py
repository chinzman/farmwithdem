from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db
from .dependencies import get_current_user

router = APIRouter(prefix="/auth/me/dashboard", tags=["dashboard"])

DEFAULT_SITE_ID = "tiruvallur-40-acre"
DEFAULT_SITE_NAME = "Tiruvallur 40-acre hub"


def _normalize_amount(amount: Decimal | None) -> Decimal | None:
    if amount is None:
        return None
    return amount.quantize(Decimal("0.01"))


def _item_to_read(item: models.DashboardItem) -> schemas.DashboardItemRead:
    return schemas.DashboardItemRead.from_orm(item)


def _ensure_admin(current_user: models.User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _event_to_read(event: models.DashboardEvent) -> schemas.DashboardEventRead:
    return schemas.DashboardEventRead(
        id=str(event.id),
        project_title=event.item.project_title,
        event_type=event.event_type,
        summary=event.summary,
        amount_delta=event.amount_delta,
        created_at=event.created_at,
    )


def _get_dashboard_item_or_404(
    db: Session,
    current_user: models.User,
    item_id: int,
) -> models.DashboardItem:
    item = (
        db.query(models.DashboardItem)
        .filter(models.DashboardItem.id == item_id, models.DashboardItem.user_id == current_user.id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard item not found")
    return item


def record_contribution_activity(
    db: Session,
    current_user: models.User,
    payload: schemas.ContributionRequest,
) -> models.DashboardItem:
    project_title = payload.idea_title or payload.idea_id or "General support"
    requested_amount = _normalize_amount(payload.pledge_amount)
    item = models.DashboardItem(
        user_id=current_user.id,
        site_id=payload.site_id or DEFAULT_SITE_ID,
        site_name=payload.site_name or DEFAULT_SITE_NAME,
        project_id=payload.idea_id,
        project_title=project_title,
        kind="enquiry",
        contribution_type=payload.contribution_type,
        classification=None,
        status="open",
        requested_amount=requested_amount,
        accepted_amount=None,
        currency="INR",
        note=payload.note,
        latest_update=f"Enquiry logged for {project_title}",
    )
    db.add(item)
    db.flush()

    db.add(
        models.DashboardEvent(
            item_id=item.id,
            event_type="created",
            summary=f"Recorded enquiry for {project_title}",
            amount_delta=requested_amount,
        )
    )
    db.commit()
    db.refresh(item)
    return item


def top_up_dashboard_item(
    db: Session,
    current_user: models.User,
    item_id: int,
    amount: Decimal,
    note: str | None = None,
) -> models.DashboardItem:
    item = _get_dashboard_item_or_404(db, current_user, item_id)
    normalized_amount = _normalize_amount(amount) or Decimal("0")
    if item.classification == "funding":
        new_total = (item.accepted_amount or Decimal("0")) + normalized_amount
        item.accepted_amount = _normalize_amount(new_total)
        item.status = "accepted"
        item.latest_update = note or f"Top-up of INR {normalized_amount} added to this funding item"
    else:
        new_total = (item.requested_amount or Decimal("0")) + normalized_amount
        item.requested_amount = _normalize_amount(new_total)
        item.latest_update = note or f"Enquiry amount updated by INR {normalized_amount}"
    db.add(item)
    db.add(
        models.DashboardEvent(
            item_id=item.id,
            event_type="top_up",
            summary=item.latest_update,
            amount_delta=normalized_amount,
        )
    )
    db.commit()
    db.refresh(item)
    return item


def continue_dashboard_item(
    db: Session,
    current_user: models.User,
    item_id: int,
    note: str | None = None,
) -> models.DashboardItem:
    item = _get_dashboard_item_or_404(db, current_user, item_id)
    item.status = "in_progress"
    item.latest_update = note or "User continued this request"
    db.add(item)
    db.add(
        models.DashboardEvent(
            item_id=item.id,
            event_type="continued",
            summary=item.latest_update,
        )
    )
    db.commit()
    db.refresh(item)
    return item


def request_update_dashboard_item(
    db: Session,
    current_user: models.User,
    item_id: int,
    note: str | None = None,
) -> models.DashboardItem:
    item = _get_dashboard_item_or_404(db, current_user, item_id)
    item.status = "follow_up_needed"
    item.latest_update = note or "User requested an update"
    db.add(item)
    db.add(
        models.DashboardEvent(
            item_id=item.id,
            event_type="update_requested",
            summary=item.latest_update,
        )
    )
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=schemas.DashboardResponse)
def read_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = (
        db.query(models.DashboardItem)
        .filter(models.DashboardItem.user_id == current_user.id)
        .order_by(models.DashboardItem.updated_at.desc(), models.DashboardItem.created_at.desc())
        .all()
    )

    recent_events = (
        db.query(models.DashboardEvent)
        .join(models.DashboardItem, models.DashboardItem.id == models.DashboardEvent.item_id)
        .filter(models.DashboardItem.user_id == current_user.id)
        .order_by(models.DashboardEvent.created_at.desc())
        .limit(8)
        .all()
    )

    total_pledged = sum(
        (
            item.accepted_amount or Decimal("0")
            for item in items
            if item.classification == "funding"
        ),
        Decimal("0"),
    )

    summary = schemas.DashboardSummary(
        active_items=len(items),
        funding_items=sum(1 for item in items if item.classification == "funding" and item.status == "accepted"),
        support_items=sum(1 for item in items if item.classification == "support" and item.status == "accepted"),
        open_items=sum(1 for item in items if item.status == "open"),
        total_pledged=total_pledged,
    )

    return schemas.DashboardResponse(
        profile=current_user,
        summary=summary,
        items=[_item_to_read(item) for item in items],
        recent_events=[_event_to_read(event) for event in recent_events],
    )


@router.get("/admin", response_model=schemas.DashboardResponse)
def read_admin_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)

    items = db.query(models.DashboardItem).order_by(models.DashboardItem.updated_at.desc()).all()
    recent_events = (
        db.query(models.DashboardEvent)
        .order_by(models.DashboardEvent.created_at.desc())
        .limit(20)
        .all()
    )
    summary = schemas.DashboardSummary(
        active_items=len(items),
        funding_items=sum(1 for item in items if item.classification == "funding" and item.status == "accepted"),
        support_items=sum(1 for item in items if item.classification == "support" and item.status == "accepted"),
        open_items=sum(1 for item in items if item.status == "open"),
        total_pledged=sum((item.accepted_amount or Decimal("0") for item in items if item.classification == "funding"), Decimal("0")),
    )
    return schemas.DashboardResponse(
        profile=current_user,
        summary=summary,
        items=[_item_to_read(item) for item in items],
        recent_events=[_event_to_read(event) for event in recent_events],
    )


@router.post("/items/{item_id}/top-up", response_model=schemas.DashboardItemRead)
def top_up_item(
    item_id: int,
    payload: schemas.DashboardTopUpRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_item = top_up_dashboard_item(db, current_user, item_id, payload.amount, payload.note)
    return updated_item


@router.post("/items/{item_id}/continue", response_model=schemas.DashboardItemRead)
def continue_item(
    item_id: int,
    payload: schemas.DashboardNoteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_item = continue_dashboard_item(db, current_user, item_id, payload.note)
    return updated_item


@router.post("/items/{item_id}/request-update", response_model=schemas.DashboardItemRead)
def request_update_item(
    item_id: int,
    payload: schemas.DashboardNoteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_item = request_update_dashboard_item(db, current_user, item_id, payload.note)
    return updated_item
