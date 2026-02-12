/**
 * API Client for FastAPI Backend
 *
 * Provides typed HTTP client with error handling, retries, and logging.
 */

import { apiConfig, getBackendUrl } from '@/config/api';
import type { ErrorResponse } from '@/types/api';

/**
 * HTTP client error with structured error response
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Transform fetch errors into structured ApiError
 */
function transformError(response: Response, data: any): ApiError {
  // Handle rate limiting
  if (response.status === 429) {
    return new ApiError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded. Please try again later.',
      data.details
    );
  }

  // Handle credit exhaustion (preserve existing pattern)
  if (response.status === 402) {
    return new ApiError(
      402,
      'CREDITS_EXHAUSTED',
      'AI credits exhausted. Please add more credits.',
      data.details
    );
  }

  // Handle FastAPI error responses
  if (data && typeof data === 'object') {
    if (data.error_code && data.message) {
      return new ApiError(
        response.status,
        data.error_code,
        data.message,
        data.details
      );
    }
  }

  // Fallback to generic error
  return new ApiError(
    response.status,
    'REQUEST_FAILED',
    `Request failed with status ${response.status}`,
    { statusText: response.statusText }
  );
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatusCodes: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 2,
  retryDelay: 1000, // 1 second
  retryableStatusCodes: [500, 502, 503, 504], // Only retry server errors
};

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with error handling and retries
 */
async function request<T>(
  method: string,
  endpoint: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    retryConfig?: Partial<RetryConfig>;
  } = {}
): Promise<T> {
  const url = getBackendUrl(endpoint);
  const retryConfig = { ...defaultRetryConfig, ...options.retryConfig };

  let lastError: ApiError | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Build request options
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };

      // Add body for POST/PUT/PATCH
      if (options.body && method !== 'GET') {
        if (options.body instanceof FormData) {
          // Remove Content-Type header for FormData (browser will set it with boundary)
          delete fetchOptions.headers!['Content-Type'];
          fetchOptions.body = options.body;
        } else {
          fetchOptions.body = JSON.stringify(options.body);
        }
      }

      // Make request
      const response = await fetch(url, fetchOptions);

      // Parse response
      let data: any;
      // 204 No Content and similar empty responses have no body to parse
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        data = null;
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      }

      // Handle error responses
      if (!response.ok) {
        const error = transformError(response, data);

        // Check if we should retry
        if (
          retryConfig.retryableStatusCodes.includes(response.status) &&
          attempt < retryConfig.maxRetries
        ) {
          console.warn(
            `Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}): ${error.message}. Retrying...`
          );
          lastError = error;
          await sleep(retryConfig.retryDelay * (attempt + 1)); // Exponential backoff
          continue;
        }

        throw error;
      }

      // Success
      return data as T;
    } catch (error) {
      // Network or parsing errors
      if (error instanceof ApiError) {
        throw error;
      }

      // Retry network errors
      if (attempt < retryConfig.maxRetries) {
        console.warn(
          `Network error (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}): ${error}. Retrying...`
        );
        lastError = new ApiError(0, 'NETWORK_ERROR', String(error));
        await sleep(retryConfig.retryDelay * (attempt + 1));
        continue;
      }

      // Max retries exceeded
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        `Network error after ${retryConfig.maxRetries + 1} attempts: ${error}`
      );
    }
  }

  // Should never reach here, but TypeScript doesn't know that
  throw lastError || new ApiError(0, 'UNKNOWN_ERROR', 'Unknown error occurred');
}

/**
 * API client methods
 */
