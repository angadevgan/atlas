from sqlalchemy.orm import Session

from app.models.models import ActivityLog, ActivityAction


def log_activity(db: Session, user_id: str, action: ActivityAction, description: str, meta: dict | None = None):
    entry = ActivityLog(user_id=user_id, action=action, description=description, meta=meta)
    db.add(entry)
    db.commit()
