import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

export interface DerivedVariable {
  id: string;
  session_id: string;
  name: string;
  formula: string;
  formula_type?: string;  // 'eval' or 'transform'
  description: string | null;
  is_enabled: boolean | null;
  created_at: string;
}

export const useDerivedVariables = (sessionId: string | undefined) => {
  const [variables, setVariables] = useState<DerivedVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing variables for this session
  useEffect(() => {
    if (!sessionId) return;

    const fetchVariables = async () => {
      setLoading(true);
      try {
        const existing = await apiClient.getVariables(sessionId);
        setVariables(existing || []);
      } catch (err) {
        console.error('Derived variables error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load variables');
      } finally {
        setLoading(false);
      }
    };

    fetchVariables();
  }, [sessionId]);

  // Add new variable
  const addVariable = useCallback(async (variable: { name: string; formula: string; formula_type?: string; description?: string }) => {
    if (!sessionId) return;

    try {
      const data = await apiClient.createVariable(sessionId, {
        name: variable.name,
        formula: variable.formula,
        formula_type: variable.formula_type || 'eval',
        description: variable.description || null,
        is_enabled: true,
      });

      setVariables(prev => [...prev, data]);
    } catch (err) {
      console.error('Add variable error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add variable');
    }
  }, [sessionId]);

  // Toggle variable enabled state
  const toggleVariable = useCallback(async (variableId: string, isEnabled: boolean) => {
    try {
      await apiClient.toggleVariable(variableId, isEnabled);
      setVariables(prev =>
        prev.map(v => v.id === variableId ? { ...v, is_enabled: isEnabled } : v)
      );
    } catch (err) {
      console.error('Toggle variable error:', err);
    }
  }, []);

  // Delete variable
  const deleteVariable = useCallback(async (variableId: string) => {
    try {
      await apiClient.deleteVariable(variableId);
      setVariables(prev => prev.filter(v => v.id !== variableId));
    } catch (err) {
      console.error('Delete variable error:', err);
    }
  }, []);

  return { variables, loading, error, addVariable, toggleVariable, deleteVariable };
};
