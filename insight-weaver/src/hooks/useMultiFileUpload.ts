import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';

export interface UploadedDataset {
  id: string;
  session_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string | null;
  row_count: number | null;
  column_names: string[] | null;
  created_at: string;
}

export interface ParsedDataset {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface DatasetWithData {
  file: UploadedDataset;
  parsedData: ParsedDataset | null;
}

export const useMultiFileUpload = (sessionId: string | undefined) => {
  const [datasets, setDatasets] = useState<DatasetWithData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);

  // Upload a new file
  const uploadFile = useCallback(async (file: File) => {
    if (!sessionId) {
      setError('No session available');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await apiClient.uploadFile(sessionId, file);

      const newDataset: DatasetWithData = {
        file: response.file,
        parsedData: response.parsed_data,
      };

      setDatasets(prev => [...prev, newDataset]);
      setActiveDatasetId(response.file.id);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [sessionId]);

  // Remove a dataset
  const removeDataset = useCallback(async (datasetId: string) => {
    try {
      await apiClient.deleteFile(datasetId);
      setDatasets(prev => prev.filter(d => d.file.id !== datasetId));

      // Update active dataset if needed
      if (activeDatasetId === datasetId) {
        const remaining = datasets.filter(d => d.file.id !== datasetId);
        setActiveDatasetId(remaining.length > 0 ? remaining[0].file.id : null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete dataset');
    }
  }, [datasets, activeDatasetId]);

  // Fetch existing uploaded files for session
  const fetchUploadedFiles = useCallback(async () => {
    if (!sessionId) return;

    try {
      const files = await apiClient.getFiles(sessionId);

      // Fetch parsed data for each file
      const datasetsWithData: DatasetWithData[] = await Promise.all(
        files.map(async (file) => {
          try {
            const parsedData = await apiClient.getFileData(file.id);
            return { file, parsedData };
          } catch (err) {
            console.error(`Failed to fetch parsed data for file ${file.id}:`, err);
            return { file, parsedData: null };
          }
        })
      );

      setDatasets(datasetsWithData);
      if (!activeDatasetId && datasetsWithData.length > 0) {
        setActiveDatasetId(datasetsWithData[0].file.id);
      }
    } catch (err) {
      console.error('Fetch files error:', err);
    }
  }, [sessionId, activeDatasetId]);

  // Fetch on mount
  useEffect(() => {
    if (sessionId) {
      fetchUploadedFiles();
    }
  }, [sessionId, fetchUploadedFiles]);

  // Get active dataset
  const activeDataset = datasets.find(d => d.file.id === activeDatasetId) || null;

  // Combined parsed data from all datasets (for wrangling compatibility)
  const combinedParsedData = datasets.length > 0 && activeDataset?.parsedData
    ? activeDataset.parsedData
    : null;

  // Get all columns across all datasets
  const allColumns = datasets.reduce<string[]>((acc, d) => {
    if (d.parsedData) {
      d.parsedData.columns.forEach(col => {
        if (!acc.includes(col)) acc.push(col);
      });
    }
    return acc;
  }, []);

  return {
    datasets,
    activeDataset,
    activeDatasetId,
    setActiveDatasetId,
    uploading,
    error,
    uploadFile,
    removeDataset,
    fetchUploadedFiles,
    // Legacy compatibility
    uploadedFile: activeDataset?.file || null,
    parsedData: combinedParsedData,
    allColumns,
  };
};
