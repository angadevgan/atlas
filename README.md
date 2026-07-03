# Atlas

A platform to upload ML models and datasets, train models, test predictions,
and monitor everything through a dashboard. Built full-stack: Next.js +
TypeScript frontend, FastAPI + PostgreSQL backend.

## What's built

**Auth** — register, login, JWT, profile update (forgot-password is *not*
included — see "Known gaps" below, it needs email infra that's out of scope
for a portfolio project).

**Dataset Manager** — upload CSV (drag-and-drop or click), preview first 10
rows, see missing-value/duplicate-row counts computed at upload time, search,
paginate, delete.

**Model Manager** — train a model from any uploaded dataset (Random Forest /
Logistic / Linear Regression), automatic version chaining (retrain with the
same name → v2, v3...), version history view, side-by-side comparison,
bookmarking, tags/description editing, delete.

**Prediction Playground** — send JSON input to a trained model, see the
prediction + confidence + latency + cache hit/miss, browse prediction
history, export history as CSV.

**Activity Page** — timeline of every upload/train/predict/delete action.

**Analytics + Dashboard** — total models/datasets/predictions, storage used,
predictions-per-day chart, model usage breakdown.

**Global search** — type in the topbar, get live suggestions across models
and datasets.

**UI** — light/dark mode toggle, the exact palette you specified (warm ivory
/ deep forest sidebar / terracotta accent), sidebar + topbar + breadcrumb
layout in the Linear/Notion/GitHub style, no gradients or glassmorphism.

## Data structures implemented for real (not just mentioned)

| Where | Structure | Why |
|---|---|---|
| `job_queue.py` | Min-heap priority queue | O(log n) scheduling of training jobs by priority |
| `lru_cache.py` | OrderedDict LRU | O(1) cached inference for repeated prediction inputs |
| `rate_limiter.py` | Deque sliding window | O(1) amortized; avoids fixed-window burst problem |
| `search_trie.py` | Trie (prefix tree) | O(k) prefix search for autocomplete, independent of catalog size |

## Known gaps (be upfront about these in interviews — it's a strength, not a weakness, to know your own scope)

- **No forgot-password flow** — needs a transactional email service (e.g.
  SendGrid); skipped to avoid adding infra dependencies with low interview
  value relative to effort.
- **No OAuth (Google/GitHub login)** — same reasoning; JWT email/password
  auth demonstrates the same underlying concepts.
- **In-memory cache/rate-limiter/queue, not Redis-backed** — fine for a
  single-process portfolio deployment; note this explicitly as a "would
  swap for Redis + Celery at production scale" talking point.
- **Global search is a simple prefix Trie**, not fuzzy/full-text search —
  intentional scope choice, still a real, correct data structure use.
- **No image/video/audio dataset support** — CSV only, keeps the ML
  pipeline honest and explainable.

## Project structure

```
atlas/
  backend/
    app/
      api/          route handlers (auth, datasets, training, predictions,
                     models_routes, activity, search, dashboard)
      core/         config + JWT auth
      db/           SQLAlchemy session
      models/       ORM models (normalized schema incl. activity_logs)
      services/     job_queue, lru_cache, rate_limiter, search_trie,
                     ml_service, activity
      main.py
    requirements.txt
    .env.example

  frontend/
    app/
      page.tsx             dashboard
      datasets/page.tsx
      models/page.tsx
      predict/page.tsx
      activity/page.tsx
      analytics/page.tsx
      globals.css          light/dark theme tokens
    components/
      layout/              Sidebar, Topbar, DashboardShell
      ui/Card.tsx
      AuthGate.tsx
      AuthedLayout.tsx
      ThemeProvider.tsx
      QueryProvider.tsx
    lib/api.ts              typed API client, every endpoint
    tailwind.config.ts
    .env.local.example
```

## Local setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (a free [Neon](https://neon.tech) or [Supabase](https://supabase.com)
  project works fine — no local Postgres install needed)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env — paste your real DATABASE_URL

uvicorn app.main:app --reload --port 8000
```

Check it worked: open `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open the URL it prints (usually `http://localhost:3000`, but check the
terminal — it'll pick a different port if 3000 is taken).

> If your frontend runs on a port other than 3000, add it to `allow_origins`
> in `backend/app/main.py` or you'll hit a CORS error.

## Try it

1. Register an account
2. Upload a CSV (any dataset with a clear target column works — Iris,
   Titanic, or your own)
3. Train a model
4. Test a prediction in the Playground, then export the history as CSV
5. Check the Dashboard and Analytics pages for the charts to populate

## Suggested build order if extending this further

1. Get end-to-end flow (upload → train → predict) fully working with your
   real dataset
2. Add feature-importance / explainability view per model (`.feature_importances_`
   for Random Forest — a small addition, high interview value given an
   ML background)
3. Dockerize both services + docker-compose for one-command setup
4. Deploy: backend to Render/Railway, frontend to Vercel — a live demo
   link matters more on a resume than a repo link
