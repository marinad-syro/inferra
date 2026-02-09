-- Add cleaning configuration fields to wrangling_configs table
-- These fields store user's choices for how to handle data quality issues

-- Add label standardization (for case-inconsistent categorical values)
ALTER TABLE public.wrangling_configs
ADD COLUMN IF NOT EXISTS label_standardization jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.wrangling_configs.label_standardization IS
'Map of column names to value mappings for standardizing inconsistent labels.
Example: {"condition": {"control": "Control", "CONTROL": "Control"}}';

-- Add duplicate handling strategy
ALTER TABLE public.wrangling_configs
ADD COLUMN IF NOT EXISTS duplicate_handling text DEFAULT 'keep_all';

COMMENT ON COLUMN public.wrangling_configs.duplicate_handling IS
'Strategy for handling duplicate rows: keep_all, keep_first, keep_last, or drop_all';

-- Add invalid value handling
ALTER TABLE public.wrangling_configs
ADD COLUMN IF NOT EXISTS invalid_value_handling jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.wrangling_configs.invalid_value_handling IS
'Map of column names to actions for handling invalid values (e.g., negative reaction times).
Example: {"reaction_time": "drop", "age": "replace_nan"}';

-- Add duplicate ID column (which column to check for duplicates)
ALTER TABLE public.wrangling_configs
ADD COLUMN IF NOT EXISTS duplicate_id_column text;

COMMENT ON COLUMN public.wrangling_configs.duplicate_id_column IS
'Column name to check for duplicate IDs (e.g., "subject_id", "participant_id")';
