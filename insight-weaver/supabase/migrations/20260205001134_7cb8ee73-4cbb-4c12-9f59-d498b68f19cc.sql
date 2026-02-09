-- Add columns to store selected variables for each analysis
ALTER TABLE public.analysis_selections
ADD COLUMN selected_columns text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_selections.selected_columns IS 'Array of column names selected for this analysis';