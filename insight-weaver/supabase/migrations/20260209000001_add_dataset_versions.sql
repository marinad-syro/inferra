-- Dataset Versioning System
-- Every operation (UI or code) creates a new dataset version
-- Sessions point to their current version

-- Create dataset versions table
CREATE TABLE IF NOT EXISTS public.dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  parent_version_id uuid REFERENCES public.dataset_versions(id),
  source text NOT NULL, -- 'upload' | 'ui_cleaning' | 'ui_transform' | 'code_canvas' | 'ui_analysis'
  description text, -- Human-readable: "Applied label standardization", "Custom code: outlier removal"
  dataset_reference text NOT NULL, -- File path to stored dataset
  row_count integer,
  column_count integer,
  column_names text[],
  created_at timestamptz DEFAULT now(),
  code_snapshot text, -- Full Python/R code that generated this version (if from code canvas)
  operation_metadata jsonb, -- Store details: { cleaning_config, transform_formulas, etc }
  UNIQUE(session_id, version_number)
);

-- Add indexes for performance
CREATE INDEX idx_dataset_versions_session ON public.dataset_versions(session_id);
CREATE INDEX idx_dataset_versions_parent ON public.dataset_versions(parent_version_id);
CREATE INDEX idx_dataset_versions_created ON public.dataset_versions(created_at DESC);

-- Add current version pointer to sessions
ALTER TABLE public.workflow_sessions
ADD COLUMN IF NOT EXISTS current_dataset_version_id uuid REFERENCES public.dataset_versions(id);

-- Add index for faster lookups
CREATE INDEX idx_sessions_current_version ON public.workflow_sessions(current_dataset_version_id);

-- Add dataset_reference to sessions for backward compatibility during migration
ALTER TABLE public.workflow_sessions
ADD COLUMN IF NOT EXISTS dataset_reference text;

-- Comments for documentation
COMMENT ON TABLE public.dataset_versions IS 'Tracks all versions of datasets as they are transformed through UI operations and code execution';
COMMENT ON COLUMN public.dataset_versions.version_number IS 'Sequential version number starting from 0 (original upload)';
COMMENT ON COLUMN public.dataset_versions.source IS 'What created this version: upload, ui_cleaning, ui_transform, code_canvas, ui_analysis';
COMMENT ON COLUMN public.dataset_versions.dataset_reference IS 'File path or S3 key where this version is stored';
COMMENT ON COLUMN public.dataset_versions.code_snapshot IS 'If created from code canvas, the full code that generated this version';
