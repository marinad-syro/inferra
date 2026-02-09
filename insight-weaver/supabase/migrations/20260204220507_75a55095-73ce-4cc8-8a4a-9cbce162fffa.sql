-- Create table for storing wrangling configurations
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
  EXECUTE FUNCTION public.update_updated_at_column();