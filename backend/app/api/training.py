from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db, SessionLocal
from app.models.models import User, Dataset, TrainingJob, MLModel, JobStatus, TaskType, ActivityAction
from app.services.job_queue import training_queue
from app.services.ml_service import train_model
from app.services.activity import log_activity
from app.services.search_trie import rebuild_search_trie

router = APIRouter(prefix="/api/training", tags=["training"])


class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    task_type: TaskType
    algorithm: str
    model_name: str
    priority: int = 5
    hyperparameters: dict | None = None


def _run_training_job(job_id: str, payload: dict):
    db = SessionLocal()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.RUNNING
        db.commit()

        result = train_model(
            dataset_path=payload["dataset_path"],
            target_column=payload["target_column"],
            task_type=payload["task_type"],
            algorithm=payload["algorithm"],
            hyperparameters=payload.get("hyperparameters"),
        )

        # version chaining: bump version if a model with this name already exists
        existing = (
            db.query(MLModel)
            .filter(MLModel.owner_id == payload["owner_id"], MLModel.name == payload["model_name"])
            .order_by(MLModel.version.desc())
            .first()
        )
        version = (existing.version + 1) if existing else 1

        model = MLModel(
            owner_id=payload["owner_id"],
            training_job_id=job.id,
            parent_model_id=existing.id if existing else None,
            name=payload["model_name"],
            description=payload.get("description"),
            framework="scikit-learn",
            version=version,
            task_type=payload["task_type"],
            file_path=result["file_path"],
            file_size_bytes=result["file_size_bytes"],
            metrics=result["metrics"],
            feature_columns=result["feature_columns"],
            tags=payload.get("tags") or [],
        )
        db.add(model)

        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        db.commit()

        log_activity(db, payload["owner_id"], ActivityAction.TRAIN_MODEL,
                     f"Trained model '{model.name}' v{model.version}", meta={"model_id": model.id})
        rebuild_search_trie(SessionLocal)

    except Exception as exc:  # noqa: BLE001
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("")
def start_training(body: TrainRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dataset = db.query(Dataset).filter(Dataset.id == body.dataset_id, Dataset.owner_id == user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    job = TrainingJob(
        dataset_id=dataset.id, task_type=body.task_type, algorithm=body.algorithm,
        priority=body.priority, hyperparameters=body.hyperparameters, status=JobStatus.QUEUED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    training_queue.push(
        job_id=job.id,
        priority=body.priority,
        payload={
            "dataset_path": dataset.file_path,
            "target_column": dataset.target_column,
            "task_type": body.task_type.value,
            "algorithm": body.algorithm,
            "hyperparameters": body.hyperparameters,
            "owner_id": user.id,
            "model_name": body.model_name,
        },
    )

    return {"job_id": job.id, "status": job.status, "queue_position": len(training_queue)}


@router.get("/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job.id, "status": job.status, "queued_at": job.queued_at,
        "completed_at": job.completed_at, "error_message": job.error_message,
    }
    if job.model:
        response["model_id"] = job.model.id
        response["metrics"] = job.model.metrics
        response["version"] = job.model.version

    return response
