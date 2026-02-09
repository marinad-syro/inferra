/**
 * Type definitions for FastAPI backend API
 *
 * These types match the Pydantic schemas defined in the FastAPI backend.
 */

// ============================================================================
// LLM Proxy Types
// ============================================================================

export interface LLMProxyRequest {
  prompt: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  max_tokens?: number;
  temperature?: number;
  dataset_reference?: string; // File path from upload
  use_reasoning?: boolean;
  reasoning_effort?: 'low' | 'high';
  model?: string; // Optional model override
}

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
}

export interface LLMProxyResponse {
  response: string;
  usage?: LLMUsage;
  latency_ms: number;
  model: string;
}

export interface LLMReasoningResponse {
  reasoning_content: string;
  response: string;
  reasoning_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  model: string;
}

// ============================================================================
// Dataset Upload Types
// ============================================================================

export interface DatasetUploadResponse {
  file_path: string;
  file_id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string;
}

// ============================================================================
// Analysis Decision Types
// ============================================================================

export interface DecisionRequest {
  prompt: string;
  dataset_schema: DatasetSchema;
  dataset_path?: string;
  use_reasoning?: boolean;
}

export interface DatasetSchema {
  columns: ColumnInfo[];
  row_count?: number;
  numeric_columns: string[];
  categorical_columns: string[];
}

export interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'unknown';
  unique_count?: number;
  null_count?: number;
  sample_values?: any[];
}

export interface DecisionResult {
  rule_id?: string;
  library?: string;
  function?: string;
  param_map?: Record<string, ParameterMapping>;
  confidence: number;
  source: 'deterministic' | 'llm' | 'none';
  explanation?: string;
}

export interface ParameterMapping {
  type: string;
  column?: string;
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: Record<string, any>;
}

// ============================================================================
// Frontend-Specific Types for LLM Service
// ============================================================================

/**
 * Request type for analysis suggestions
 * Matches the current Edge Function interface
 */
export interface SuggestAnalysesRequest {
  columns: string[];
  sampleRows: Record<string, unknown>[];
  researchQuestion?: string;
  distributionType?: string;
  hasOutliers?: boolean;
  derivedVariables?: { name: string; formula?: string }[];
  trialsDetected?: number;
}

/**
 * Execution specification for running an analysis directly
 */
export interface ExecutionSpec {
  library: string;
  function: string;
  param_map: Record<string, string>;
}

/**
 * Suggested analysis returned by LLM
 */
export interface SuggestedAnalysis {
  id: string;
  title: string;
  description: string;
  complexity: 'basic' | 'moderate' | 'advanced';
  reasoning?: string;
  execution_spec?: ExecutionSpec;
}

/**
 * Request type for variable suggestions
 */
export interface SuggestVariablesRequest {
  sampleRows: Record<string, unknown>[];
  columns: string[];
  researchQuestion?: string;
}

/**
 * Suggested variable returned by LLM
 */
export interface SuggestedVariable {
  name: string;
  formula?: string;
  formula_type?: string;  // 'eval' or 'transform'
  description: string;
}

/**
 * Request type for result interpretation
 */
export interface InterpretResultsRequest {
  result: AnalysisResult;
  researchContext?: {
    researchQuestion?: string;
    distributionType?: string;
    hasOutliers?: boolean;
  };
}

/**
 * Analysis result structure
 * This should match the actual result structure from your analysis pipeline
 */
export interface AnalysisResult {
  analysisType: string;
  parameters: Record<string, any>;
  metrics?: Record<string, any>;
  [key: string]: any;
}
