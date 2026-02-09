# XAI SDK Integration Plan

**Date**: 2026-02-06
**Status**: Planning Phase - DO NOT IMPLEMENT YET

## Overview

This document outlines the plan to replace the current HTTP-based LLM integration with the official XAI Python SDK, which provides a gRPC-based interface with enhanced features including file uploads, streaming, reasoning models, and structured outputs.

## Current State Analysis

### Current Implementation (`backend/api/app/services/llm_adapter.py`)

**Technology**:
- Direct HTTP calls using `httpx` to REST API endpoint
- Manual request/response handling
- Basic retry logic with exponential backoff
- Simple in-memory caching

**Limitations**:
1. No native file upload support for including datasets in prompts
2. Manual parsing of responses
3. No access to reasoning models (grok-3-mini)
4. No streaming support
5. No structured output support (Pydantic models)
6. Basic error handling without gRPC status codes
7. No telemetry/observability built-in

### XAI SDK Capabilities (from `/xai/` resources)

**Technology**:
- gRPC-based Python SDK
- Both sync (`xai_sdk.Client`) and async (`xai_sdk.AsyncClient`) support
- Python 3.10+ required

**Key Features**:
1. **File Upload API** - Upload datasets and attach to prompts
2. **Streaming** - Real-time response streaming
3. **Reasoning Models** - grok-3-mini with reasoning_content and reasoning_effort
4. **Structured Outputs** - Return Pydantic models directly
5. **Function Calling** - Native tool/function calling support
6. **Image Understanding** - grok-2-vision model support
7. **Chat Management** - Built-in conversation history with `append()` method
8. **Telemetry** - OpenTelemetry integration for observability
9. **Auto Retries** - Built-in retry logic for UNAVAILABLE errors
10. **Timeout Management** - Configurable timeouts per client

## Integration Strategy

### Phase 1: Dependencies & Configuration

**Changes Required**:

1. **Update `backend/api/requirements.txt`**:
   ```
   # Replace httpx dependency with xai-sdk
   - httpx==0.24.1
   + xai-sdk>=1.6.1
   + xai-sdk[telemetry-http]  # For observability (optional)
   ```

2. **Update `backend/api/app/config/settings.py`**:
   ```python
   # Change from generic LLM settings to XAI-specific
   - llm_api_key: str
   - llm_endpoint: str  # Remove - not needed with SDK
   - llm_model: str

   + xai_api_key: str  # Renamed for clarity
   + xai_model: str = "grok-3"  # Default model
   + xai_reasoning_model: str = "grok-3-mini"  # For analysis decisions
   + xai_enable_telemetry: bool = False  # Optional observability
   ```

3. **Update `backend/.env.example`**:
   ```
   # XAI Configuration
   XAI_API_KEY=your-xai-api-key-here
   XAI_MODEL=grok-3
   XAI_REASONING_MODEL=grok-3-mini
   XAI_ENABLE_TELEMETRY=false
   ```

### Phase 2: LLM Adapter Refactoring

**File**: `backend/api/app/services/llm_adapter.py`

**Major Changes**:

1. **Replace HTTP Client with XAI SDK**:
   ```python
   from xai_sdk import AsyncClient
   from xai_sdk.chat import user, system, file

   class LLMAdapter:
       def __init__(self):
           self.client = AsyncClient(
               api_key=settings.xai_api_key,
               timeout=300  # 5 minutes
           )
           self.model = settings.xai_model
           self.reasoning_model = settings.xai_reasoning_model
   ```

2. **Add File Upload Support for Datasets**:
   ```python
   async def upload_dataset(self, file_path: str) -> str:
       """Upload dataset file and return file ID."""
       uploaded_file = self.client.files.upload(file_path)
       return uploaded_file.id

   async def call_llm_with_dataset(
       self,
       prompt: str,
       dataset_path: Optional[str] = None,
       ...
   ):
       """Call LLM with optional dataset attachment."""
       chat = self.client.chat.create(model=self.model)

       if dataset_path:
           file_id = await self.upload_dataset(dataset_path)
           chat.append(user(prompt, file(file_id)))
       else:
           chat.append(user(prompt))

       response = await chat.sample()

       # Cleanup file after use
       if dataset_path:
           self.client.files.delete(file_id)

       return response
   ```

3. **Add Streaming Support**:
   ```python
   async def stream_llm_response(self, prompt: str):
       """Stream LLM response for real-time updates."""
       chat = self.client.chat.create(model=self.model)
       chat.append(user(prompt))

       async for response, chunk in chat.stream():
           yield {
               "content": chunk.content,
               "done": False
           }

       yield {
           "content": "",
           "done": True,
           "usage": response.usage
       }
   ```

