# Inferra

An interactive statistical analysis platform for research in health sciences. Upload a dataset, clean it, define derived variables, and run statistical analyses — guided by AI recommendations at each step.

## What it does

Inferra walks researchers through a 7-step workflow:

1. **Upload Data** — CSV/Excel upload, stored via Supabase
2. **Data Wrangling** — Label standardization, missing value handling, filtering
3. **Describe Variables** — Write descriptions for all vaguely named variables to provide the LLM with better context
4. **Create Variables** — Derive new columns using transforms (log, normalize, map, composite scores, etc.) or custom Python formulas
5. **Choose Analysis** — AI-recommended statistical tests based on your data and research question; custom analyses also supported
6. **Data Visualization** — Box plots, scatter plots, histograms, regression plots
7. **Results** — Statistical output with AI-generated interpretation

The AI generates context-based recommendations for steps 4, 5, and 6, as well as result interpretations for step 7.
There's also a **Code Canvas** mode which tracks all the UI changes and records them as code. Users can then further modify this code and run it.

## Architecture (for running locally)

```
insight-weaver/        # React frontend (Vite + TypeScript + shadcn/ui)
backend/
  api/                 # FastAPI gateway (port 8000)
  python-service/      # Statistical analysis engine (port 8001)
  r-service/           # R analysis engine (port 8002)
```

| Service | Port | Purpose |
|---|---|---|
| Frontend (dev) | 5173 | React app |
| API gateway | 8000 | Request routing, Supabase, LLM proxy |
| Python service | 8001 | Stats tests, transforms, visualizations |
| R service | 8002 | R-based analyses |

## How to run locally

### Prerequisites

- Node.js 18+
- Python 3.11+
- R 4.3+ (optional, for R service)
- A Supabase project
- An XAI API key (for Grok LLM)

### 1. Backend

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env

# Install Python dependencies
pip install -r api/requirements.txt
pip install -r python-service/requirements.txt

# Start all services
./start-services.sh
```

Or run individually:

```bash
# API gateway
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Python service (from backend/python-service)
PYTHONPATH=. uvicorn app.analyze:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend

```bash
cd insight-weaver
npm install
npm run dev
```

### Environment variables

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

XAI_API_KEY=...
XAI_MODEL=grok-3-fast
XAI_FAST_MODEL=grok-3-fast

PYTHON_SERVICE_URL=...
R_SERVICE_URL=...
FRONTEND_ORIGIN=...
```

## Tech stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Monaco Editor

**Backend:** FastAPI, Pydantic, pandas, NumPy, SciPy, statsmodels, seaborn, matplotlib

**R service:** Plumber, dplyr, tidyr, ggplot2

**Infrastructure:** Supabase (database + auth + storage), XAI Grok (LLM)
