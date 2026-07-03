import os

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db, SessionLocal
from app.models.models import User, MLModel, PredictionLog, ActivityAction
from app.services.activity import log_activity
from app.services.search_trie import rebuild_search_trie

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelUpdateRequest(BaseModel):
    description: str | None = None
    tags: list[str] | None = None


@router.get("")
def list_models(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    bookmarked_only: bool = False,
):
    q = db.query(MLModel).filter(MLModel.owner_id == user.id)
    if search:
        q = q.filter(MLModel.name.ilike(f"%{search}%"))
    if bookmarked_only:
        q = q.filter(MLModel.is_bookmarked == 1)

    total = q.count()
    items = q.order_by(MLModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {"items": [_serialize(m) for m in items], "total": total, "page": page, "page_size": page_size}


@router.get("/compare")
def compare_models(ids: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """ids: comma-separated model IDs, e.g. ?ids=id1,id2,id3"""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    models = db.query(MLModel).filter(MLModel.id.in_(id_list), MLModel.owner_id == user.id).all()
    if not models:
        raise HTTPException(status_code=404, detail="No matching models found")
    return [_serialize(m) for m in models]


@router.get("/{model_id}")
def get_model(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _serialize(model)


@router.get("/{model_id}/versions")
def get_version_history(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    chain = db.query(MLModel).filter(MLModel.owner_id == user.id, MLModel.name == model.name).order_by(
        MLModel.version.asc()
    ).all()
    return [_serialize(m) for m in chain]


@router.put("/{model_id}")
def update_model(model_id: str, body: ModelUpdateRequest, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if body.description is not None:
        model.description = body.description
    if body.tags is not None:
        model.tags = body.tags
    db.commit()
    db.refresh(model)
    return _serialize(model)


@router.post("/{model_id}/bookmark")
def toggle_bookmark(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    model.is_bookmarked = 0 if model.is_bookmarked else 1
    db.commit()
    return {"is_bookmarked": bool(model.is_bookmarked)}


@router.delete("/{model_id}")
def delete_model(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    name = model.name
    if model.file_path and os.path.exists(model.file_path):
        os.remove(model.file_path)
    db.delete(model)
    db.commit()

    log_activity(db, user.id, ActivityAction.DELETE_MODEL, f"Deleted model '{name}'")
    rebuild_search_trie(SessionLocal)

    return {"status": "deleted"}


@router.get("/{model_id}/analytics")
def model_analytics(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    row = (
        db.query(
            func.count(PredictionLog.id).label("total_predictions"),
            func.avg(PredictionLog.latency_ms).label("avg_latency_ms"),
            func.avg(PredictionLog.cache_hit).label("cache_hit_rate"),
        )
        .filter(PredictionLog.model_id == model_id)
        .first()
    )

    return {
        "model_id": model_id,
        "total_predictions": row.total_predictions or 0,
        "avg_latency_ms": round(row.avg_latency_ms, 3) if row.avg_latency_ms else None,
        "cache_hit_rate": round(row.cache_hit_rate, 4) if row.cache_hit_rate else 0.0,
    }


def _serialize(m: MLModel) -> dict:
    return {
        "id": m.id, "name": m.name, "description": m.description, "framework": m.framework,
        "version": m.version, "task_type": m.task_type, "metrics": m.metrics,
        "feature_columns": m.feature_columns, "tags": m.tags or [],
        "is_bookmarked": bool(m.is_bookmarked), "file_size_bytes": m.file_size_bytes,
        "created_at": m.created_at,
    }
