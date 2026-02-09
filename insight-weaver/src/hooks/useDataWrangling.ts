import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';

export interface Dataset {
  id: string;
  name: string;
  rowCount: number;
  columns: string[];
  keyColumn?: string;
}

export interface JoinWarning {
  type: 'missing' | 'duplicate' | 'mismatch';
  message: string;
  affectedRows: number;
}

export interface MissingDataStrategy {
  [column: string]: 'keep' | 'drop' | 'impute_mean' | 'impute_median';
}

export interface Transformation {
  id: string;
  type: 'recode' | 'reverse_score' | 'standardize' | 'normalize';
  column: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface ConsistencyCheck {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'warning' | 'failed';
  details?: string;
  affectedRows?: number;
  inconsistencies?: Array<{
    column: string;
    variations: Array<{
      value: string;
      count: number;
    }>;
  }>;
}

export interface WranglingConfig {
  id: string;
  session_id: string;
  datasets: Dataset[];
  join_keys: string[];
  join_warnings: JoinWarning[];
  missing_data_strategy: MissingDataStrategy;
  critical_variables: string[];
  optional_variables: string[];
  transformations: Transformation[];
  consistency_checks: ConsistencyCheck[];
  is_complete: boolean;
}

export const useDataWrangling = (sessionId: string | undefined) => {
  const [config, setConfig] = useState<WranglingConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const data = await apiClient.getWranglingConfig(sessionId);
      setConfig(data || null);
    } catch (error) {
      console.error('Error fetching wrangling config:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const createConfig = useCallback(async () => {
    if (!sessionId) return;

    try {
      const data = await apiClient.createWranglingConfig(sessionId);
      setConfig(data);
      return data;
    } catch (error) {
      console.error('Error creating wrangling config:', error);
      toast.error('Failed to initialize wrangling configuration');
    }
  }, [sessionId]);

  const updateConfig = useCallback(async (updates: Partial<WranglingConfig>) => {
    if (!config?.id) return;

    try {
      const data = await apiClient.updateWranglingConfig(config.id, updates);
      setConfig(data);
    } catch (error) {
      console.error('Error updating wrangling config:', error);
      toast.error('Failed to save changes');
    }
  }, [config?.id]);

  const addDataset = useCallback(async (dataset: Dataset) => {
    const newDatasets = [...(config?.datasets || []), dataset];
    await updateConfig({ datasets: newDatasets });
  }, [config?.datasets, updateConfig]);

  const removeDataset = useCallback(async (datasetId: string) => {
    const newDatasets = (config?.datasets || []).filter(d => d.id !== datasetId);
    await updateConfig({ datasets: newDatasets });
  }, [config?.datasets, updateConfig]);

  const addTransformation = useCallback(async (transformation: Transformation) => {
    const newTransformations = [...(config?.transformations || []), transformation];
    await updateConfig({ transformations: newTransformations });
  }, [config?.transformations, updateConfig]);

  const toggleTransformation = useCallback(async (transformationId: string) => {
    const newTransformations = (config?.transformations || []).map(t =>
      t.id === transformationId ? { ...t, enabled: !t.enabled } : t
    );
    await updateConfig({ transformations: newTransformations });
  }, [config?.transformations, updateConfig]);

  const removeTransformation = useCallback(async (transformationId: string) => {
    const newTransformations = (config?.transformations || []).filter(t => t.id !== transformationId);
    await updateConfig({ transformations: newTransformations });
  }, [config?.transformations, updateConfig]);

  const runConsistencyChecks = useCallback(async (data: Record<string, unknown>[]) => {
    if (!config?.id) return [];

    try {
      const checks = await apiClient.runConsistencyChecks(config.id, data);
      setConfig(prev => prev ? { ...prev, consistency_checks: checks } : null);
      return checks;
    } catch (error) {
      console.error('Error running consistency checks:', error);
      return [];
    }
  }, [config?.id]);

  return {
    config,
    loading,
    createConfig,
    updateConfig,
    addDataset,
    removeDataset,
    addTransformation,
    toggleTransformation,
    removeTransformation,
    runConsistencyChecks,
    fetchConfig,
  };
};
