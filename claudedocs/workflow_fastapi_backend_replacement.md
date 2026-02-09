# Implementation Workflow: FastAPI Backend Replacement

**Project**: Inferra Backend Migration
**Generated**: 2026-02-06
**Strategy**: Systematic Enterprise Implementation
**Estimated Phases**: 6 Major Phases

---

## Executive Summary

This workflow provides a systematic implementation plan to replace the existing Lovable backend with a custom FastAPI-based backend while maintaining frontend compatibility. The implementation prioritizes deterministic decision logic, centralized LLM integration, and isolated statistical analysis services.

### Key Objectives
1. Replace Lovable backend with FastAPI gateway
2. Serve existing React frontend unchanged
3. Centralize all LLM usage via XAI/Grok adapter
4. Implement deterministic rule-based analysis decision logic
5. Isolate statistical analysis in separate Python service
6. Maintain Supabase schema compatibility

### Success Criteria
- Frontend runs unchanged with new backend
- All LLM calls routed through backend adapter
- Statistical requests resolve via deterministic rules
- Analysis execution is isolated and reproducible
- Supabase remains system of record

---

## Architecture Overview

```
┌─────────────────┐
│  React Frontend │ (Lovable-generated, unchanged)
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

---

## Phase 1: Project Foundation & Repository Setup

### 1.1 Repository Structure Creation
**Dependencies**: None
**Validation**: Directory structure exists, .gitignore configured

**Tasks**:
- [ ] Create `backend/` root directory structure
- [ ] Create `backend/api/` subdirectory with app structure:
  - `backend/api/app/main.py`
  - `backend/api/app/routes/` (health, decide, run, llm_proxy)
  - `backend/api/app/services/` (decision, llm_adapter, supabase_client)
  - `backend/api/app/models/schemas.py`
  - `backend/api/app/config/deterministic_rules.json`
- [ ] Create `backend/python-service/` with app structure:
  - `backend/python-service/app/analyze.py`
  - `backend/python-service/app/param_mapper.py`
  - `backend/python-service/app/plots.py`
- [ ] Create Docker configuration files:
  - `backend/api/Dockerfile`
  - `backend/api/requirements.txt`
  - `backend/python-service/Dockerfile`
  - `backend/python-service/requirements.txt`
  - `backend/docker-compose.yml`
- [ ] Create `backend/.env.example` with required environment variables
- [ ] Create `.gitignore` entries for Python, Docker, and environment files
- [ ] Create `backend/README.md` with setup instructions

**Outputs**:
- Complete directory structure
- Dockerfiles for both services
- Environment configuration template
- Initial documentation

---

## Phase 2: Core FastAPI Gateway Implementation

### 2.1 FastAPI Application Bootstrap
**Dependencies**: Phase 1.1
**Validation**: FastAPI server starts, health endpoint responds

**Tasks**:
- [ ] Implement `backend/api/app/main.py`:
  - Initialize FastAPI application
  - Configure CORS for frontend origin
  - Add middleware for logging and error handling
  - Register route modules
  - Configure Supabase client initialization
- [ ] Define `backend/api/requirements.txt`:
  - `fastapi`
  - `uvicorn[standard]`
  - `pydantic`
  - `supabase-py`
  - `httpx` (for internal service calls)
  - `python-jose[cryptography]` (JWT validation)
  - `python-multipart`
- [ ] Implement `backend/api/app/routes/health.py`:
  - `GET /api/health` endpoint
  - Return service status, version, dependencies health
- [ ] Create basic `backend/api/Dockerfile`:
  - Python 3.11+ base image
  - Install dependencies
  - Copy application code
  - Expose port 8000
  - CMD to run uvicorn

**Outputs**:
- Functional FastAPI application
- Health check endpoint
- Docker container for API gateway
- Basic logging and error handling

### 2.2 Configuration & Environment Management
**Dependencies**: Phase 2.1
**Validation**: Environment variables loaded, configuration accessible

**Tasks**:
- [ ] Implement `backend/api/app/config/settings.py`:
  - Load environment variables using `pydantic-settings`
  - Define configuration classes for:
    - Supabase (URL, key, JWT secret)
    - LLM (API key, endpoint, model)
    - Python service (internal URL)
    - CORS origins
    - Logging level
- [ ] Create `backend/api/app/config/__init__.py`
- [ ] Update `backend/.env.example` with all required variables:
  ```
  SUPABASE_URL=
  SUPABASE_KEY=
  SUPABASE_JWT_SECRET=
  LLM_API_KEY=
  LLM_ENDPOINT=
  LLM_MODEL=grok-beta
  PYTHON_SERVICE_URL=http://python-service:8001
  FRONTEND_ORIGIN=http://localhost:5173
  LOG_LEVEL=INFO
  ```
- [ ] Implement configuration validation on startup

**Outputs**:
- Centralized configuration management
- Environment variable validation
- Configuration documentation

### 2.3 Pydantic Models & Schemas
**Dependencies**: Phase 2.1
**Validation**: Models validate correctly, serialization works

**Tasks**:
- [ ] Implement `backend/api/app/models/schemas.py`:
  - `DatasetSchema`: column names, types, statistics
  - `AnalysisRequest`: user_id, dataset_reference, prompt, schema
  - `DecisionResult`: rule_id, library, function, param_map, confidence, source
  - `AnalysisJob`: job_id, status, user_id, timestamps, decision, results
  - `LLMProxyRequest`: prompt, context, metadata
  - `LLMProxyResponse`: response, usage, latency
  - `ErrorResponse`: error code, message, details
- [ ] Add request/response examples to schema docstrings
- [ ] Implement custom validators for complex fields

**Outputs**:
- Complete request/response models
- Input validation schemas
- API documentation via Pydantic models

---

## Phase 3: Supabase Integration Layer

### 3.1 Supabase Client Service
**Dependencies**: Phase 2.2
**Validation**: Connection established, basic CRUD operations work

**Tasks**:
- [ ] Implement `backend/api/app/services/supabase_client.py`:
  - Initialize Supabase client with credentials
  - Implement JWT validation function
  - Create database operation wrappers:
    - `create_job(user_id, analysis_request)` → job_id
    - `update_job_status(job_id, status, metadata)`
    - `get_job(job_id)` → job details
    - `save_job_results(job_id, results, provenance)`
    - `log_decision(job_id, decision_result)`
    - `log_llm_call(prompt, response, latency)`
- [ ] Implement error handling for database operations
- [ ] Add retry logic for transient failures
- [ ] Create connection health check function

**Outputs**:
- Supabase client wrapper
- Database operation functions
- Connection health monitoring

### 3.2 Authentication Middleware
**Dependencies**: Phase 3.1
**Validation**: JWT validation works, unauthorized requests rejected

**Tasks**:
- [ ] Implement `backend/api/app/middleware/auth.py`:
  - JWT validation middleware
  - Extract user_id from token
  - Add user context to request state
  - Handle token expiration and invalid tokens
- [ ] Create authentication dependency for protected routes
- [ ] Implement optional authentication for health endpoint
- [ ] Add rate limiting per user_id

**Outputs**:
- JWT validation middleware
- User context injection
- Protected route decorator

### 3.3 Schema Compatibility Analysis
**Dependencies**: Phase 3.1
**Validation**: Existing Lovable schema mapped, migration plan defined

**Tasks**:
- [ ] Analyze existing Lovable Supabase schema:
  - Document current tables, columns, relationships
  - Identify tables needed for new backend (users, jobs, files, metadata)
  - Determine required schema extensions
- [ ] Create schema compatibility document:
  - Map Lovable schema → new backend requirements
  - Identify reusable tables/columns
  - Define new tables for provenance, decision logs
  - Document migration strategy (if needed)
- [ ] Define SQL migrations (if schema changes required):
  - Add provenance columns to jobs table
  - Create decision_logs table
  - Create llm_call_logs table
- [ ] Document RLS (Row Level Security) policies

**Outputs**:
- Schema compatibility analysis document
- SQL migration scripts (if needed)
- RLS policy definitions

---

## Phase 4: Decision Logic & Deterministic Rules

### 4.1 Deterministic Rules Configuration
**Dependencies**: Phase 2.3
**Validation**: Rules JSON valid, parseable, well-structured

**Tasks**:
- [ ] Implement `backend/api/app/config/deterministic_rules.json`:
  - Define initial rule set for supported analyses:
    - `ttest_ind`: Independent two-sample t-test
    - `ttest_rel`: Paired/related t-test
    - `f_oneway`: One-way ANOVA
    - `pearsonr`: Pearson correlation
    - `spearmanr`: Spearman correlation
    - `ols`: Ordinary least squares regression
    - `boxplot`: Seaborn boxplot
    - `scatter`: Seaborn scatterplot
    - `histogram`: Seaborn histogram
    - `kde`: Kernel density estimation plot
    - `regplot`: Seaborn regression plot
  - For each rule, define:
    - `id`: Unique rule identifier
    - `match_terms`: Keywords/phrases to match
    - `required_schema`: Minimum schema requirements
    - `library`: Target Python library
    - `function`: Target function name
    - `param_map`: Parameter mapping hints
    - `explanation`: Human-readable description
- [ ] Create JSON schema for rule validation
- [ ] Add inline documentation and examples

**Outputs**:
- Complete deterministic rules configuration
- Rule validation schema
- Rule documentation

### 4.2 Decision Service Implementation
**Dependencies**: Phase 4.1, Phase 2.3
**Validation**: Decision logic returns correct rules, handles edge cases

**Tasks**:
- [ ] Implement `backend/api/app/services/decision.py`:
  - Load rules from JSON configuration
  - Implement `analyze_dataset_schema(dataset_schema)`:
    - Count numeric vs categorical columns
    - Identify potential grouping variables
    - Compute column statistics (unique counts, nulls)
    - Return conservative schema assessment
  - Implement `match_rules(prompt, dataset_schema)`:
    - Extract keywords from prompt
    - Match against rule `match_terms`
    - Validate `required_schema` constraints
    - Return matching rules with confidence scores
  - Implement `select_best_rule(matched_rules)`:
    - Return rule if exactly one match
    - Return "none" if no matches or ambiguous
    - Never guess when uncertain
  - Implement `get_decision(prompt, dataset_schema)`:
    - Orchestrate analysis → matching → selection
    - Return DecisionResult with provenance
- [ ] Add extensive logging for decision process
- [ ] Implement unit tests for decision logic

**Outputs**:
- Complete decision service
- Rule matching algorithm
- Schema analysis functions
- Decision provenance tracking

### 4.3 Decision API Endpoint
**Dependencies**: Phase 4.2, Phase 3.2
**Validation**: Endpoint returns decisions, handles authentication

**Tasks**:
- [ ] Implement `backend/api/app/routes/decide.py`:
  - `POST /api/decide` endpoint
  - Accept AnalysisRequest payload
  - Validate authentication (JWT)
  - Call decision service
  - Return DecisionResult
  - Log decision to Supabase (optional)
- [ ] Add request validation and error handling
- [ ] Implement response caching (same prompt + schema = cached decision)
- [ ] Add endpoint documentation and examples

**Outputs**:
- Decision endpoint implementation
- Request/response validation
- Decision caching logic
- API documentation

---

## Phase 5: LLM Integration & Proxy

### 5.1 LLM Adapter Service
**Dependencies**: Phase 2.2
**Validation**: XAI/Grok API calls work, errors handled gracefully

**Tasks**:
- [ ] Implement `backend/api/app/services/llm_adapter.py`:
  - Initialize XAI/Grok API client
  - Implement `call_llm(prompt, context, metadata)`:
    - Format prompt for XAI/Grok
    - Make API call with timeout and retry
    - Parse response
    - Extract usage statistics
    - Measure latency
    - Return LLMProxyResponse
  - Implement error handling:
    - API rate limits
    - Network failures
    - Invalid responses
    - Token limit exceeded
  - Add prompt/response logging
  - Implement basic caching for identical prompts
- [ ] Add configuration for model parameters (temperature, max_tokens, etc.)
- [ ] Implement fallback behavior on API failure

**Outputs**:
- XAI/Grok adapter implementation
- Error handling and retries
- Usage tracking and logging
- Response caching

### 5.2 LLM Proxy Endpoint
**Dependencies**: Phase 5.1, Phase 3.2
**Validation**: Endpoint proxies LLM calls, logs interactions

**Tasks**:
- [ ] Implement `backend/api/app/routes/llm_proxy.py`:
  - `POST /api/llm-proxy` endpoint
  - Accept LLMProxyRequest payload
  - Validate authentication
  - Call LLM adapter service
  - Log interaction to Supabase:
    - Timestamp, user_id, prompt (truncated), response (truncated)
    - Latency, usage statistics, model version
  - Return LLMProxyResponse
  - Implement rate limiting per user
- [ ] Add request/response validation
- [ ] Implement prompt injection detection (basic)
- [ ] Add cost tracking and usage quotas

**Outputs**:
- LLM proxy endpoint
- Interaction logging
- Rate limiting and cost tracking
- Security measures

### 5.3 LLM Fallback for Decision Logic
**Dependencies**: Phase 5.1, Phase 4.2
**Validation**: LLM provides fallback decisions when rules fail

**Tasks**:
- [ ] Extend `backend/api/app/services/decision.py`:
  - Implement `llm_fallback_decision(prompt, dataset_schema)`:
    - Construct structured prompt for LLM
    - Include dataset schema summary
    - Ask LLM to suggest analysis approach
    - Parse LLM response to extract library/function
    - Return DecisionResult with source="llm"
  - Integrate fallback into main decision flow:
    - If deterministic rules return "none"
    - Call LLM fallback
    - Log LLM decision with lower confidence
- [ ] Create prompt templates for LLM decision requests
- [ ] Implement LLM response parsing and validation

**Outputs**:
- LLM fallback decision logic
- Structured prompts for analysis suggestions
- LLM decision integration

---

## Phase 6: Python Analysis Service

### 6.1 Analysis Service Bootstrap
**Dependencies**: Phase 1.1
**Validation**: Service starts, health endpoint responds

**Tasks**:
- [ ] Implement `backend/python-service/app/analyze.py`:
  - Initialize FastAPI application (separate from gateway)
  - Configure logging
  - Define health endpoint: `GET /health`
  - Define main analysis endpoint: `POST /analyze`
- [ ] Define `backend/python-service/requirements.txt`:
  - `fastapi`
  - `uvicorn[standard]`
  - `pydantic`
  - `scipy`
  - `statsmodels`
  - `seaborn`
  - `matplotlib`
  - `pandas`
  - `numpy`
- [ ] Create `backend/python-service/Dockerfile`:
  - Python 3.11+ base image
  - Install scientific dependencies
  - Copy application code
  - Expose port 8001
  - CMD to run uvicorn

**Outputs**:
- Python analysis service application
- Scientific dependencies installed
- Docker container for analysis service
- Health check endpoint

### 6.2 Parameter Mapping & Preparation
**Dependencies**: Phase 6.1, Phase 4.1
**Validation**: Parameter hints correctly mapped to function arguments

**Tasks**:
- [ ] Implement `backend/python-service/app/param_mapper.py`:
  - Define `map_parameters(param_map, dataset)`:
    - Parse param_map hints from decision
    - Map hints to actual column names:
      - `{"type": "group"}` → identify grouping column
      - `{"type": "value"}` → identify numeric value column
      - `{"type": "x"}` → x-axis variable
      - `{"type": "y"}` → y-axis variable
    - Validate mapped parameters against dataset
    - Return concrete function arguments
  - Implement column type inference:
    - Detect numeric vs categorical columns
    - Identify potential grouping variables
    - Handle missing/invalid values
  - Add extensive validation and error messages

**Outputs**:
- Parameter mapping logic
- Column type inference
- Validation functions

### 6.3 Statistical Analysis Implementation
**Dependencies**: Phase 6.2
**Validation**: All target analyses execute correctly, return structured results

**Tasks**:
- [ ] Implement analysis functions in `backend/python-service/app/analyze.py`:
  - `run_ttest_ind(data, group_col, value_col)`:
    - Call `scipy.stats.ttest_ind`
    - Return t-statistic, p-value, degrees of freedom
  - `run_ttest_rel(data, col1, col2)`:
    - Call `scipy.stats.ttest_rel`
    - Return t-statistic, p-value
  - `run_f_oneway(data, group_col, value_col)`:
    - Call `scipy.stats.f_oneway`
    - Return F-statistic, p-value
  - `run_pearsonr(data, x_col, y_col)`:
    - Call `scipy.stats.pearsonr`
    - Return correlation coefficient, p-value
  - `run_spearmanr(data, x_col, y_col)`:
    - Call `scipy.stats.spearmanr`
    - Return correlation coefficient, p-value
  - `run_ols(data, formula)`:
    - Call `statsmodels.formula.api.ols`
    - Return regression summary as structured data
- [ ] Add error handling for each analysis:
  - Invalid data types
  - Insufficient sample size
  - Assumption violations
- [ ] Return structured results with metadata:
  - Test statistics, p-values, confidence intervals
  - Sample sizes, effect sizes
  - Assumptions checked
  - Package versions used

**Outputs**:
- Complete statistical analysis functions
- Structured result formats
- Error handling and validation
- Metadata inclusion

### 6.4 Plotting & Visualization
**Dependencies**: Phase 6.1
**Validation**: Plots generated correctly, saved to files

**Tasks**:
- [ ] Implement `backend/python-service/app/plots.py`:
  - `create_boxplot(data, x, y, output_path)`:
    - Use `seaborn.boxplot`
    - Save to file, return file path
  - `create_scatter(data, x, y, output_path, hue=None)`:
    - Use `seaborn.scatterplot`
    - Save to file, return file path
  - `create_histogram(data, x, output_path, bins=30)`:
    - Use `seaborn.histplot`
    - Save to file, return file path
  - `create_kde(data, x, output_path, hue=None)`:
    - Use `seaborn.kdeplot`
    - Save to file, return file path
  - `create_regplot(data, x, y, output_path)`:
    - Use `seaborn.regplot`
    - Save to file, return file path
- [ ] Configure matplotlib backend for non-interactive use
- [ ] Implement consistent styling and themes
- [ ] Add plot metadata (title, labels, timestamp)
- [ ] Create output directory management for plot files

**Outputs**:
- Plotting functions for all target visualizations
- File output management
- Consistent styling
- Plot metadata

### 6.5 Analysis Orchestration & Endpoint
**Dependencies**: Phase 6.3, Phase 6.4, Phase 6.2
**Validation**: /analyze endpoint executes analyses, returns results

**Tasks**:
- [ ] Implement main analysis orchestration in `backend/python-service/app/analyze.py`:
  - `POST /analyze` endpoint
  - Accept payload:
    - `dataset_reference`: URL or inline data
    - `decision`: library, function, param_map
    - `job_id`: for tracking
  - Load dataset from reference (support CSV, JSON)
  - Map parameters using param_mapper
  - Execute appropriate analysis function based on decision
  - Generate plots if applicable
  - Return structured response:
    - `results`: numeric results, statistics
    - `plot_paths`: file paths to generated plots
    - `metadata`: package versions, RNG seed, execution time
    - `status`: success/error
- [ ] Add comprehensive error handling:
  - Dataset loading failures
  - Invalid parameters
  - Analysis execution errors
  - File I/O errors
- [ ] Implement execution timeout (prevent long-running jobs)
- [ ] Add logging for all analysis requests

**Outputs**:
- Complete /analyze endpoint
- Analysis orchestration logic
- Error handling and timeouts
- Execution logging

### 6.6 Environment & Reproducibility
**Dependencies**: Phase 6.5
**Validation**: Analyses are reproducible, environment metadata captured

**Tasks**:
- [ ] Implement environment metadata collection:
  - Capture package versions (scipy, statsmodels, seaborn, pandas, numpy)
  - Set and record RNG seed for reproducibility
  - Record Python version
  - Record execution timestamp and duration
- [ ] Add metadata to analysis response
- [ ] Implement RNG seed parameter (optional input)
- [ ] Create environment info endpoint: `GET /environment`
  - Return all package versions
  - Return system info (Python version, OS)

**Outputs**:
- Environment metadata collection
- RNG seed management
- Reproducibility guarantees
- Environment info endpoint

---

## Phase 7: API Gateway Orchestration

### 7.1 Analysis Execution Endpoint
**Dependencies**: Phase 6.5, Phase 4.3, Phase 3.1
**Validation**: End-to-end analysis flow works

**Tasks**:
- [ ] Implement `backend/api/app/routes/run.py`:
  - `POST /api/run` endpoint
  - Accept AnalysisRequest payload
  - Validate authentication
  - Validate request (decision must be provided or derivable)
  - Create job in Supabase (status="created")
  - Update job status to "running"
  - Forward execution to python-service `/analyze`:
    - Construct payload with decision and dataset reference
    - Make HTTP POST request to PYTHON_SERVICE_URL
    - Handle timeout and errors
  - Receive results from python-service
  - Save results and provenance to Supabase:
    - Job results (statistics, plot references)
    - Provenance (library, function, rule_id, package versions)
  - Update job status to "completed" or "failed"
  - Return job result or job_id
- [ ] Implement synchronous and asynchronous modes:
  - Synchronous: wait for analysis completion, return results
  - Asynchronous: return job_id immediately, poll for status
- [ ] Add progress tracking for long-running jobs

**Outputs**:
- Analysis execution endpoint
- Job lifecycle management
- Python service integration
- Result persistence

### 7.2 Job Status & Retrieval Endpoints
**Dependencies**: Phase 7.1
**Validation**: Job status and results retrievable

**Tasks**:
- [ ] Implement `backend/api/app/routes/run.py`:
  - `GET /api/jobs/{job_id}` endpoint
    - Validate authentication and ownership
    - Retrieve job from Supabase
    - Return job details, status, results
  - `GET /api/jobs` endpoint
    - Validate authentication
    - List user's jobs (paginated)
    - Filter by status, date range
  - `DELETE /api/jobs/{job_id}` endpoint
    - Validate authentication and ownership
    - Delete job and associated files
- [ ] Add pagination for job listing
- [ ] Implement signed URLs for plot files (Supabase Storage)

**Outputs**:
- Job retrieval endpoints
- Job listing with pagination
- Job deletion functionality

### 7.3 Combined Decision + Execution Endpoint
**Dependencies**: Phase 7.1, Phase 4.3
**Validation**: Single endpoint handles decision and execution

**Tasks**:
- [ ] Implement convenience endpoint in `backend/api/app/routes/run.py`:
  - `POST /api/analyze` endpoint
  - Accept AnalysisRequest with prompt and dataset
  - Internally call decision service
  - If decision found, proceed to execution
  - If no decision, return decision failure
  - Return job result or decision error
- [ ] Add flag for "decision_only" mode (skip execution)
- [ ] Optimize for common use case (decision + execution)

**Outputs**:
- Combined analyze endpoint
- Decision + execution orchestration
- Convenience for frontend integration

---

## Phase 8: Docker & Local Development

### 8.1 Docker Compose Configuration
**Dependencies**: Phase 2.1, Phase 6.1
**Validation**: Both services start with docker-compose, communicate correctly

**Tasks**:
- [ ] Implement `backend/docker-compose.yml`:
  - Define `api-gateway` service:
    - Build from `backend/api/Dockerfile`
    - Expose port 8000
    - Mount .env file
    - Depends on `python-service`
    - Network configuration
  - Define `python-service` service:
    - Build from `backend/python-service/Dockerfile`
    - Expose port 8001 (internal only)
    - Mount volume for plot outputs
    - Network configuration
  - Define shared network
  - Define volumes for persistent data (plots, logs)
- [ ] Configure environment variable passing
- [ ] Add health check configuration for both services
- [ ] Configure service restart policies

**Outputs**:
- Complete docker-compose configuration
- Service orchestration
- Network and volume configuration

### 8.2 Development Setup Documentation
**Dependencies**: Phase 8.1
**Validation**: Developer can follow README and start services

**Tasks**:
- [ ] Create comprehensive `backend/README.md`:
  - Prerequisites (Docker, Docker Compose, Supabase account)
  - Environment setup:
    - Copy `.env.example` to `.env`
    - Configure Supabase credentials
    - Configure LLM API key
  - Development workflow:
    - `docker-compose up --build`
    - Access API at http://localhost:8000
    - Access API docs at http://localhost:8000/docs
  - Testing endpoints with curl/httpie examples
  - Troubleshooting common issues
- [ ] Create `backend/ARCHITECTURE.md`:
  - System architecture diagram
  - Component responsibilities
  - Data flow diagrams
  - Decision logic explanation
- [ ] Create development scripts:
  - `scripts/dev-setup.sh`: initial setup
  - `scripts/dev-start.sh`: start services
  - `scripts/dev-stop.sh`: stop services
  - `scripts/dev-logs.sh`: view logs

**Outputs**:
- Complete development documentation
- Architecture documentation
- Development helper scripts

### 8.3 Local Frontend Integration
**Dependencies**: Phase 8.1, Phase 7.3
**Validation**: Lovable frontend connects to new backend

**Tasks**:
- [ ] Analyze Lovable frontend API calls:
  - Document all backend endpoints used
  - Map to new FastAPI endpoints
- [ ] Configure frontend to use new backend:
  - Update API base URL to http://localhost:8000
  - Ensure authentication tokens passed correctly
- [ ] Test critical frontend flows:
  - User authentication
  - Dataset upload/selection
  - Analysis request submission
  - Results display
  - LLM interactions
- [ ] Create frontend integration guide:
  - Environment variable configuration
  - API endpoint mapping
  - Migration checklist

**Outputs**:
- Frontend configuration for new backend
- Integration testing validation
- Frontend migration guide

---

## Phase 9: Testing & Quality Assurance

### 9.1 Unit Tests - Decision Logic
**Dependencies**: Phase 4.2
**Validation**: Decision logic tests pass with high coverage

**Tasks**:
- [ ] Create `backend/api/tests/test_decision.py`:
  - Test rule matching:
    - Single match scenarios
    - Multiple match scenarios
    - No match scenarios
  - Test schema analysis:
    - Numeric column detection
    - Categorical column detection
    - Grouping variable identification
  - Test parameter mapping validation
  - Test confidence scoring
- [ ] Use pytest framework
- [ ] Achieve >90% code coverage for decision module
- [ ] Add fixtures for test datasets and rules

**Outputs**:
- Comprehensive unit tests for decision logic
- High test coverage
- Test fixtures and utilities

### 9.2 Unit Tests - LLM Adapter
**Dependencies**: Phase 5.1
**Validation**: LLM adapter tests pass, mocking works correctly

**Tasks**:
- [ ] Create `backend/api/tests/test_llm_adapter.py`:
  - Test successful API calls (mocked)
  - Test error handling (rate limits, network errors, invalid responses)
  - Test retry logic
  - Test response parsing
  - Test caching behavior
- [ ] Mock XAI/Grok API responses
- [ ] Test timeout and cancellation

**Outputs**:
- LLM adapter unit tests
- API mocking strategy
- Error scenario coverage

### 9.3 Unit Tests - Python Service
**Dependencies**: Phase 6.5
**Validation**: Analysis functions tested with known inputs/outputs

**Tasks**:
- [ ] Create `backend/python-service/tests/test_analyze.py`:
  - Test each statistical function:
    - Known datasets with expected results
    - Edge cases (small samples, missing values)
    - Error conditions (invalid inputs)
  - Test parameter mapping
  - Test plot generation
  - Test metadata collection
- [ ] Use small, reproducible test datasets
- [ ] Validate statistical results against known values
- [ ] Test RNG seed reproducibility

**Outputs**:
- Analysis function unit tests
- Statistical validation tests
- Reproducibility tests

### 9.4 Integration Tests
**Dependencies**: Phase 7.3, Phase 8.1
**Validation**: End-to-end flows work correctly

**Tasks**:
- [ ] Create `backend/tests/integration/test_e2e.py`:
  - Test complete analysis flow:
    - Submit analysis request
    - Verify decision made
    - Verify analysis executed
    - Verify results stored
    - Verify job status updated
  - Test LLM proxy flow:
    - Submit LLM request
    - Verify response returned
    - Verify interaction logged
  - Test authentication flow:
    - Valid token accepted
    - Invalid token rejected
  - Test error scenarios:
    - Invalid dataset reference
    - Unsupported analysis type
    - Analysis execution failure
- [ ] Use Docker Compose test environment
- [ ] Mock Supabase and LLM API for integration tests
- [ ] Create test data fixtures

**Outputs**:
- End-to-end integration tests
- Test environment setup
- Error scenario coverage

### 9.5 API Contract & Documentation Tests
**Dependencies**: Phase 7.3
**Validation**: API documentation accurate, contracts enforced

**Tasks**:
- [ ] Validate OpenAPI schema generation (FastAPI automatic docs)
- [ ] Test API examples in documentation
- [ ] Create contract tests for each endpoint:
  - Request/response schema validation
  - Status code validation
  - Error response format validation
- [ ] Generate API documentation:
  - Export OpenAPI spec: `openapi.json`
  - Generate HTML docs (ReDoc or Swagger UI)
- [ ] Create Postman/Insomnia collection for manual testing

**Outputs**:
- API contract tests
- OpenAPI specification export
- API documentation artifacts
- Manual testing collections

---

## Phase 10: Deployment Preparation & Documentation

### 10.1 Production Configuration
**Dependencies**: Phase 8.1
**Validation**: Production configurations secure and optimized

**Tasks**:
- [ ] Create production Dockerfile variants:
  - Multi-stage builds for smaller images
  - Security hardening (non-root user, minimal dependencies)
  - Build-time optimization
- [ ] Create production docker-compose variant:
  - External Supabase configuration
  - External LLM API configuration
  - Volume mounts for persistent data
  - Secrets management (Docker secrets or env files)
  - Resource limits (CPU, memory)
- [ ] Configure production environment variables:
  - Production Supabase credentials
  - Production LLM API credentials
  - CORS origins (production frontend URL)
  - Log level (WARNING or ERROR)
  - Rate limiting configuration
- [ ] Implement production logging:
  - Structured JSON logging
  - Log aggregation configuration (stdout/stderr)
  - Error tracking (Sentry integration optional)

**Outputs**:
- Production Docker configurations
- Production environment templates
- Logging and monitoring configuration

### 10.2 Security Hardening
**Dependencies**: Phase 10.1
**Validation**: Security scan passes, vulnerabilities addressed

**Tasks**:
- [ ] Implement security best practices:
  - HTTPS enforcement (configure reverse proxy)
  - Secure headers (CORS, CSP, HSTS)
  - Rate limiting per endpoint
  - Request size limits
  - Input validation and sanitization
- [ ] Run security scans:
  - Docker image scanning (Trivy, Snyk)
  - Dependency vulnerability scanning
  - OWASP ZAP API scanning
- [ ] Address identified vulnerabilities
- [ ] Create security documentation:
  - Threat model
  - Security controls
  - Incident response plan

**Outputs**:
- Security hardening implementation
- Vulnerability scan results
- Security documentation

### 10.3 Performance Optimization
**Dependencies**: Phase 9.4
**Validation**: Performance benchmarks meet targets

**Tasks**:
- [ ] Implement performance optimizations:
  - Response caching (decision results, LLM responses)
  - Database query optimization (indexes, connection pooling)
  - Async processing for long-running analyses
  - Background worker for job queue (optional)
- [ ] Conduct performance testing:
  - Load testing (locust or k6)
  - Stress testing
  - Identify bottlenecks
- [ ] Optimize Docker images:
  - Reduce image sizes
  - Optimize layer caching
- [ ] Configure resource limits and auto-scaling

**Outputs**:
- Performance optimization implementation
- Load testing results
- Performance benchmarks

### 10.4 Deployment Guide
**Dependencies**: Phase 10.1, Phase 10.2
**Validation**: Deployment guide is complete and accurate

**Tasks**:
- [ ] Create `backend/DEPLOYMENT.md`:
  - Infrastructure requirements
  - Deployment options (Docker Compose, Kubernetes, cloud platforms)
  - Step-by-step deployment instructions
  - Environment configuration checklist
  - Database migration steps
  - Rollback procedures
- [ ] Create deployment automation scripts:
  - `scripts/deploy.sh`: automated deployment
  - `scripts/migrate-db.sh`: database migrations
  - `scripts/health-check.sh`: post-deployment validation
- [ ] Create monitoring and alerting guide:
  - Key metrics to monitor (latency, error rate, job success rate)
  - Logging configuration
  - Alert thresholds

**Outputs**:
- Complete deployment guide
- Deployment automation scripts
- Monitoring and alerting documentation

### 10.5 User Migration Guide
**Dependencies**: Phase 8.3
**Validation**: Migration guide tested, Lovable frontend migrated successfully

**Tasks**:
- [ ] Create `MIGRATION.md`:
  - Prerequisites and preparation steps
  - Backup procedures for Lovable data
  - Frontend configuration changes required
  - API endpoint mapping (Lovable → FastAPI)
  - Testing checklist for migrated system
  - Rollback procedures
- [ ] Document breaking changes (if any)
- [ ] Create migration validation script:
  - Compare Lovable vs FastAPI responses
  - Validate data integrity
  - Verify all features work
- [ ] Create FAQ for common migration issues

**Outputs**:
- User migration guide
- Migration validation tools
- Troubleshooting documentation

---

## Phase 11: Final Validation & Handoff

### 11.1 System Integration Testing
**Dependencies**: Phase 10.5
**Validation**: Complete system tested end-to-end in production-like environment

**Tasks**:
- [ ] Deploy to staging environment
- [ ] Run complete test suite against staging:
  - All unit tests pass
  - All integration tests pass
  - API contract tests pass
  - Performance benchmarks met
- [ ] Conduct user acceptance testing:
  - Test all critical user flows
  - Validate results accuracy (compare with Lovable)
  - Test error handling and edge cases
- [ ] Conduct security testing:
  - Authentication and authorization
  - Input validation
  - Rate limiting
  - API abuse scenarios
- [ ] Load testing in staging environment

**Outputs**:
- System integration test results
- UAT sign-off
- Security testing report
- Load testing report

### 11.2 Documentation Review & Finalization
**Dependencies**: Phase 11.1
**Validation**: All documentation complete, accurate, and reviewed

**Tasks**:
- [ ] Review and finalize all documentation:
  - `README.md`: Setup and quickstart
  - `ARCHITECTURE.md`: System design and components
  - `DEPLOYMENT.md`: Deployment procedures
  - `MIGRATION.md`: Migration from Lovable
  - `API.md`: API reference (or OpenAPI export)
  - `DEVELOPMENT.md`: Development workflows
- [ ] Create troubleshooting guide:
  - Common errors and solutions
  - Debugging procedures
  - Log analysis guide
- [ ] Create runbook for operations:
  - Routine maintenance tasks
  - Monitoring procedures
  - Incident response
- [ ] Add inline code documentation and docstrings
- [ ] Generate API documentation site

**Outputs**:
- Complete documentation suite
- Troubleshooting guide
- Operations runbook
- Generated API docs

### 11.3 Knowledge Transfer
**Dependencies**: Phase 11.2
**Validation**: Team trained and confident in new system

**Tasks**:
- [ ] Conduct knowledge transfer sessions:
  - System architecture overview
  - Development workflow walkthrough
  - Deployment procedures
  - Troubleshooting common issues
- [ ] Create video tutorials (optional):
  - Setup and local development
  - Making code changes
  - Deploying to production
- [ ] Conduct Q&A sessions with team
- [ ] Create onboarding checklist for new developers

**Outputs**:
- Knowledge transfer sessions completed
- Training materials
- Onboarding documentation

### 11.4 Production Deployment
**Dependencies**: Phase 11.3
**Validation**: System deployed to production, all checks passed

**Tasks**:
- [ ] Final pre-deployment checklist:
  - All tests passing
  - Documentation complete
  - Security scans passed
  - Performance benchmarks met
  - Backup procedures in place
- [ ] Execute production deployment:
  - Follow deployment guide exactly
  - Run database migrations (if needed)
  - Deploy backend services
  - Configure frontend to use production backend
  - Run health checks
  - Validate core functionality
- [ ] Monitor initial production usage:
  - Watch error rates and logs
  - Monitor performance metrics
  - Validate user requests processing correctly
- [ ] Document production environment details:
  - URLs and endpoints
  - Credentials and access (secure storage)
  - Monitoring dashboard links

**Outputs**:
- Production deployment completed
- Health check validation
- Production monitoring active
- Production environment documentation

### 11.5 Post-Deployment Support
**Dependencies**: Phase 11.4
**Validation**: System stable in production, issues addressed quickly

**Tasks**:
- [ ] Establish post-deployment support period (e.g., 2 weeks)
- [ ] Monitor production closely:
  - Daily log reviews
  - Performance metrics monitoring
  - User feedback collection
- [ ] Create incident response plan:
  - Escalation procedures
  - On-call rotation
  - Communication channels
- [ ] Address any production issues:
  - Bug fixes
  - Performance tuning
  - Configuration adjustments
- [ ] Conduct retrospective:
  - What went well
  - What could be improved
  - Lessons learned
- [ ] Plan for future iterations:
  - Additional rules and analyses
  - UI enhancements
  - Performance optimizations

**Outputs**:
- Production support activities
- Incident response plan
- Post-deployment retrospective
- Future roadmap

---

## Dependency Graph

```
Phase 1: Foundation
└─> Phase 2: FastAPI Gateway
    ├─> Phase 3: Supabase Integration
    │   └─> Phase 7: Orchestration
    ├─> Phase 4: Decision Logic
    │   ├─> Phase 5: LLM Integration
    │   └─> Phase 7: Orchestration
    └─> Phase 6: Python Service
        └─> Phase 7: Orchestration

