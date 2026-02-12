/**
 * LLM Service for FastAPI Backend
 *
 * Provides high-level LLM operations that replace Supabase Edge Functions.
 * Handles dataset uploads, prompt construction, and response parsing.
 */

import { apiClient } from './apiClient';
import {
  buildAnalysisPrompt,
  buildVariablesPrompt,
  buildInterpretationPrompt,
  SUGGEST_ANALYSES_SYSTEM_PROMPT,
  SUGGEST_VARIABLES_SYSTEM_PROMPT,
  INTERPRET_RESULTS_SYSTEM_PROMPT,
} from '@/constants/prompts';
import type {
  SuggestAnalysesRequest,
  SuggestedAnalysis,
  SuggestVariablesRequest,
  SuggestedVariable,
  InterpretResultsRequest,
  DatasetUploadResponse,
  LLMProxyRequest,
  LLMProxyResponse,
} from '@/types/api';

/**
 * Convert array of row objects to CSV string
 */
function convertToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  // Get headers from first row
  const headers = Object.keys(rows[0]);

  // Build CSV
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        // Handle strings with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Extract JSON array from LLM response
 * Handles cases where LLM returns text before/after the JSON
 */
function extractJSON<T>(content: string): T[] {
  try {
    // Try direct parse first
    return JSON.parse(content);
  } catch {
    // Try to extract JSON array with regex
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON array found in response');
  }
}

/**
 * Upload dataset to backend for LLM file-based queries
 */
async function uploadDataset(
  sampleRows: Record<string, unknown>[],
  filename: string = 'data.csv'
): Promise<string> {
  // Convert to CSV
  const csvData = convertToCSV(sampleRows);

  // Create FormData
  const formData = new FormData();
  const blob = new Blob([csvData], { type: 'text/csv' });
  formData.append('file', blob, filename);

  // Upload
  const response = await apiClient.post<DatasetUploadResponse>('/api/upload-dataset', formData);

  return response.file_path;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Suggest analysis methods for a dataset
 *
 * Replaces: POST /functions/v1/suggest-analyses
 */
export async function suggestAnalyses(
  context: SuggestAnalysesRequest
): Promise<SuggestedAnalysis[]> {
  try {
    console.log('Requesting analysis suggestions from FastAPI backend...');

    // Build prompts (sample rows included as text)
    const userPrompt = buildAnalysisPrompt(context);
    const fullPrompt = `${SUGGEST_ANALYSES_SYSTEM_PROMPT}\n\n${userPrompt}`;

    // Standard LLM call (no file upload)
    const llmRequest: LLMProxyRequest = {
      prompt: fullPrompt,
      max_tokens: 2000,
      temperature: 0.7,
    };

    const response = await apiClient.post<LLMProxyResponse>('/api/llm-proxy', llmRequest);

    console.log('Analysis suggestions received:', response.response.substring(0, 100));

    // Parse JSON response
    const suggestions = extractJSON<SuggestedAnalysis>(response.response);

    console.log(`Parsed ${suggestions.length} analysis suggestions`);

    return suggestions;
  } catch (error) {
    console.error('Failed to generate analysis suggestions:', error);
    throw error;
  }
}

/**
 * Suggest derived variables for a dataset
 *
 * Replaces: POST /functions/v1/suggest-variables
 */
export async function suggestVariables(
  context: SuggestVariablesRequest
): Promise<SuggestedVariable[]> {
  try {
    const t0 = performance.now();
    console.group('[suggestVariables] timing breakdown');
    console.log(`rows: ${context.sampleRows.length}, columns: ${context.columns.length}`);

    // ── Step 1: Build prompt (5 sample rows included as text) ───────────────
    const t1 = performance.now();
    const userPrompt = buildVariablesPrompt({ ...context, sampleRows: context.sampleRows.slice(0, 5) });
    const fullPrompt = `${SUGGEST_VARIABLES_SYSTEM_PROMPT}\n\n${userPrompt}`;
    const t2 = performance.now();
    console.log(`  [1] buildVariablesPrompt: ${(t2 - t1).toFixed(0)} ms  (prompt length: ${fullPrompt.length} chars)`);

    // ── Step 2: LLM proxy call (standard, no file upload) ───────────────────
    const llmRequest: LLMProxyRequest = {
      prompt: fullPrompt,
      max_tokens: 1500,
      temperature: 0.7,
    };

    const response = await apiClient.post<LLMProxyResponse>('/api/llm-proxy', llmRequest);
    const t3 = performance.now();
    console.log(`  [2] POST /api/llm-proxy (total round-trip): ${(t3 - t2).toFixed(0)} ms`);
    console.log(`      backend-reported LLM latency: ${response.latency_ms?.toFixed(0) ?? 'n/a'} ms`);
    console.log(`      tokens used: ${JSON.stringify(response.usage)}`);

    // ── Step 3: Parse JSON from LLM response ────────────────────────────────
    const suggestions = extractJSON<SuggestedVariable>(response.response);
    const t4 = performance.now();
    console.log(`  [3] JSON parse: ${(t4 - t3).toFixed(0)} ms  (${suggestions.length} suggestions)`);

    console.log(`  ── TOTAL: ${(t4 - t0).toFixed(0)} ms ──`);
    console.groupEnd();

    return suggestions;
  } catch (error) {
    console.error('[suggestVariables] Failed:', error);
    console.groupEnd();
    throw error;
  }
}

/**
 * Interpret analysis results
 *
 * Replaces: POST /functions/v1/interpret-results
 */
export async function interpretResults(context: InterpretResultsRequest): Promise<string> {
  try {
    console.log('Requesting result interpretation from FastAPI backend...');

    // Build prompts (no dataset needed for interpretation)
    const userPrompt = buildInterpretationPrompt(context);
    const fullPrompt = `${INTERPRET_RESULTS_SYSTEM_PROMPT}\n\n${userPrompt}`;

    // Call LLM without dataset
    const llmRequest: LLMProxyRequest = {
      prompt: fullPrompt,
      max_tokens: 1000,
      temperature: 0.7,
    };

    const response = await apiClient.post<LLMProxyResponse>('/api/llm-proxy', llmRequest);

    console.log('Result interpretation received');

    return response.response;
  } catch (error) {
    console.error('Failed to generate result interpretation:', error);
    throw error;
  }
}

/**
 * Suggest visualizations for a dataset
 *
 * Uses backend endpoint: POST /api/suggest-visualizations
 */
export async function suggestVisualizations(context: {
  columns: string[];
  researchQuestion?: string;
  distributionType?: string;
  hasOutliers?: boolean;
  datasetReference?: string;
}): Promise<Array<{
  plot_type: string;
  columns: string[];
  title: string;
  description: string;
}>> {
  try {
    console.log('Requesting visualization suggestions from FastAPI backend...');

    const response = await apiClient.post<{
      suggestions: Array<{
        plot_type: string;
        columns: string[];
        title: string;
        description: string;
      }>;
    }>('/api/suggest-visualizations', {
      columns: context.columns,
      research_question: context.researchQuestion,
      distribution_type: context.distributionType,
      has_outliers: context.hasOutliers,
      dataset_reference: context.datasetReference,
    });

    console.log(`Received ${response.suggestions.length} visualization suggestions`);

    return response.suggestions;
  } catch (error) {
    console.error('Failed to generate visualization suggestions:', error);
    throw error;
  }
}

/**
 * LLM Service API
 */
export const llmService = {
  suggestAnalyses,
  suggestVariables,
  interpretResults,
  suggestVisualizations,
};
