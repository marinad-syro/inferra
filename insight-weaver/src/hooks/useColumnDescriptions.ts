import { useState, useEffect, useCallback } from 'react';

/**
 * Persists per-column user descriptions in localStorage, keyed by session ID.
 * These are passed to all LLM calls so the model understands oddly-named columns.
 */
export type ColumnDescriptions = Record<string, string>;

const storageKey = (sessionId: string) => `column_descriptions:${sessionId}`;

export const useColumnDescriptions = (
  sessionId: string | undefined,
  columns: string[]
) => {
  const [descriptions, setDescriptions] = useState<ColumnDescriptions>({});

  // Load from localStorage when session or columns change
  useEffect(() => {
    if (!sessionId) return;

    const stored = localStorage.getItem(storageKey(sessionId));
    if (stored) {
      try {
        setDescriptions(JSON.parse(stored));
      } catch {
        setDescriptions({});
      }
    } else {
      setDescriptions({});
    }
  }, [sessionId]);

  const updateDescription = useCallback(
    (column: string, description: string) => {
      if (!sessionId) return;

      setDescriptions(prev => {
        const next = { ...prev, [column]: description };
        localStorage.setItem(storageKey(sessionId), JSON.stringify(next));
        return next;
      });
    },
    [sessionId]
  );

  // Return only descriptions for columns that still exist in the dataset
  const activeDescriptions = columns.reduce<ColumnDescriptions>((acc, col) => {
    if (descriptions[col]) acc[col] = descriptions[col];
    return acc;
  }, {});

  return { descriptions: activeDescriptions, updateDescription };
};
