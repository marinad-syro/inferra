"""Pydantic models for request/response schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# Enums
# ============================================================================

class JobStatus(str, Enum):
    """Job execution status."""
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DecisionSource(str, Enum):
    """Source of the analysis decision."""
    DETERMINISTIC = "deterministic"
    LLM = "llm"
    NONE = "none"


class ColumnType(str, Enum):
    """Data column types."""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    TEXT = "text"
    UNKNOWN = "unknown"


# ============================================================================
# Dataset Schemas
# ============================================================================

class ColumnInfo(BaseModel):
    """Information about a dataset column."""
    name: str = Field(..., description="Column name")
    type: ColumnType = Field(..., description="Detected column type")
    unique_count: Optional[int] = Field(None, description="Number of unique values")
    null_count: Optional[int] = Field(None, description="Number of null values")
    sample_values: Optional[List[Any]] = Field(None, description="Sample values from column")

    model_config = ConfigDict(use_enum_values=True)


class DatasetSchema(BaseModel):
    """Dataset schema information."""
    columns: List[ColumnInfo] = Field(..., description="List of columns with metadata")
    row_count: Optional[int] = Field(None, description="Total number of rows")
    numeric_columns: List[str] = Field(default_factory=list, description="Names of numeric columns")
    categorical_columns: List[str] = Field(default_factory=list, description="Names of categorical columns")


# ============================================================================
# Decision Logic
# ============================================================================

class ParameterMapping(BaseModel):
    """Mapping hint for analysis parameters."""
    type: str = Field(..., description="Parameter type (e.g., 'group', 'value', 'x', 'y')")
    column: Optional[str] = Field(None, description="Specific column name if known")


class DecisionResult(BaseModel):
    """Result from the decision logic."""
    rule_id: Optional[str] = Field(None, description="ID of the matched rule")
    library: Optional[str] = Field(None, description="Target Python library (e.g., 'scipy.stats')")
    function: Optional[str] = Field(None, description="Target function name")
    param_map: Optional[Dict[str, ParameterMapping]] = Field(None, description="Parameter mapping hints")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    source: DecisionSource = Field(..., description="Decision source")
    explanation: Optional[str] = Field(None, description="Human-readable explanation")

    model_config = ConfigDict(use_enum_values=True)


# ============================================================================
# Analysis Requests
# ============================================================================

class ExecutionSpec(BaseModel):
    """Direct execution specification bypassing decision service."""
    library: str = Field(..., description="Python library (e.g., 'scipy.stats')")
    function: str = Field(..., description="Function name (e.g., 'chi2_contingency')")
    param_map: Dict[str, str] = Field(..., description="Maps parameter roles to exact column names")


class AnalysisRequest(BaseModel):
    """Request to analyze a dataset."""
    user_id: Optional[str] = Field(None, description="User ID (from JWT if not provided)")
    dataset_reference: str = Field(..., description="Dataset reference (URL or identifier)")
    prompt: Optional[str] = Field(None, description="Natural language analysis request")
    execution_spec: Optional[ExecutionSpec] = Field(None, description="Direct execution spec (skips decision service)")
    dataset_schema: Optional[DatasetSchema] = Field(None, description="Dataset schema (optional)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dataset_reference": "s3://bucket/data.csv",
                "execution_spec": {
                    "library": "scipy.stats",
                    "function": "chi2_contingency",
                    "param_map": {"row_col": "Diagnosis", "col_col": "Gender"}
                }
            }
        }
    )


class DecisionRequest(BaseModel):
    """Request for analysis decision only (no execution)."""
    prompt: str = Field(..., description="Natural language analysis request")
    dataset_schema: DatasetSchema = Field(..., description="Dataset schema")
    dataset_path: Optional[str] = Field(None, description="Optional path to dataset file for LLM fallback")
    use_reasoning: bool = Field(False, description="Use reasoning model for LLM fallback")


# ============================================================================
# Analysis Results
# ============================================================================

class AnalysisMetadata(BaseModel):
    """Metadata about analysis execution."""
    package_versions: Dict[str, str] = Field(default_factory=dict, description="Package versions used")
    rng_seed: Optional[int] = Field(None, description="Random number generator seed")
    execution_time_seconds: Optional[float] = Field(None, description="Execution time in seconds")
    python_version: Optional[str] = Field(None, description="Python version")
    timestamp: Optional[datetime] = Field(None, description="Execution timestamp")


class AnalysisResults(BaseModel):
    """Structured analysis results."""
    statistics: Dict[str, Any] = Field(default_factory=dict, description="Numeric results and statistics")
    plot_paths: List[str] = Field(default_factory=list, description="Paths to generated plots")
    summary: Optional[str] = Field(None, description="Text summary of results")
    warnings: List[str] = Field(default_factory=list, description="Analysis warnings")


class JobProvenance(BaseModel):
    """Provenance information for a job."""
    decision: Optional[DecisionResult] = Field(None, description="Decision that led to this job")
    metadata: Optional[AnalysisMetadata] = Field(None, description="Execution metadata")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Job creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")


class AnalysisJob(BaseModel):
    """Complete analysis job information."""
    job_id: str = Field(..., description="Unique job identifier")
    user_id: str = Field(..., description="User who created the job")
    status: JobStatus = Field(..., description="Current job status")
    request: AnalysisRequest = Field(..., description="Original analysis request")
    results: Optional[AnalysisResults] = Field(None, description="Analysis results (if completed)")
    provenance: JobProvenance = Field(..., description="Job provenance and metadata")
    error: Optional[str] = Field(None, description="Error message (if failed)")

    model_config = ConfigDict(use_enum_values=True)


# ============================================================================
# LLM Proxy
# ============================================================================

class FileUploadInfo(BaseModel):
    """Information about an uploaded file to XAI."""
    file_id: str = Field(..., description="XAI file ID")
    file_path: str = Field(..., description="Original file path")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, description="Upload timestamp")
    size_bytes: Optional[int] = Field(None, description="File size in bytes")


class LLMProxyRequest(BaseModel):
    """Request to the LLM proxy."""
    prompt: str = Field(..., description="Prompt to send to LLM")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Request metadata")
    max_tokens: Optional[int] = Field(1000, description="Maximum tokens in response")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="LLM temperature")
    dataset_reference: Optional[str] = Field(None, description="Path to dataset file to attach to LLM prompt")
    use_reasoning: bool = Field(False, description="Use reasoning model (grok-3-mini) instead of default")
    reasoning_effort: Optional[str] = Field("low", description="Reasoning effort level: 'low' or 'high'")
    model: Optional[str] = Field(None, description="Override model to use (grok-3, grok-3-mini, grok-4-fast)")


class LLMUsage(BaseModel):
    """LLM usage statistics."""
    prompt_tokens: int = Field(..., description="Number of tokens in prompt")
    completion_tokens: int = Field(..., description="Number of tokens in completion")
    total_tokens: int = Field(..., description="Total tokens used")
    reasoning_tokens: Optional[int] = Field(None, description="Reasoning tokens (for reasoning models)")


class LLMProxyResponse(BaseModel):
    """Response from the LLM proxy."""
    response: str = Field(..., description="LLM response text")
    usage: Optional[LLMUsage] = Field(None, description="Token usage statistics")
    latency_ms: float = Field(..., description="Request latency in milliseconds")
    model: str = Field(..., description="Model used for generation")


class LLMReasoningResponse(BaseModel):
    """Response from the reasoning model (includes thinking process)."""
    reasoning_content: str = Field(..., description="Model's reasoning/thinking process")
    response: str = Field(..., description="Final answer after reasoning")
    reasoning_tokens: int = Field(..., description="Tokens used for reasoning")
    completion_tokens: int = Field(..., description="Tokens used for final answer")
    total_tokens: int = Field(..., description="Total tokens used")
    latency_ms: float = Field(..., description="Request latency in milliseconds")
    model: str = Field(..., description="Model used for generation")


# ============================================================================
# Error Responses
# ============================================================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error_code": "INVALID_DATASET",
                "message": "The specified dataset could not be found or accessed",
                "details": {"dataset_reference": "s3://bucket/missing.csv"}
            }
        }
    )


# ============================================================================
# Health Check
# ============================================================================

class HealthStatus(BaseModel):
    """Health check status."""
    status: str = Field(..., description="Overall status")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")
    dependencies: Dict[str, str] = Field(
        default_factory=dict,
        description="Status of dependencies (supabase, python-service, llm)"
    )


# ============================================================================
# Workflow Sessions
# ============================================================================

class SessionCreate(BaseModel):
    """Request to create a new workflow session."""
    current_step: int = Field(default=1, description="Initial workflow step")


class SessionResponse(BaseModel):
    """Workflow session data."""
    id: str = Field(..., description="Session UUID")
    current_step: int = Field(..., description="Current workflow step")
    research_question: Optional[str] = Field(None, description="Research question")
    distribution_type: Optional[str] = Field(None, description="Data distribution type")
    has_outliers: Optional[bool] = Field(None, description="Whether dataset has outliers")
    outlier_notes: Optional[str] = Field(None, description="Notes about outliers")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")


class SessionStepUpdate(BaseModel):
    """Update session step."""
    step: int = Field(..., ge=1, description="New workflow step number")


class SessionMetadataUpdate(BaseModel):
    """Update session metadata."""
    research_question: Optional[str] = Field(None, description="Research question")
    distribution_type: Optional[str] = Field(None, description="Data distribution type")
    has_outliers: Optional[bool] = Field(None, description="Whether dataset has outliers")
    outlier_notes: Optional[str] = Field(None, description="Notes about outliers")


# ============================================================================
# Analysis Selections
# ============================================================================

class AnalysisSelectionCreate(BaseModel):
    """Single analysis selection to create."""
    analysis_type: str = Field(..., description="Analysis type identifier")
    title: Optional[str] = Field(None, description="Analysis title")
    description: Optional[str] = Field(None, description="Analysis description")
    complexity: Optional[str] = Field(None, description="Complexity level")
    reasoning: Optional[str] = Field(None, description="AI reasoning for suggestion")
    is_selected: bool = Field(default=False, description="Whether user selected this analysis")
    selected_columns: Optional[List[str]] = Field(None, description="Columns selected for this analysis")
    execution_spec: Optional[Dict[str, Any]] = Field(None, description="Direct execution specification")


class AnalysisSelectionBatchCreate(BaseModel):
    """Batch create analysis selections."""
    selections: List[AnalysisSelectionCreate] = Field(..., description="List of selections to create")


class AnalysisSelectionResponse(BaseModel):
    """Analysis selection data."""
    id: str = Field(..., description="Selection UUID")
    session_id: str = Field(..., description="Session UUID")
    analysis_type: str = Field(..., description="Analysis type identifier")
    title: Optional[str] = Field(None, description="Analysis title")
    description: Optional[str] = Field(None, description="Analysis description")
    complexity: Optional[str] = Field(None, description="Complexity level")
    reasoning: Optional[str] = Field(None, description="AI reasoning")
    is_selected: Optional[bool] = Field(None, description="Selection status")
    selected_columns: Optional[List[str]] = Field(None, description="Selected columns")
    execution_spec: Optional[Dict[str, Any]] = Field(None, description="Direct execution specification")
    created_at: str = Field(..., description="Creation timestamp")


class UpdateColumnsRequest(BaseModel):
    """Update selected columns for an analysis."""
    columns: List[str] = Field(..., description="List of column names")


# ============================================================================
# Derived Variables
# ============================================================================

class DerivedVariableCreate(BaseModel):
    """Create a new derived variable."""
    name: str = Field(..., description="Variable name")
    formula: str = Field(..., description="Formula or transformation logic")
    formula_type: str = Field(default="eval", description="Formula type: 'eval', 'transform', or 'python'")
    description: Optional[str] = Field(None, description="Variable description")
    is_enabled: bool = Field(default=True, description="Whether variable is enabled")


class DerivedVariableResponse(BaseModel):
    """Derived variable data."""
    id: str = Field(..., description="Variable UUID")
    session_id: str = Field(..., description="Session UUID")
    name: str = Field(..., description="Variable name")
    formula: str = Field(..., description="Formula")
    formula_type: Optional[str] = Field(default="eval", description="Formula type: 'eval', 'transform', or 'python'")
    description: Optional[str] = Field(None, description="Description")
    is_enabled: Optional[bool] = Field(None, description="Enabled status")
    created_at: str = Field(..., description="Creation timestamp")


class ToggleVariableRequest(BaseModel):
    """Toggle variable enabled status."""
    is_enabled: bool = Field(..., description="New enabled status")


# ============================================================================
# Trial Structures
# ============================================================================

class TrialStructureResponse(BaseModel):
    """Trial structure data."""
    id: str = Field(..., description="Trial structure UUID")
    session_id: str = Field(..., description="Session UUID")
    trial_onset_event: Optional[str] = Field(None, description="Trial onset event name")
    response_event: Optional[str] = Field(None, description="Response event name")
    outcome_event: Optional[str] = Field(None, description="Outcome event name")
    trials_detected: Optional[int] = Field(None, description="Number of trials detected")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")


class TrialStructureUpdate(BaseModel):
    """Update trial structure."""
    trial_onset_event: Optional[str] = Field(None, description="Trial onset event name")
    response_event: Optional[str] = Field(None, description="Response event name")
    outcome_event: Optional[str] = Field(None, description="Outcome event name")
    trials_detected: Optional[int] = Field(None, description="Number of trials detected")


class CountTrialsRequest(BaseModel):
    """Request to count trials in data."""
    onset_event: str = Field(..., description="Event type to count as trial onsets")
    data: List[Dict[str, Any]] = Field(..., description="Dataset rows to analyze")


# ============================================================================
# Data Wrangling Configs
# ============================================================================

class DatasetInfo(BaseModel):
    """Information about a dataset in wrangling."""
    id: str = Field(..., description="Dataset identifier")
    name: str = Field(..., description="Dataset name")
    rowCount: int = Field(..., description="Number of rows")
    columns: List[str] = Field(..., description="Column names")
    keyColumn: Optional[str] = Field(None, description="Key column for joining")


class JoinWarning(BaseModel):
    """Warning from dataset joining."""
    type: str = Field(..., description="Warning type: missing, duplicate, mismatch")
    message: str = Field(..., description="Warning message")
    affectedRows: int = Field(..., description="Number of affected rows")


class MissingDataStrategy(BaseModel):
    """Strategy for handling missing data per column."""
    # Dynamic fields for each column
    class Config:
        extra = "allow"


class Transformation(BaseModel):
    """Data transformation configuration."""
    id: str = Field(..., description="Transformation identifier")
    type: str = Field(..., description="Transformation type")
    column: str = Field(..., description="Column to transform")
    config: Dict[str, Any] = Field(..., description="Transformation configuration")
    enabled: bool = Field(default=True, description="Whether transformation is enabled")


class ConsistencyCheck(BaseModel):
    """Data consistency check result."""
    id: str = Field(..., description="Check identifier")
    name: str = Field(..., description="Check name")
    description: str = Field(..., description="Check description")
    status: str = Field(..., description="Status: passed, warning, failed")
    details: Optional[str] = Field(None, description="Check details")
    affectedRows: Optional[int] = Field(None, description="Number of affected rows")
    inconsistencies: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Detailed inconsistency data with variations and counts for label standardization"
    )


class WranglingConfigResponse(BaseModel):
    """Wrangling configuration data."""
    id: str = Field(..., description="Config UUID")
    session_id: str = Field(..., description="Session UUID")
    datasets: List[DatasetInfo] = Field(default_factory=list, description="Datasets")
    join_keys: List[str] = Field(default_factory=list, description="Join keys")
    join_warnings: List[JoinWarning] = Field(default_factory=list, description="Join warnings")
    missing_data_strategy: Dict[str, str] = Field(default_factory=dict, description="Missing data strategy")
    critical_variables: List[str] = Field(default_factory=list, description="Critical variables")
    optional_variables: List[str] = Field(default_factory=list, description="Optional variables")
    transformations: List[Transformation] = Field(default_factory=list, description="Transformations")
    consistency_checks: List[ConsistencyCheck] = Field(default_factory=list, description="Consistency checks")
    is_complete: bool = Field(default=False, description="Whether config is complete")
    # Data cleaning configurations
    label_standardization: Dict[str, Dict[str, str]] = Field(
        default_factory=dict,
        description="Map of columns to value mappings for standardizing labels"
    )
    duplicate_handling: str = Field(
        default="keep_all",
        description="Strategy for duplicate rows: keep_all, keep_first, keep_last, drop_all"
    )
    duplicate_id_column: Optional[str] = Field(
        None,
        description="Column name to check for duplicate IDs"
    )
    invalid_value_handling: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of columns to actions for invalid values"
    )


class WranglingConfigUpdate(BaseModel):
    """Update wrangling configuration."""
    datasets: Optional[List[DatasetInfo]] = Field(None, description="Datasets")
    join_keys: Optional[List[str]] = Field(None, description="Join keys")
    join_warnings: Optional[List[JoinWarning]] = Field(None, description="Join warnings")
    missing_data_strategy: Optional[Dict[str, str]] = Field(None, description="Missing data strategy")
    critical_variables: Optional[List[str]] = Field(None, description="Critical variables")
    optional_variables: Optional[List[str]] = Field(None, description="Optional variables")
    transformations: Optional[List[Transformation]] = Field(None, description="Transformations")
    consistency_checks: Optional[List[ConsistencyCheck]] = Field(None, description="Consistency checks")
    is_complete: Optional[bool] = Field(None, description="Whether config is complete")
    # Data cleaning configurations
    label_standardization: Optional[Dict[str, Dict[str, str]]] = Field(
        None,
        description="Map of columns to value mappings for standardizing labels"
    )
    duplicate_handling: Optional[str] = Field(
        None,
        description="Strategy for duplicate rows: keep_all, keep_first, keep_last, drop_all"
    )
    duplicate_id_column: Optional[str] = Field(
        None,
        description="Column name to check for duplicate IDs"
    )
    invalid_value_handling: Optional[Dict[str, str]] = Field(
        None,
        description="Map of columns to actions for invalid values"
    )


class RunConsistencyChecksRequest(BaseModel):
    """Request to run consistency checks on data."""
    data: List[Dict[str, Any]] = Field(..., description="Dataset rows to check")


# ============================================================================
# File Uploads
# ============================================================================

class FileMetadataResponse(BaseModel):
    """File metadata."""
    id: str = Field(..., description="File UUID")
    session_id: str = Field(..., description="Session UUID")
    file_name: str = Field(..., description="File name")
    file_type: str = Field(..., description="File MIME type")
    file_size: int = Field(..., description="File size in bytes")
    storage_path: Optional[str] = Field(None, description="Storage path")
    row_count: Optional[int] = Field(None, description="Number of rows")
    column_names: Optional[List[str]] = Field(None, description="Column names")
    created_at: str = Field(..., description="Upload timestamp")


class ParsedFileData(BaseModel):
    """Parsed file data."""
    columns: List[str] = Field(..., description="Column names")
    rows: List[Dict[str, Any]] = Field(..., description="Data rows")
    rowCount: int = Field(..., description="Number of rows")


class FileUploadResponse(BaseModel):
    """File upload response."""
    file: FileMetadataResponse = Field(..., description="File metadata")
    parsed_data: ParsedFileData = Field(..., description="Parsed file data")