4. **Add Reasoning Model Support for Decision Fallback**:
   ```python
   async def get_fallback_decision_with_reasoning(
       self,
       prompt: str,
       dataset_schema: Dict[str, Any]
   ):
       """Use reasoning model for better analysis decisions."""
       chat = self.client.chat.create(
           model=self.reasoning_model,
           reasoning_effort="high"  # Use high effort for accuracy
       )

       decision_prompt = f"""..."""  # Structured prompt
       chat.append(user(decision_prompt))

       response = await chat.sample()

       return {
           "reasoning": response.reasoning_content,  # Show the thinking
           "decision": response.content,  # Final answer
           "reasoning_tokens": response.usage.reasoning_tokens
       }
   ```

5. **Update Error Handling for gRPC**:
   ```python
   import grpc

   try:
       response = await chat.sample()
   except grpc.aio.AioRpcError as e:
       if e.code() == grpc.StatusCode.UNAUTHENTICATED:
           logger.error("Invalid API key")
       elif e.code() == grpc.StatusCode.RESOURCE_EXHAUSTED:
           logger.error("Rate limit exceeded")
       elif e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
           logger.error("Request timeout")
       raise
   ```

### Phase 3: Schema Updates

**File**: `backend/api/app/models/schemas.py`

**New Models**:

1. **Add Reasoning Response**:
   ```python
   class LLMReasoningResponse(BaseModel):
       """Response from reasoning model."""
       reasoning_content: str = Field(..., description="Model's reasoning process")
       response: str = Field(..., description="Final answer")
       reasoning_tokens: int = Field(..., description="Tokens used for reasoning")
       completion_tokens: int = Field(..., description="Tokens used for completion")
       total_tokens: int = Field(..., description="Total tokens used")
   ```

2. **Add File Upload Info**:
   ```python
   class FileUploadInfo(BaseModel):
       """Information about uploaded file."""
       file_id: str = Field(..., description="XAI file ID")
       file_path: str = Field(..., description="Original file path")
       uploaded_at: datetime = Field(..., description="Upload timestamp")
   ```

3. **Update LLMProxyRequest**:
   ```python
   class LLMProxyRequest(BaseModel):
       prompt: str
       dataset_reference: Optional[str] = None  # NEW: Path to dataset to include
       use_reasoning: bool = False  # NEW: Use reasoning model
       reasoning_effort: Optional[str] = "low"  # NEW: "low" or "high"
       stream: bool = False  # NEW: Enable streaming
       ...
   ```

### Phase 4: API Endpoint Updates

**File**: `backend/api/app/routes/llm_proxy.py`

**Changes**:

1. **Add Streaming Endpoint**:
   ```python
   from fastapi import Response
   from fastapi.responses import StreamingResponse

   @router.post("/llm-proxy/stream")
   async def llm_proxy_stream(request: LLMProxyRequest):
       """Stream LLM responses in real-time."""
       async def generate():
           async for chunk in llm_adapter.stream_llm_response(request.prompt):
               yield json.dumps(chunk) + "\n"

       return StreamingResponse(generate(), media_type="application/x-ndjson")
   ```

2. **Update Main Proxy to Support Datasets**:
   ```python
   @router.post("/llm-proxy")
   async def llm_proxy(request: LLMProxyRequest):
       if request.use_reasoning:
           response = await llm_adapter.get_fallback_decision_with_reasoning(
               prompt=request.prompt,
               dataset_schema=request.metadata.get("dataset_schema")
           )
           return LLMReasoningResponse(**response)

       if request.dataset_reference:
           response = await llm_adapter.call_llm_with_dataset(
               prompt=request.prompt,
               dataset_path=request.dataset_reference,
               ...
           )
       else:
           response = await llm_adapter.call_llm(...)

       return response
   ```

### Phase 5: Decision Service Enhancement

**File**: `backend/api/app/services/decision.py`

**Enhancement**: Use reasoning model for better fallback decisions

```python
async def get_decision_with_llm_fallback(
    self,
    prompt: str,
    dataset_schema: DatasetSchema
) -> DecisionResult:
    """Get decision with reasoning-enhanced LLM fallback."""

    # Try deterministic rules first
    decision = self.get_decision(prompt, dataset_schema)

    if decision.source == DecisionSource.NONE:
        # Use reasoning model for fallback
        from app.services.llm_adapter import llm_adapter

        reasoning_response = await llm_adapter.get_fallback_decision_with_reasoning(
            prompt=prompt,
            dataset_schema=dataset_schema.model_dump()
        )

        # Parse the reasoning and create decision
        # The reasoning_content shows WHY the model chose this analysis
        return DecisionResult(
            source=DecisionSource.LLM,
            explanation=reasoning_response["reasoning"],
            ...
        )

    return decision
```

