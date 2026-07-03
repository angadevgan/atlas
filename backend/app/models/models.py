import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Enum, Float, Integer, JSON, Text, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(str, enum.Enum):
    CLASSIFICATION = "classification"
    REGRESSION = "regression"


class ActivityAction(str, enum.Enum):
    UPLOAD_DATASET = "upload_dataset"
    UPLOAD_MODEL = "upload_model"
    TRAIN_MODEL = "train_model"
    PREDICT = "predict"
    DELETE_DATASET = "delete_dataset"
    DELETE_MODEL = "delete_model"
    UPDATE_PROFILE = "update_profile"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    datasets = relationship("Dataset", back_populates="owner", cascade="all, delete-orphan")
    models = relationship("MLModel", back_populates="owner", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (Index("ix_datasets_owner_created", "owner_id", "created_at"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size_bytes = Column(Integer, default=0)
    n_rows = Column(Integer)
    n_columns = Column(Integer)
    target_column = Column(String)
    column_schema = Column(JSON)
    missing_value_count = Column(Integer, default=0)
    duplicate_row_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="datasets")
    training_jobs = relationship("TrainingJob", back_populates="dataset", cascade="all, delete-orphan")


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    dataset_id = Column(UUID(as_uuid=False), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    task_type = Column(Enum(TaskType), nullable=False)
    algorithm = Column(String, nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    priority = Column(Integer, default=5)
    hyperparameters = Column(JSON)
    error_message = Column(Text, nullable=True)
    queued_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    dataset = relationship("Dataset", back_populates="training_jobs")
    model = relationship("MLModel", back_populates="training_job", uselist=False)


class MLModel(Base):
    """
    Supports simple version chains: a model with the same `name` uploaded again
    gets version = previous_max + 1 and parent_model_id pointing at the prior
    version, so the API can walk the chain for a "version history" view.
    """
    __tablename__ = "models"
    __table_args__ = (Index("ix_models_owner_created", "owner_id", "created_at"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    training_job_id = Column(UUID(as_uuid=False), ForeignKey("training_jobs.id"), unique=True, nullable=True)
    parent_model_id = Column(UUID(as_uuid=False), ForeignKey("models.id"), nullable=True)

    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    framework = Column(String, default="scikit-learn")
    version = Column(Integer, default=1)
    task_type = Column(Enum(TaskType), nullable=False)
    file_path = Column(String)
    file_size_bytes = Column(Integer, default=0)
    metrics = Column(JSON)
    feature_columns = Column(JSON)
    tags = Column(JSON, default=list)
    is_bookmarked = Column(Integer, default=0)  # 0/1
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="models")
    training_job = relationship("TrainingJob", back_populates="model")
    predictions = relationship("PredictionLog", back_populates="model", cascade="all, delete-orphan")
    parent = relationship("MLModel", remote_side=[id])


class PredictionLog(Base):
    __tablename__ = "prediction_logs"
    __table_args__ = (Index("ix_predictions_model_created", "model_id", "created_at"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    model_id = Column(UUID(as_uuid=False), ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    input_payload = Column(JSON)
    output = Column(JSON)
    confidence = Column(Float, nullable=True)
    latency_ms = Column(Float)
    cache_hit = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    model = relationship("MLModel", back_populates="predictions")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (Index("ix_activity_user_created", "user_id", "created_at"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(Enum(ActivityAction), nullable=False)
    description = Column(String, nullable=False)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="activity_logs")
