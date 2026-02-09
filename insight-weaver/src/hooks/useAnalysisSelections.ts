import { useState, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';
import { llmService } from '@/services/llmService';

export interface AnalysisSelection {
  id: string;
  session_id: string;
  analysis_type: string;
  is_selected: boolean | null;
  title: string | null;
  description: string | null;
  complexity: string | null;
  reasoning: string | null;
  selected_columns: string[] | null;
  execution_spec?: {
    library: string;
    function: string;
    param_map: Record<string, string>;
  } | null;
  created_at: string;
}

export interface SuggestedAnalysis {
  id: string;
  title: string;
  description: string;
  complexity: 'Basic' | 'Intermediate' | 'Advanced';
  reasoning: string;
  execution_spec?: {
    library: string;
    function: string;
    param_map: Record<string, string>;
  };
}

export const useAnalysisSelections = (sessionId: string | undefined) => {
  const [selections, setSelections] = useState<AnalysisSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing selections
  const fetchSelections = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const data = await apiClient.getSelections(sessionId);
      setSelections(data || []);
    } catch (err) {
      console.error('Fetch selections error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load selections');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Set AI-suggested analyses
  const setAISuggestions = useCallback(async (suggestions: SuggestedAnalysis[]) => {
    if (!sessionId) return;

    try {
      // Map suggestions to API format
      const toInsert = suggestions.map(s => ({
        analysis_type: s.id,
        title: s.title,
        description: s.description,
        complexity: s.complexity,
        reasoning: s.reasoning,
        is_selected: false,
        execution_spec: s.execution_spec || null,
        // Derive selected_columns from execution_spec param_map if available
        selected_columns: s.execution_spec
          ? Object.values(s.execution_spec.param_map)
          : null,
      }));

      // Create selections (backend will replace existing ones)
      const data = await apiClient.createSelections(sessionId, toInsert);
      setSelections(data || []);
    } catch (err) {
      console.error('Set AI suggestions error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save suggestions');
    }
  }, [sessionId]);

  // Generate AI suggestions
  const generateSuggestions = useCallback(async (context: {
    columns: string[];
    sampleRows: Record<string, unknown>[];
    researchQuestion?: string;
    distributionType?: string;
    hasOutliers?: boolean;
    derivedVariables?: { name: string; formula?: string }[];
    trialsDetected?: number;
  }) => {
    setGenerating(true);
    setError(null);

    try {
      // Call FastAPI backend for analysis suggestions
      const rawSuggestions = await llmService.suggestAnalyses(context);

      if (!rawSuggestions || rawSuggestions.length === 0) {
        return [];
      }

      // Deduplicate by id (LLM sometimes returns same function multiple times)
      const seen = new Set<string>();
      const deduped = rawSuggestions.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Validate execution_spec column names against actual dataset columns
      const validColumns = new Set(context.columns);
      const suggestions = deduped.map(s => {
        if (!s.execution_spec) return s;
        const allColumnsValid = Object.values(s.execution_spec.param_map).every(
          col => validColumns.has(col)
        );
        if (!allColumnsValid) {
          console.warn(`[useAnalysisSelections] Dropping execution_spec for "${s.id}": ` +
            `param_map references non-existent column(s): ` +
            Object.values(s.execution_spec.param_map).filter(c => !validColumns.has(c)).join(', ')
          );
          return { ...s, execution_spec: undefined };
        }
        return s;
      });

      await setAISuggestions(suggestions);
      return suggestions;
    } catch (err) {
      console.error('Generate suggestions error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
      return [];
    } finally {
      setGenerating(false);
    }
  }, [setAISuggestions]);

  // Toggle selection
  const toggleSelection = useCallback(async (analysisType: string) => {
    const selection = selections.find(s => s.analysis_type === analysisType);
    if (!selection) return;

    try {
      await apiClient.toggleSelection(selection.id);
      setSelections(prev =>
        prev.map(s => s.id === selection.id ? { ...s, is_selected: !s.is_selected } : s)
      );
    } catch (err) {
      console.error('Toggle selection error:', err);
    }
  }, [selections]);

  // Update selected columns for an analysis
  const updateSelectedColumns = useCallback(async (analysisType: string, columns: string[]) => {
    const selection = selections.find(s => s.analysis_type === analysisType);
    if (!selection) return;

    try {
      await apiClient.updateSelectionColumns(selection.id, columns);
      setSelections(prev =>
        prev.map(s => s.analysis_type === analysisType ? { ...s, selected_columns: columns } : s)
      );
    } catch (err) {
      console.error('Update columns error:', err);
    }
  }, [selections]);

  // Get selected analyses
  const getSelectedAnalyses = useCallback(() => {
    return selections.filter(s => s.is_selected).map(s => s.analysis_type);
  }, [selections]);

  return {
    selections,
    loading,
    generating,
    error,
    fetchSelections,
    generateSuggestions,
    toggleSelection,
    getSelectedAnalyses,
    updateSelectedColumns
  };
};
