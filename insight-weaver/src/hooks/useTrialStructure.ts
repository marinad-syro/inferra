import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

export interface TrialStructure {
  id: string;
  session_id: string;
  trial_onset_event: string;
  response_event: string;
  outcome_event: string;
  trials_detected: number | null;
  created_at: string;
  updated_at: string;
}

export const useTrialStructure = (sessionId: string | undefined) => {
  const [trialStructure, setTrialStructure] = useState<TrialStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create trial structure
  useEffect(() => {
    if (!sessionId) return;

    const fetchOrCreate = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getTrialStructure(sessionId);
        setTrialStructure(data);
      } catch (err) {
        console.error('Trial structure error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trial structure');
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreate();
  }, [sessionId]);

  // Update trial structure
  const updateTrialStructure = useCallback(async (updates: Partial<TrialStructure>) => {
    if (!trialStructure) return;

    try {
      const data = await apiClient.updateTrialStructure(trialStructure.id, updates);
      setTrialStructure(data);
    } catch (err) {
      console.error('Update trial structure error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }, [trialStructure]);

  // Count trials based on onset event
  const countTrials = useCallback((data: Record<string, unknown>[], onsetEvent: string) => {
    if (!trialStructure) return 0;

    const count = data.filter(row => row.event_type === onsetEvent).length;
    updateTrialStructure({ trials_detected: count });
    return count;
  }, [trialStructure, updateTrialStructure]);

  return { trialStructure, loading, error, updateTrialStructure, countTrials };
};
