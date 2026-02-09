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
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();