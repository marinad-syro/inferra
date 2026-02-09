-- Create workflow sessions table
CREATE TABLE public.workflow_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  current_step INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uploaded files table
CREATE TABLE public.uploaded_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT,
  row_count INTEGER,
  column_names TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parsed events table (trial structure config)
CREATE TABLE public.trial_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  trial_onset_event TEXT NOT NULL DEFAULT 'ons_ms1',
  response_event TEXT NOT NULL DEFAULT 'response',
  outcome_event TEXT NOT NULL DEFAULT 'feedback',
  trials_detected INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create derived variables table
CREATE TABLE public.derived_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formula TEXT NOT NULL,
  formula_type TEXT DEFAULT 'eval' CHECK (formula_type IN ('eval', 'transform', 'python')),
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create analysis selections table
CREATE TABLE public.analysis_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public access for prototype)
ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derived_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_selections ENABLE ROW LEVEL SECURITY;

-- Create public access policies (no auth for prototype)
CREATE POLICY "Public access for workflow sessions" ON public.workflow_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for uploaded files" ON public.uploaded_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for trial structures" ON public.trial_structures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for derived variables" ON public.derived_variables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for analysis selections" ON public.analysis_selections FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for uploaded data files
INSERT INTO storage.buckets (id, name, public) VALUES ('data-uploads', 'data-uploads', true);

-- Storage policies
CREATE POLICY "Public upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'data-uploads');
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'data-uploads');
CREATE POLICY "Public delete access" ON storage.objects FOR DELETE USING (bucket_id = 'data-uploads');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_workflow_sessions_updated_at
  BEFORE UPDATE ON public.workflow_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_structures_updated_at
  BEFORE UPDATE ON public.trial_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Add research metadata columns to workflow_sessions
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
ADD COLUMN reasoning text;-- Create table for storing wrangling configurations
CREATE TABLE public.wrangling_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
  
  -- Structure & Join configs
  datasets JSONB DEFAULT '[]'::jsonb,
  join_keys JSONB DEFAULT '[]'::jsonb,
  join_warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Missing & Invalid Data configs
  missing_data_strategy JSONB DEFAULT '{}'::jsonb,
  critical_variables TEXT[] DEFAULT '{}',
  optional_variables TEXT[] DEFAULT '{}',
  
  -- Normalization & Recoding configs
  transformations JSONB DEFAULT '[]'::jsonb,
  
  -- Consistency Checks results
  consistency_checks JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wrangling_configs ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching other tables)
CREATE POLICY "Public access for wrangling configs"
  ON public.wrangling_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_wrangling_configs_updated_at
  BEFORE UPDATE ON public.wrangling_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add columns to store selected variables for each analysis
ALTER TABLE public.analysis_selections
ADD COLUMN selected_columns text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_selections.selected_columns IS 'Array of column names selected for this analysis';