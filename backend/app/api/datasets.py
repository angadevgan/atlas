import os
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import User, Dataset, ActivityAction
from app.services.activity import log_activity
from app.services.search_trie import rebuild_search_trie
from app.db.session import SessionLocal

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post("/upload")
async def upload_dataset(
    target_column: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported for now")

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4()}.csv"
    stored_path = os.path.join(settings.upload_dir, stored_name)

    contents = await file.read()
    with open(stored_path, "wb") as f:
        f.write(contents)

    df = pd.read_csv(stored_path)
    if target_column not in df.columns:
        os.remove(stored_path)
        raise HTTPException(status_code=400, detail=f"target_column '{target_column}' not found in CSV headers")

    dataset = Dataset(
        owner_id=user.id,
        filename=file.filename,
        file_path=stored_path,
        file_size_bytes=len(contents),
        n_rows=len(df),
        n_columns=len(df.columns),
        target_column=target_column,
        column_schema={col: str(dtype) for col, dtype in df.dtypes.items()},
        missing_value_count=int(df.isnull().sum().sum()),
        duplicate_row_count=int(df.duplicated().sum()),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    log_activity(db, user.id, ActivityAction.UPLOAD_DATASET, f"Uploaded dataset '{file.filename}'",
                 meta={"dataset_id": dataset.id})
    rebuild_search_trie(SessionLocal)

    return _serialize(dataset)


@router.get("")
def list_datasets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    q = db.query(Dataset).filter(Dataset.owner_id == user.id)
    if search:
        q = q.filter(Dataset.filename.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Dataset.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_serialize(d) for d in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = pd.read_csv(dataset.file_path, nrows=10)
    return {"columns": list(df.columns), "rows": df.fillna("").to_dict(orient="records")}


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    name = dataset.filename
    db.delete(dataset)
    db.commit()

    log_activity(db, user.id, ActivityAction.DELETE_DATASET, f"Deleted dataset '{name}'")
    rebuild_search_trie(SessionLocal)

    return {"status": "deleted"}


def _serialize(d: Dataset) -> dict:
    return {
        "id": d.id, "filename": d.filename, "file_size_bytes": d.file_size_bytes,
        "n_rows": d.n_rows, "n_columns": d.n_columns, "target_column": d.target_column,
        "column_schema": d.column_schema, "missing_value_count": d.missing_value_count,
        "duplicate_row_count": d.duplicate_row_count, "created_at": d.created_at,
    }
