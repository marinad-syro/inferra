
# Backend instructions — FastAPI replacement for Lovable backend

## 1. Goal

Replace the existing Lovable backend (the whole Lovable project is in the insight-weaver folder) with a custom FastAPI-based backend that:

- serves the Lovable-generated React frontend (already available locally);
- centralises all LLM usage via a single adapter (XAI / Grok);
- decides which **Python analysis function** to run using deterministic rules (LLM fallback only if needed);
- executes statistical analyses via a separate Python analysis service (SciPy / statsmodels / seaborn);
- persists jobs, provenance, and outputs using Supabase (starting from Lovable’s existing Supabase schema and adapting as needed).

This backend should be lean, explicit, and easy to iterate on.

---

## 2. High-level architecture

- **Frontend**: React app exported from Lovable (already exists)
- **API gateway**: FastAPI (orchestration, decision logic, auth, LLM proxy)
- **Analysis service**: separate Python service for heavy stats (SciPy, statsmodels, seaborn)
- **LLM**: XAI / Grok, accessed only via a backend adapter
- **Database & storage**: Supabase (reuse Lovable’s current schema as a baseline)
- **Optional**: background worker for long-running jobs

The API gateway must *not* import heavy scientific libraries.

---

## 3. Repository structure (backend only)

Create the following structure inside `backend/`:

backend/
├─ api/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ routes/
│  │  │  ├─ health.py
│  │  │  ├─ decide.py
│  │  │  ├─ run.py
│  │  │  └─ llm_proxy.py
│  │  ├─ services/
│  │  │  ├─ decision.py
│  │  │  ├─ llm_adapter.py
│  │  │  └─ supabase_client.py
│  │  ├─ models/
│  │  │  └─ schemas.py
│  │  └─ config/
│  │     └─ deterministic_rules.json
│  ├─ Dockerfile
│  └─ requirements.txt
│
├─ python-service/
│  ├─ app/
│  │  ├─ analyze.py
│  │  ├─ param_mapper.py
│  │  └─ plots.py
│  ├─ Dockerfile
│  └─ requirements.txt
│
├─ docker-compose.yml
└─ .env.example

This is a convention, not a framework requirement.

---

## 4. Core backend responsibilities

### API gateway (FastAPI)

Responsible for:
- request validation and auth (Supabase JWT);
- deciding which Python analysis to run;
- forwarding execution to `python-service`;
- centralising all LLM calls;
- writing job metadata and provenance to Supabase.

### Python analysis service

Responsible for:
- running statistical analyses using SciPy / statsmodels / seaborn;
- mapping abstract parameter hints → concrete function arguments;
- generating plots and structured results;
- returning deterministic outputs and environment metadata.

---

## 5. Deterministic decision logic (no classifier)

### Purpose
Map a natural-language analysis request + dataset schema → a specific
Python **library + function**.

### Rules
Rules live in a single JSON file:

`api/app/config/deterministic_rules.json`

Each rule includes:
- keywords / phrases to match in the prompt;
- minimal schema requirements (e.g. numeric columns, grouping variable);
- target Python library and function;
- a lightweight parameter mapping hint;
- a short human-readable explanation.

Example rule (simplified):

```json
{
  "id": "ttest_ind",
  "match_terms": ["t-test", "two-sample t-test"],
  "required_schema": {
    "min_numeric_columns": 2,
    "has_group_column": true
  },
  "library": "scipy.stats",
  "function": "ttest_ind",
  "param_map": {
    "group_col": { "type": "group" },
    "value_col": { "type": "value" }
  },
  "explanation": "Independent two-sample t-test using scipy.stats.ttest_ind."
}

Decision flow
	1.	Inspect dataset schema conservatively (numeric vs categorical, unique counts).
	2.	Apply deterministic rules.
	3.	If exactly one rule matches → return it with high confidence.
	4.	If no rule matches → return decision_source: "none" (caller may invoke LLM).
	5.	Do not guess when ambiguous.

⸻

6. LLM integration (centralised)

All LLM usage must go through a single backend adapter.

LLM proxy endpoint

POST /api/llm-proxy
	•	Used whenever the Lovable backend previously called an LLM.
	•	Calls XAI / Grok via llm_adapter.py.
	•	Logs prompt, metadata, latency, and raw response.
	•	Enables caching, rate limiting, and future prompt control.

No frontend or service should call the LLM provider directly.

⸻

7. Analysis execution flow
	1.	Frontend sends analysis request.
	2.	API gateway calls /api/decide.
	3.	If deterministic rule matched:
	•	forward decision to /api/run.
	4.	/api/run:
	•	validates request;
	•	writes initial job row to Supabase;
	•	forwards execution to python-service /analyze.
	5.	python-service:
	•	loads dataset;
	•	maps param_map hints → function arguments;
	•	runs analysis;
	•	saves plots / outputs;
	•	returns results + metadata.
	6.	API gateway:
	•	writes provenance and output references to Supabase;
	•	returns job result or job ID.

⸻

8. Supabase usage
	•	Start from Lovable’s existing Supabase schema.
	•	Reuse tables where possible (users, jobs, files, metadata).
	•	Extend only when necessary (e.g. provenance, decision logs).

Typical backend responsibilities:
	•	validate Supabase JWTs on incoming requests;
	•	write job lifecycle events (created → running → completed / failed);
	•	store provenance: decision source, rule ID, library/function used, package versions;
	•	store signed URLs for large outputs (plots, CSVs).

Schema redesign is not required upfront.

⸻

9. Python analysis service expectations
	•	Expose POST /analyze.
	•	Accept:
	•	dataset reference (URL or inline);
	•	decision object (library, function, param hints).
	•	Support a small initial set of analyses:
	•	scipy.stats.ttest_ind
	•	scipy.stats.ttest_rel
	•	scipy.stats.f_oneway
	•	scipy.stats.pearsonr
	•	scipy.stats.spearmanr
	•	statsmodels.formula.api.ols
	•	basic seaborn plots (boxplot, scatter, histogram, kde, regplot)
	•	Return:
	•	structured numeric results;
	•	optional plot file paths;
	•	environment metadata (package versions, RNG seed).

⸻

10. Environment & deployment notes
	•	Use Docker for both API gateway and python-service.
	•	Keep scientific dependencies isolated in python-service.
	•	Use environment variables for all secrets and URLs.
	•	Provide a minimal docker-compose.yml for local development.

Required env vars (example):

SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_JWT_SECRET=
LLM_API_KEY=
LLM_ENDPOINT=
PYTHON_SERVICE_URL=


⸻

11. Guardrails & non-goals
	•	Do not implement a statistical classifier at this stage.
	•	Do not tightly couple FastAPI to SciPy or seaborn.
	•	Prefer “no decision” over incorrect automatic decisions.
	•	Optimise for transparency and debuggability over cleverness.

⸻

12. Expected outcome

After initial implementation:
	•	the Lovable frontend runs unchanged and is in the frontend folder;
	•	all LLM calls are routed through the new backend, which is in the backend folder;
	•	common statistical requests resolve via deterministic rules;
	•	analysis execution is isolated and reproducible;
	•	Supabase continues to act as the system of record.

Further refinement (rules, UI control, async jobs) happens incrementally.