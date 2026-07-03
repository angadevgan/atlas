from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, datasets, training, predictions, models_routes, activity, search, dashboard
from app.db.session import Base, engine, SessionLocal
from app.services.job_queue import training_queue, JobWorker
from app.services.search_trie import rebuild_search_trie
from app.api.training import _run_training_job


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    worker = JobWorker(queue=training_queue, handler=_run_training_job)
    worker.start()

    rebuild_search_trie(SessionLocal)

    yield

    worker.stop()


app = FastAPI(title="Atlas", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://atlas-kappa-sooty.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(predictions.router)
app.include_router(models_routes.router)
app.include_router(activity.router)
app.include_router(search.router)
app.include_router(dashboard.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
