-- Add research metadata columns to workflow_sessions
ALTER TABLE public.workflow_sessions 
ADD COLUMN research_question text,
ADD COLUMN distribution_type text,
ADD COLUMN has_outliers boolean,
ADD COLUMN outlier_notes text;

-- Add dynamic analysis info columns to analysis_selections
ALTER TABLE public.analysis_selections
ADD COLUMN title text,
ADD COLUMN description text,
ADD COLUMN complexity text,
ADD COLUMN reasoning text;