### Phase 6: Analysis Execution with Dataset Context

**File**: `backend/api/app/routes/run.py`

**Enhancement**: Include dataset in LLM prompts for better context

```python
@router.post("/analyze")
async def analyze(request: AnalysisRequest):
    """Execute analysis with dataset-aware LLM support."""

    # If decision unclear, use LLM with dataset
    if not clear_decision:
        # Upload dataset temporarily
        llm_response = await llm_adapter.call_llm_with_dataset(
            prompt=f"Analyze this dataset and suggest analysis: {request.prompt}",
            dataset_path=request.dataset_reference
        )

        # LLM can now see the actual data to make better decisions

    # Continue with normal execution...
```

### Phase 7: Telemetry & Observability (Optional)

**File**: `backend/api/app/services/llm_adapter.py`

**Add Telemetry**:

```python
from xai_sdk.telemetry import Telemetry

def __init__(self):
    if settings.xai_enable_telemetry:
        telemetry = Telemetry()
        telemetry.setup_otlp_exporter(
            endpoint=settings.telemetry_endpoint,
            headers={"Authorization": f"Bearer {settings.telemetry_token}"}
        )

    self.client = AsyncClient(...)
```

## Benefits of Migration

### 1. Dataset-Aware Analysis Decisions
- **Current**: LLM only sees schema metadata (column names, types)
- **With SDK**: LLM can see actual data samples via file upload
- **Impact**: Better decision accuracy, especially for edge cases

### 2. Reasoning Transparency
- **Current**: Black box decision from LLM
- **With SDK**: See the model's reasoning process (`reasoning_content`)
- **Impact**: Debugging, explainability, trust

### 3. Streaming for Better UX
- **Current**: Wait for complete response
- **With SDK**: Real-time streaming of results
- **Impact**: Better user experience for long responses

### 4. Better Error Handling
- **Current**: HTTP status codes
- **With SDK**: Specific gRPC error codes (UNAUTHENTICATED, RESOURCE_EXHAUSTED, etc.)
- **Impact**: More precise error handling and user feedback

### 5. Built-in Retry Logic
- **Current**: Manual retry with basic exponential backoff
- **With SDK**: Automatic retry with configurable policy
- **Impact**: More resilient to transient failures

### 6. Observability
- **Current**: Basic logging
- **With SDK**: OpenTelemetry traces with rich metadata
- **Impact**: Production monitoring, debugging, performance analysis

## Use Cases Enhanced by SDK

### Use Case 1: Ambiguous Analysis Request

**Scenario**: User asks "analyze this data" without specifying test type

**Current Flow**:
1. Deterministic rules fail (too vague)
2. LLM sees only schema: "2 numeric columns"
3. LLM guesses "correlation" (could be wrong)

**With SDK Flow**:
1. Deterministic rules fail
2. Upload dataset to XAI
3. LLM sees actual data: [1,2,3] vs [10,20,30]
4. LLM reasoning: "These look like paired measurements (before/after)"
5. LLM suggests: paired t-test (more accurate)

### Use Case 2: Data Quality Issues

**Scenario**: Dataset has missing values or outliers

**Current Flow**:
- No visibility into data quality
- Analysis might fail silently

**With SDK Flow**:
- LLM sees actual data
- Can warn: "Your data has 30% missing values, consider imputation"
- Can suggest data cleaning steps

### Use Case 3: Reasoning for Complex Scenarios

**Scenario**: ANOVA vs multiple t-tests decision

**Current Flow**:
- Rule matches "compare multiple groups" → ANOVA
- No explanation

**With SDK Flow**:
- Reasoning model explains:
  - "You have 3 groups to compare"
  - "ANOVA is more appropriate than multiple t-tests"
  - "Reason: Controls for Type I error inflation"
- Builds user trust and education

## Migration Risks & Mitigation

### Risk 1: Dependency Changes
**Risk**: xai-sdk might conflict with existing packages
**Mitigation**:
- Test in isolated environment first
- Use virtual environment for testing
- Check compatibility with current Python 3.12

### Risk 2: gRPC vs HTTP Performance
**Risk**: gRPC might have different latency characteristics
**Mitigation**:
- Benchmark both implementations
- Use SDK's built-in telemetry to measure
- Adjust timeouts if needed

### Risk 3: File Upload Costs
**Risk**: Uploading datasets on every request could be slow/costly
**Mitigation**:
- Cache uploaded file IDs
- Only upload when decision is ambiguous
- Set size limits (e.g., max 1MB dataset upload)
- Clean up files after use