Phase 8: Docker & Local Dev
├─> Phase 9: Testing & QA
└─> Phase 10: Deployment Prep
    └─> Phase 11: Final Validation & Handoff
```

---

## Critical Paths

### Path 1: Core Backend Functionality
1. Phase 1: Foundation → Phase 2: FastAPI Gateway → Phase 3: Supabase → Phase 4: Decision Logic → Phase 7: Orchestration

### Path 2: Analysis Execution
1. Phase 1: Foundation → Phase 6: Python Service → Phase 7: Orchestration

### Path 3: LLM Integration
1. Phase 2: FastAPI Gateway → Phase 5: LLM Integration → Phase 7: Orchestration

---

## Validation Checkpoints

### Checkpoint 1: Foundation Complete (After Phase 2)
- [ ] FastAPI server running
- [ ] Health endpoint responding
- [ ] Configuration loaded correctly
- [ ] Pydantic models defined

### Checkpoint 2: Core Services Complete (After Phase 6)
- [ ] Supabase connection working
- [ ] Decision logic returning correct rules
- [ ] Python service executing analyses
- [ ] All unit tests passing

### Checkpoint 3: Integration Complete (After Phase 7)
- [ ] End-to-end analysis flow working
- [ ] Job lifecycle managed correctly
- [ ] LLM proxy functioning
- [ ] Frontend integrated successfully

### Checkpoint 4: Production Ready (After Phase 10)
- [ ] All tests passing (unit, integration, E2E)
- [ ] Security hardening complete
- [ ] Performance benchmarks met
- [ ] Documentation complete

### Checkpoint 5: Deployed (After Phase 11)
- [ ] Production deployment successful
- [ ] Health checks passing
- [ ] Monitoring active
- [ ] Team trained

---

## Risk Mitigation

### Risk 1: Supabase Schema Incompatibility
- **Mitigation**: Early schema analysis (Phase 3.3)
- **Fallback**: Create schema migration scripts
- **Validation**: Test with production Supabase data early

### Risk 2: Deterministic Rules Insufficient
- **Mitigation**: LLM fallback implemented (Phase 5.3)
- **Fallback**: Expand rule set iteratively
- **Validation**: Log decision failures for analysis

### Risk 3: Performance Degradation
- **Mitigation**: Early performance testing (Phase 9.4)
- **Fallback**: Implement async job queue
- **Validation**: Load testing before production

### Risk 4: Frontend Integration Issues
- **Mitigation**: Early API mapping analysis (Phase 8.3)
- **Fallback**: Create API compatibility layer
- **Validation**: Test with actual Lovable frontend early

### Risk 5: LLM API Reliability
- **Mitigation**: Retry logic and error handling (Phase 5.1)
- **Fallback**: Cache common responses, degrade gracefully
- **Validation**: Stress test LLM adapter

---

## Success Metrics

### Technical Metrics
- [ ] API response time <500ms for decision endpoints
- [ ] API response time <2s for analysis execution (excluding analysis time)
- [ ] Test coverage >85% for all services
- [ ] Zero critical security vulnerabilities
- [ ] 99.5% uptime in production

### Functional Metrics
- [ ] All Lovable features working with new backend
- [ ] Deterministic rules handle 80%+ of common analyses
- [ ] LLM fallback provides reasonable suggestions
- [ ] Analysis results match Lovable results (where comparable)

### Operational Metrics
- [ ] Deployment time <30 minutes
- [ ] Rollback time <10 minutes
- [ ] Mean time to resolution (MTTR) <2 hours for critical issues
- [ ] Developer onboarding time <1 day

---

## Implementation Notes

### Development Strategy
- **Iterative**: Build incrementally, validate at each phase
- **Test-driven**: Write tests alongside implementation
- **Documentation-first**: Document as you build, not after
- **Isolate concerns**: Keep services decoupled and focused

### Code Quality Standards
- Follow PEP 8 for Python code
- Use type hints throughout
- Write docstrings for all public functions
- Implement comprehensive error handling
- Log at appropriate levels (DEBUG, INFO, WARNING, ERROR)

### Git Workflow
- Use feature branches for each phase
- Merge to main after phase validation
- Tag releases at major checkpoints
- Write meaningful commit messages

### Communication
- Daily standups for progress updates
- Async updates in team chat for blockers
- Phase completion reviews with stakeholders
- Weekly demos of working features

---

## Next Steps

After this workflow is approved:

1. **Use `/sc:implement` to execute phases sequentially**
2. Begin with Phase 1 (Foundation) to establish structure
3. Proceed through phases in order, validating at checkpoints
4. Adjust workflow as needed based on discoveries during implementation
5. Maintain documentation throughout implementation

---

## Appendix: Technology Stack

### Backend API Gateway
- **Framework**: FastAPI 0.104+
- **Server**: Uvicorn with async support
- **Validation**: Pydantic v2
- **HTTP Client**: httpx for internal requests
- **Auth**: python-jose for JWT validation

### Python Analysis Service
- **Framework**: FastAPI 0.104+
- **Statistical**: SciPy 1.11+, statsmodels 0.14+
- **Visualization**: Seaborn 0.13+, Matplotlib 3.8+
- **Data**: Pandas 2.1+, NumPy 1.24+

### Database & Storage
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for plots/files
- **Client**: supabase-py

### LLM Integration
- **Provider**: XAI (Grok)
- **Client**: Custom adapter using httpx

### DevOps
- **Containerization**: Docker 24+, Docker Compose
- **Testing**: pytest, pytest-cov, pytest-asyncio
- **Linting**: ruff, mypy
- **Formatting**: black, isort

---

## Document Control

**Version**: 1.0
**Last Updated**: 2026-02-06
**Owner**: Development Team
**Status**: Ready for Implementation

---

*This workflow is a living document. Update as implementation progresses and requirements evolve.*
