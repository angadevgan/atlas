from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.models import User, Dataset, MLModel, PredictionLog, ActivityLog

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    total_models = db.query(func.count(MLModel.id)).filter(MLModel.owner_id == user.id).scalar()
    total_datasets = db.query(func.count(Dataset.id)).filter(Dataset.owner_id == user.id).scalar()

    dataset_storage = db.query(func.coalesce(func.sum(Dataset.file_size_bytes), 0)).filter(
        Dataset.owner_id == user.id
    ).scalar()
    model_storage = db.query(func.coalesce(func.sum(MLModel.file_size_bytes), 0)).filter(
        MLModel.owner_id == user.id
    ).scalar()

    total_predictions = (
        db.query(func.count(PredictionLog.id))
        .join(MLModel, PredictionLog.model_id == MLModel.id)
        .filter(MLModel.owner_id == user.id)
        .scalar()
    )

    recent_activity = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "total_models": total_models,
        "total_datasets": total_datasets,
        "total_predictions": total_predictions,
        "storage_used_bytes": dataset_storage + model_storage,
        "recent_activity": [
            {"description": a.description, "created_at": a.created_at} for a in recent_activity
        ],
    }


@router.get("/predictions-per-day")
def predictions_per_day(db: Session = Depends(get_db), user: User = Depends(get_current_user), days: int = 14):
    since = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(
            func.date(PredictionLog.created_at).label("day"),
            func.count(PredictionLog.id).label("count"),
        )
        .join(MLModel, PredictionLog.model_id == MLModel.id)
        .filter(MLModel.owner_id == user.id, PredictionLog.created_at >= since)
        .group_by(func.date(PredictionLog.created_at))
        .order_by(func.date(PredictionLog.created_at))
        .all()
    )

    return [{"date": str(r.day), "count": r.count} for r in rows]


@router.get("/model-usage")
def model_usage(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(MLModel.name, func.count(PredictionLog.id).label("count"))
        .join(PredictionLog, PredictionLog.model_id == MLModel.id)
        .filter(MLModel.owner_id == user.id)
        .group_by(MLModel.name)
        .order_by(func.count(PredictionLog.id).desc())
        .limit(10)
        .all()
    )
    return [{"model_name": r.name, "prediction_count": r.count} for r in rows]
