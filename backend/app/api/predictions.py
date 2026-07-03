import csv
import io
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.models import User, MLModel, PredictionLog, ActivityAction
from app.services.lru_cache import prediction_cache, LRUCache
from app.services.rate_limiter import predict_rate_limiter
from app.services.ml_service import predict as run_prediction
from app.services.activity import log_activity

router = APIRouter(prefix="/api/predict", tags=["predictions"])


class PredictRequest(BaseModel):
    input: dict


@router.post("/{model_id}")
def predict(model_id: str, body: PredictRequest, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):

    if not predict_rate_limiter.allow(client_key=user.id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")

    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    cache_key = LRUCache.make_key(model_id, body.input)
    start = time.perf_counter()

    cached = prediction_cache.get(cache_key)
    if cached is not None:
        latency_ms = (time.perf_counter() - start) * 1000
        _log(db, model_id, body.input, cached, latency_ms, True)
        log_activity(db, user.id, ActivityAction.PREDICT, f"Ran prediction on '{model.name}'")
        return {"result": cached, "cache_hit": True, "latency_ms": round(latency_ms, 3)}

    result = run_prediction(model.file_path, body.input)
    prediction_cache.put(cache_key, result)

    latency_ms = (time.perf_counter() - start) * 1000
    _log(db, model_id, body.input, result, latency_ms, False)
    log_activity(db, user.id, ActivityAction.PREDICT, f"Ran prediction on '{model.name}'")

    return {"result": result, "cache_hit": False, "latency_ms": round(latency_ms, 3)}


@router.get("/{model_id}/history")
def prediction_history(
    model_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    q = db.query(PredictionLog).filter(PredictionLog.model_id == model_id)
    total = q.count()
    items = q.order_by(PredictionLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": p.id, "input": p.input_payload, "output": p.output,
                "confidence": p.confidence, "latency_ms": p.latency_ms,
                "cache_hit": bool(p.cache_hit), "created_at": p.created_at,
            }
            for p in items
        ],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/{model_id}/history/export")
def export_prediction_history(model_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = db.query(MLModel).filter(MLModel.id == model_id, MLModel.owner_id == user.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    logs = db.query(PredictionLog).filter(PredictionLog.model_id == model_id).order_by(
        PredictionLog.created_at.desc()
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["created_at", "input", "output", "confidence", "latency_ms", "cache_hit"])
    for log in logs:
        writer.writerow([log.created_at, log.input_payload, log.output, log.confidence,
                          log.latency_ms, log.cache_hit])
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={model.name}_predictions.csv"},
    )


@router.get("/cache/stats")
def cache_stats(user: User = Depends(get_current_user)):
    return prediction_cache.stats()


def _log(db: Session, model_id: str, input_payload: dict, output: dict, latency_ms: float, cache_hit: bool):
    log = PredictionLog(
        model_id=model_id, input_payload=input_payload, output=output,
        confidence=output.get("confidence"), latency_ms=latency_ms, cache_hit=1 if cache_hit else 0,
    )
    db.add(log)
    db.commit()