export const apiClient = {
  /**
   * Make GET request
   */
  get: <T>(endpoint: string, options?: { headers?: Record<string, string> }) =>
    request<T>('GET', endpoint, options),

  /**
   * Make POST request
   */
  post: <T>(
    endpoint: string,
    body?: any,
    options?: { headers?: Record<string, string>; retryConfig?: Partial<RetryConfig> }
  ) => request<T>('POST', endpoint, { body, ...options }),

  /**
   * Make PUT request
   */
  put: <T>(
    endpoint: string,
    body?: any,
    options?: { headers?: Record<string, string> }
  ) => request<T>('PUT', endpoint, { body, ...options }),

  /**
   * Make DELETE request
   */
  delete: <T>(endpoint: string, options?: { headers?: Record<string, string> }) =>
    request<T>('DELETE', endpoint, options),

  /**
   * Check backend health
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    try {
      return await this.get('/api/health');
    } catch (error) {
      console.error('Backend health check failed:', error);
      throw error;
    }
  },

  // ========================================================================
  // SESSIONS
  // ========================================================================

  /**
   * Create a new workflow session
   */
  async createSession(currentStep: number = 1): Promise<any> {
    return await this.post('/api/sessions', { current_step: currentStep });
  },

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<any> {
    return await this.get(`/api/sessions/${sessionId}`);
  },

  /**
   * Update session step
   */
  async updateSessionStep(sessionId: string, step: number): Promise<any> {
    return await this.patch(`/api/sessions/${sessionId}/step`, { step });
  },

  /**
   * Update session metadata
   */
  async updateSessionMetadata(sessionId: string, metadata: any): Promise<any> {
    return await this.patch(`/api/sessions/${sessionId}/metadata`, metadata);
  },

  // ========================================================================
  // ANALYSIS SELECTIONS
  // ========================================================================

  /**
   * Get all analysis selections for a session
   */
  async getSelections(sessionId: string): Promise<any[]> {
    return await this.get(`/api/selections/${sessionId}`);
  },

  /**
   * Batch create analysis selections
   */
  async createSelections(sessionId: string, selections: any[]): Promise<any[]> {
    return await this.post(`/api/selections?session_id=${sessionId}`, { selections });
  },

  /**
   * Toggle selection status
   */
  async toggleSelection(selectionId: string): Promise<any> {
    return await this.patch(`/api/selections/${selectionId}/toggle`, {});
  },

  /**
   * Update selected columns for an analysis
   */
  async updateSelectionColumns(selectionId: string, columns: string[]): Promise<any> {
    return await this.patch(`/api/selections/${selectionId}/columns`, { columns });
  },

  // ========================================================================
  // DERIVED VARIABLES
  // ========================================================================

  /**
   * Get all derived variables for a session
   */
  async getVariables(sessionId: string): Promise<any[]> {
    return await this.get(`/api/variables/${sessionId}`);
  },

  /**
   * Create a derived variable
   */
  async createVariable(sessionId: string, variable: any): Promise<any> {
    return await this.post(`/api/variables?session_id=${sessionId}`, variable);
  },

  /**
   * Toggle variable enabled status
   */
  async toggleVariable(variableId: string, isEnabled: boolean): Promise<any> {
    return await this.patch(`/api/variables/${variableId}/toggle`, { is_enabled: isEnabled });
  },

  /**
   * Delete a derived variable
   */
  async deleteVariable(variableId: string): Promise<void> {
    return await this.delete(`/api/variables/${variableId}`);
  },

  // ========================================================================
  // TRIAL STRUCTURES
  // ========================================================================

  /**
   * Get or create trial structure for a session
   */
  async getTrialStructure(sessionId: string): Promise<any> {
    return await this.get(`/api/trials/${sessionId}`);
  },

  /**
   * Update trial structure
   */
  async updateTrialStructure(trialId: string, updates: any): Promise<any> {
    return await this.patch(`/api/trials/${trialId}`, updates);
  },

  /**
   * Count trials in data
   */
  async countTrials(trialId: string, onsetEvent: string, data: any[]): Promise<any> {
    return await this.post(`/api/trials/${trialId}/count`, { onset_event: onsetEvent, data });
  },

  // ========================================================================
  // DATA WRANGLING
  // ========================================================================

  /**
   * Get wrangling config for a session
   */
  async getWranglingConfig(sessionId: string): Promise<any> {
    return await this.get(`/api/wrangling/${sessionId}`);
  },

  /**
   * Create a new wrangling config
   */
  async createWranglingConfig(sessionId: string): Promise<any> {
    return await this.post(`/api/wrangling?session_id=${sessionId}`, {});
  },

  /**
   * Update wrangling config
   */
  async updateWranglingConfig(configId: string, updates: any): Promise<any> {
    return await this.patch(`/api/wrangling/${configId}`, updates);
  },

  /**
   * Run consistency checks on data
   */
  async runConsistencyChecks(configId: string, data: any[]): Promise<any[]> {
    return await this.post(`/api/wrangling/${configId}/consistency-checks`, { data });
  },

  // ========================================================================
  // FILE UPLOADS
  // ========================================================================

  /**
   * Upload a single file
   */
  async uploadFile(sessionId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return await this.post(`/api/files/upload?session_id=${sessionId}`, formData);
  },

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(sessionId: string, files: File[]): Promise<any[]> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return await this.post(`/api/files/upload-multiple?session_id=${sessionId}`, formData);
  },

  /**
   * Get all files for a session
   */
  async getFiles(sessionId: string, latest: boolean = false): Promise<any[]> {
    return await this.get(`/api/files/${sessionId}?latest=${latest}`);
  },

  /**
   * Get latest file for a session
   */
  async getLatestFile(sessionId: string): Promise<any> {
    return await this.get(`/api/files/${sessionId}/latest`);
  },

  /**
   * Get parsed file data by file ID
   */
  async getFileData(fileId: string): Promise<any> {
    return await this.get(`/api/files/data/${fileId}`);
  },

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    return await this.delete(`/api/files/${fileId}`);
  },

  // ========================================================================
  // Compute & Visualization
  // ========================================================================

  /**
   * Compute derived variables
   */
  async computeVariables(datasetReference: string, variables: Array<{ name: string; formula: string }>): Promise<any> {
    return await this.post('/api/compute-variables', {
      dataset_reference: datasetReference,
      variables
    });
  },

  /**
   * Generate visualization
   */
  async generateVisualization(params: {
    dataset_reference: string;
    plot_type: string;
    x_column?: string;
    y_column?: string;
    color_column?: string;
  }): Promise<any> {
    return await this.post('/api/visualize', params);
  },

  /**
   * Run analysis
   */
  async runAnalysis(params: {
    dataset_reference: string;
    prompt?: string;
    execution_spec?: {
      library: string;
      function: string;
      param_map: Record<string, string>;
    };
    dataset_schema?: { columns: string[] };
    user_id?: string;
  }): Promise<any> {
    return await this.post('/api/run', params);
  },

  // ========================================================================
  // CODE CANVAS
  // ========================================================================

  /**
   * Generate code from UI operations
   */
  async generateCode(
    sessionId: string,
    language: 'python' | 'r' = 'python',
    options?: {
      include_cleaning?: boolean;
      include_transforms?: boolean;
      include_analyses?: boolean;
    }
  ): Promise<{ code: string; language: string; operations_included: string[] }> {
    const params = new URLSearchParams({
      language,
      ...(options?.include_cleaning !== undefined && { include_cleaning: String(options.include_cleaning) }),
      ...(options?.include_transforms !== undefined && { include_transforms: String(options.include_transforms) }),
      ...(options?.include_analyses !== undefined && { include_analyses: String(options.include_analyses) }),
    });
    return await this.get(`/api/code-canvas/${sessionId}/generate?${params}`);
  },

  /**
   * Execute user-edited code (Python or R)
   */
  async executeCode(
    sessionId: string,
    code: string,
    language: 'python' | 'r' = 'python',
    datasetReference?: string
  ): Promise<{
    success: boolean;
    row_count?: number;
    column_names?: string[];
    dataset?: any[];
    console_output?: string;
    plots?: string[];
    analysis_results?: Record<string, any>;
    error?: string;
    traceback?: string;
  }> {
    return await this.post(`/api/code-canvas/${sessionId}/execute`, {
      code,
      language,
      session_id: sessionId,
      dataset_reference: datasetReference,
    });
  },

  /**
   * Get execution status
   */
  async getExecutionStatus(sessionId: string): Promise<any> {
    return await this.get(`/api/code-canvas/${sessionId}/status`);
  },

  // ========================================================================
  // PATCH method
  // ========================================================================

  /**
   * Make PATCH request
   */
  patch: <T>(
    endpoint: string,
    body?: any,
    options?: { headers?: Record<string, string> }
  ) => request<T>('PATCH', endpoint, { body, ...options }),
};

/**
 * Check if backend is available
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    await apiClient.healthCheck();
    return true;
  } catch (error) {
    return false;
  }
}
