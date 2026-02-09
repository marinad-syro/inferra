# Inferra Backend - FastAPI Implementation

FastAPI-based backend for the Inferra statistical analysis platform. This backend replaces the Lovable backend while maintaining full compatibility with the existing React frontend.

## Architecture

```
┌─────────────────┐
│  React Frontend │ (Lovable-generated)
│  (Static files) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     FastAPI API Gateway             │
│  - Request validation & auth        │
│  - Decision logic (deterministic)   │
│  - LLM proxy (XAI/Grok)            │
│  - Job orchestration                │
│  - Supabase integration             │
└────────┬────────────────────────────┘
         │
         ├──────────────┬─────────────┐
         ▼              ▼             ▼
   ┌─────────┐   ┌──────────────┐  ┌────────────┐
   │ Supabase│   │Python Service│  │ XAI/Grok   │
   │  (DB)   │   │ (Statistics) │  │    LLM     │
   └─────────┘   └──────────────┘  └────────────┘
```

## Features

- **Deterministic Decision Logic**: Rule-based analysis selection with 11 pre-configured analyses
- **Centralized LLM Integration**: All LLM calls routed through XAI/Grok adapter
- **Isolated Analysis Service**: Heavy scientific computations in separate Python service
- **Supabase Integration**: Job tracking, provenance, and user management
- **Docker-based Deployment**: Easy local development and production deployment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Supabase account and project
- XAI/Grok API key
- Git (for cloning)

### Setup

1. **Clone the repository** (if not already done)

2. **Configure environment variables**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Required environment variables**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key-here
   SUPABASE_JWT_SECRET=your-jwt-secret-here
   LLM_API_KEY=your-xai-api-key-here
   LLM_ENDPOINT=https://api.x.ai/v1
   LLM_MODEL=grok-beta
   ```

4. **Start services**:
   ```bash
   docker-compose up --build
   ```

5. **Access the API**:
   - API Gateway: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Interactive API: http://localhost:8000/redoc

## API Endpoints

### Health Check
```bash
GET /api/health
```

Returns health status of API gateway and dependencies.

### Decision Endpoint
```bash
POST /api/decide
```

Determine which analysis to run based on prompt and dataset schema.

**Request**:
```json
{
  "prompt": "Compare means between two groups",
  "dataset_schema": {
    "columns": [
      {"name": "group", "type": "categorical"},
      {"name": "value", "type": "numeric"}
    ],
    "row_count": 100
  }
}
```

**Response**:
```json
{
  "rule_id": "ttest_ind",
  "library": "scipy.stats",
  "function": "ttest_ind",
  "confidence": 0.9,
  "source": "deterministic",
  "explanation": "Independent two-sample t-test..."
}
```

### Analysis Execution
```bash
POST /api/analyze
```

Execute complete analysis (decision + execution in one call).

**Request**:
```json
{
  "dataset_reference": "path/to/data.csv",
  "prompt": "Compare means between two groups",
  "dataset_schema": {
    "columns": [
      {"name": "group", "type": "categorical"},
      {"name": "value", "type": "numeric"}
    ]
  }
}
```

**Response**:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "results": {
    "statistics": {
      "t_statistic": 2.45,
      "p_value": 0.018,
      "group1_mean": 10.5,
      "group2_mean": 12.3
    }
  },
  "decision": {...}
}
```

### LLM Proxy
```bash
POST /api/llm-proxy
```

Centralized endpoint for LLM API calls.

### Job Status
```bash
GET /api/jobs/{job_id}
```

Retrieve job details and results.

## Supported Analyses

### Statistical Tests
1. **Independent t-test** (`scipy.stats.ttest_ind`)
2. **Paired t-test** (`scipy.stats.ttest_rel`)
3. **One-way ANOVA** (`scipy.stats.f_oneway`)
4. **Pearson correlation** (`scipy.stats.pearsonr`)
5. **Spearman correlation** (`scipy.stats.spearmanr`)
6. **Linear regression** (`statsmodels.formula.api.ols`)

### Visualizations
7. **Box plot** (`seaborn.boxplot`)
8. **Scatter plot** (`seaborn.scatterplot`)
9. **Histogram** (`seaborn.histplot`)
10. **KDE plot** (`seaborn.kdeplot`)
11. **Regression plot** (`seaborn.regplot`)

