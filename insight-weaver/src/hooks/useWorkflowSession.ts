import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

export interface WorkflowSession {
  id: string;
  current_step: number;
  created_at: string;
  updated_at: string;
  research_question: string | null;
  distribution_type: string | null;
  has_outliers: boolean | null;
  outlier_notes: string | null;
}

export const useWorkflowSession = () => {
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get or create session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check localStorage for existing session ID
        const existingSessionId = localStorage.getItem('workflow_session_id');

        if (existingSessionId) {
          // Try to fetch existing session
          try {
            const data = await apiClient.getSession(existingSessionId);
            setSession(data);
            setLoading(false);
            return;
          } catch (fetchError) {
            // Session not found, create new one
            console.warn('Session not found, creating new one');
          }
        }

        // Create new session
        const newSession = await apiClient.createSession(1);
        localStorage.setItem('workflow_session_id', newSession.id);
        setSession(newSession);
      } catch (err) {
        console.error('Session error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize session');
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // Update current step
  const updateStep = useCallback(async (step: number) => {
    if (!session) return;

    try {
      const data = await apiClient.updateSessionStep(session.id, step);
      setSession(data);
    } catch (err) {
      console.error('Update step error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update step');
    }
  }, [session]);

  // Update research metadata
  const updateMetadata = useCallback(async (metadata: {
    research_question?: string;
    distribution_type?: string;
    has_outliers?: boolean;
    outlier_notes?: string;
  }) => {
    if (!session) return;

    try {
      const data = await apiClient.updateSessionMetadata(session.id, metadata);
      setSession(data);
    } catch (err) {
      console.error('Update metadata error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update metadata');
    }
  }, [session]);

  return { session, loading, error, updateStep, updateMetadata };
};
