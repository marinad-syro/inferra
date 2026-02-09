import { useState, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

export interface UploadedFile {
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

interface ParsedData {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export const useFileUpload = (sessionId: string | undefined) => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload and parse file
  const uploadFile = useCallback(async (file: File) => {
    if (!sessionId) {
      setError('No session available');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload via API
      const response = await apiClient.uploadFile(sessionId, file);

      setUploadedFile(response.file);
      setParsedData(response.parsed_data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [sessionId]);

  // Fetch existing uploaded file for session
  const fetchUploadedFile = useCallback(async () => {
    if (!sessionId) return;

    try {
      const file = await apiClient.getLatestFile(sessionId);
      setUploadedFile(file);

      // Fetch parsed data if file exists
      if (file && file.id) {
        try {
          const parsed = await apiClient.getFileData(file.id);
          setParsedData(parsed);
        } catch (parseErr) {
          console.error('Failed to fetch parsed data:', parseErr);
          // Continue even if parsing fails - at least we have the file metadata
        }
      }
    } catch (err) {
      console.error('Fetch file error:', err);
    }
  }, [sessionId]);

  return {
    uploadedFile,
    parsedData,
    uploading,
    error,
    uploadFile,
    fetchUploadedFile
  };
};