## Development

### Project Structure

```
backend/
├── api/                        # FastAPI API Gateway
│   ├── app/
│   │   ├── main.py            # Main application
│   │   ├── routes/            # API endpoints
│   │   │   ├── health.py
│   │   │   ├── decide.py
│   │   │   ├── run.py
│   │   │   └── llm_proxy.py
│   │   ├── services/          # Business logic
│   │   │   ├── decision.py
│   │   │   ├── llm_adapter.py
│   │   │   └── supabase_client.py
│   │   ├── models/
│   │   │   └── schemas.py     # Pydantic models
│   │   └── config/
│   │       ├── settings.py    # Configuration
│   │       └── deterministic_rules.json
│   ├── Dockerfile
│   └── requirements.txt
│
├── python-service/            # Statistical Analysis Service
│   ├── app/
│   │   ├── analyze.py         # Main service
│   │   ├── param_mapper.py    # Parameter mapping
│   │   └── plots.py           # Plotting utilities
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml
├── .env.example
└── README.md
```

### Running Locally Without Docker

**API Gateway**:
```bash
cd api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Python Service**:
```bash
cd python-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.analyze:app --reload --port 8001
```

### Adding New Analyses

1. **Add rule to deterministic_rules.json**:
   ```json
   {
     "id": "new_analysis",
     "match_terms": ["keyword1", "keyword2"],
     "required_schema": {...},
     "library": "library.name",
     "function": "function_name",
     "param_map": {...},
     "explanation": "Description"
   }
   ```

2. **Implement in python-service**:
   - Add function handler in `analyze.py`
   - Update parameter mapping in `param_mapper.py` if needed
   - Add plotting logic in `plots.py` if visualization

3. **Test the new analysis**:
   ```bash
   curl -X POST http://localhost:8000/api/decide \
     -H "Content-Type: application/json" \
     -d '{"prompt": "your test prompt", "dataset_schema": {...}}'
   ```

## Testing

### Manual Testing with curl

**Health Check**:
```bash
curl http://localhost:8000/api/health
```

**Decision Test**:
```bash
curl -X POST http://localhost:8000/api/decide \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "compare two groups with t-test",
    "dataset_schema": {
      "columns": [
        {"name": "group", "type": "categorical", "unique_count": 2},
        {"name": "value", "type": "numeric"}
      ],
      "row_count": 100
    }
  }'
```

### Interactive API Documentation

Visit http://localhost:8000/docs to access the interactive Swagger UI for testing all endpoints.

## Troubleshooting

### Services won't start

1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs -f`
3. Verify environment variables in `.env`

### Python service unreachable

1. Check service health: `curl http://localhost:8000/api/health`
2. Check python-service logs: `docker-compose logs python-service`
3. Verify network connectivity: `docker-compose exec api-gateway ping python-service`

### Supabase connection errors

1. Verify credentials in `.env`
2. Check Supabase project is active
3. Verify JWT secret matches Supabase settings

### LLM API errors

1. Verify API key is valid
2. Check rate limits
3. Review logs: `docker-compose logs api-gateway | grep LLM`

## Production Deployment

### Docker Deployment

1. Build production images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. Set production environment variables

3. Deploy with orchestration (Kubernetes, ECS, etc.)

### Environment Configuration

Production `.env` should include:
- Production Supabase credentials
- Production LLM API keys
- Appropriate CORS origins
- Log level: WARNING or ERROR

### Security Considerations

- Use HTTPS in production
- Implement rate limiting
- Set up monitoring and alerting
- Regular security updates
- Secure secret management

## Monitoring

### Logs

View logs:
```bash
docker-compose logs -f
```

Filter by service:
```bash
docker-compose logs -f api-gateway
docker-compose logs -f python-service
```

### Metrics

Key metrics to monitor:
- Request latency (API gateway)
- Analysis execution time (python-service)
- LLM API call latency
- Error rates
- Job success/failure rates

## License

See main project LICENSE file.

## Support

For issues and questions, see the main project documentation or create an issue in the project repository.
