/**
 * API Configuration
 *
 * Centralized configuration for all API endpoints including
 * FastAPI backend and Supabase services.
 */

export const apiConfig = {
  /**
   * FastAPI backend base URL
   * Used for LLM operations, analysis execution, and dataset uploads
   */
  backendUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000',

  /**
   * Supabase URL
   * Used for authentication, storage, and database operations
   */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,

  /**
   * Feature flag to enable/disable FastAPI backend integration
   * Set to false to fall back to Supabase Edge Functions during migration
   */
  useBackend: true,

  /**
   * API endpoints (relative to backendUrl)
   */
  endpoints: {
    health: '/api/health',
    llmProxy: '/api/llm-proxy',
    uploadDataset: '/api/upload-dataset',
    decide: '/api/decide',
    run: '/api/run',
    analyze: '/api/analyze',
    jobs: (jobId: string) => `/api/jobs/${jobId}`,
  },
} as const;

/**
 * Get the full URL for a backend endpoint
 */
export function getBackendUrl(endpoint: string): string {
  return `${apiConfig.backendUrl}${endpoint}`;
}

/**
 * Check if backend is enabled
 */
export function isBackendEnabled(): boolean {
  return apiConfig.useBackend && !!apiConfig.backendUrl;
}
