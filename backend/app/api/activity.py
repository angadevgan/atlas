from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.models import User, ActivityLog

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("")
def list_activity(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = db.query(ActivityLog).filter(ActivityLog.user_id == user.id)
    total = q.count()
    items = q.order_by(ActivityLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {"id": a.id, "action": a.action, "description": a.description, "meta": a.meta,
             "created_at": a.created_at}
            for a in items
        ],
        "total": total, "page": page, "page_size": page_size,
    }