### Risk 4: Breaking Changes
**Risk**: Existing LLM proxy clients might break
**Mitigation**:
- Keep backward compatibility in `/api/llm-proxy`
- Add new endpoints for SDK-specific features
- Version the API (e.g., `/api/v2/llm-proxy`)

### Risk 5: Reasoning Token Costs
**Risk**: Reasoning models use more tokens
**Mitigation**:
- Only use reasoning for fallback decisions (not primary)
- Use "low" effort by default, "high" only when needed
- Track costs separately for reasoning vs regular calls

## Implementation Checklist

### Prerequisites
- [ ] Review XAI SDK documentation thoroughly
- [ ] Test SDK in isolated environment
- [ ] Verify API key permissions for file uploads

### Phase 1: Setup
- [ ] Install xai-sdk package
- [ ] Update configuration files
- [ ] Test basic connection with AsyncClient
- [ ] Verify file upload/delete works

### Phase 2: Core Adapter
- [ ] Refactor LLMAdapter class
- [ ] Implement file upload functionality
- [ ] Add streaming support
- [ ] Update error handling for gRPC
- [ ] Add tests for new adapter

### Phase 3: Reasoning Integration
- [ ] Implement reasoning model calls
- [ ] Add reasoning to fallback decision
- [ ] Update schemas for reasoning response
- [ ] Add tests for reasoning flow

### Phase 4: API Updates
- [ ] Add streaming endpoint
- [ ] Update llm-proxy for dataset support
- [ ] Add reasoning endpoint
- [ ] Update API documentation

### Phase 5: Testing
- [ ] Unit tests for new adapter
- [ ] Integration tests with real API
- [ ] Performance benchmarks
- [ ] Cost analysis (token usage)
- [ ] End-to-end testing with frontend

### Phase 6: Documentation
- [ ] Update README with SDK info
- [ ] Document new endpoints
- [ ] Add examples for dataset upload
- [ ] Document reasoning model usage
- [ ] Update migration guide

### Phase 7: Deployment
- [ ] Deploy to staging
- [ ] Monitor performance and costs
- [ ] Gradual rollout to production
- [ ] Enable telemetry for monitoring

## Questions for User

Before implementing, please clarify:

1. **Privacy Concerns**:
   - Are you comfortable uploading user datasets to XAI API?
   - Should we anonymize/sample data before upload?
   - Size limits for dataset uploads?

2. **Reasoning Model Usage**:
   - Should reasoning be opt-in or automatic fallback?
   - Display reasoning content to users or keep internal?
   - Cost tolerance for reasoning tokens?

3. **Streaming Priority**:
   - Is real-time streaming important for your use case?
   - Should streaming be default or opt-in?

4. **Model Selection**:
   - Stick with grok-3 or try grok-4-fast?
   - When to use grok-3-mini (reasoning)?
   - Need vision model (grok-2-vision) for any features?

5. **Backward Compatibility**:
   - Keep old HTTP endpoint for existing clients?
   - Acceptable to break existing integrations?
   - Need gradual migration period?

6. **Additional SDK Features**:
   - Interest in structured outputs (Pydantic models)?
   - Function calling for dynamic analysis tools?
   - Image generation capabilities?

## Recommended Approach

**My Recommendation**: Incremental migration

1. **Phase 1**: Replace core LLM adapter with SDK (no new features)
   - Test that existing functionality still works
   - Measure performance differences

2. **Phase 2**: Add file upload for ambiguous cases only
   - Only upload dataset when deterministic rules fail
   - Start with small datasets (< 100KB)
   - Monitor costs and latency

3. **Phase 3**: Add reasoning model for fallback
   - Use "low" effort by default
   - Display reasoning content to help users understand

4. **Phase 4**: Add streaming if needed
   - Based on user feedback
   - For long-running prompts only

This approach minimizes risk while enabling the most valuable features (dataset-aware decisions and reasoning transparency).

## Resources Needed

To complete implementation, would be helpful to have:

1. **More XAI SDK Examples**:
   - Async client examples
   - File upload with large files
   - Error handling patterns
   - Telemetry setup examples

2. **API Limits Documentation**:
   - Max file size for uploads
   - Rate limits for file API
   - Reasoning token pricing
   - Best practices for file cleanup

3. **Testing Support**:
   - Sample datasets for testing
   - Expected analysis decisions
   - Performance benchmarks

## Next Steps

1. **User Decision**: Review this plan and provide feedback
2. **Clarify Questions**: Answer the questions above
3. **Prototype**: Create small proof-of-concept with SDK
4. **Implement**: Follow phased approach if approved
5. **Test**: Comprehensive testing before production

---

**Status**: Awaiting user approval and clarification before implementation.
