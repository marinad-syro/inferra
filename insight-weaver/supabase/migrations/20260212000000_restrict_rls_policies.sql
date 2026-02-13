-- Replace open public policies with restrictive ones.
--
-- The frontend never queries Supabase directly — all database access goes
-- through the FastAPI backend which uses the SERVICE_ROLE_KEY and bypasses
-- RLS. Removing the public policies prevents anyone with the anon key from
-- reading or writing arbitrary data via the Supabase REST API.

-- Drop existing open policies on all tables
DROP POLICY IF EXISTS "Public access for workflow sessions" ON public.workflow_sessions;
DROP POLICY IF EXISTS "Public access for uploaded files" ON public.uploaded_files;
DROP POLICY IF EXISTS "Public access for trial structures" ON public.trial_structures;
DROP POLICY IF EXISTS "Public access for derived variables" ON public.derived_variables;
DROP POLICY IF EXISTS "Public access for analysis selections" ON public.analysis_selections;
DROP POLICY IF EXISTS "Public access for wrangling configs" ON public.wrangling_configs;
DROP POLICY IF EXISTS "Public access for dataset versions" ON public.dataset_versions;

-- No replacement policies needed — RLS is still enabled on all tables, so
-- the anon key has zero access. The service role key (backend only) bypasses
-- RLS and retains full access.

-- Make the storage bucket private (was public: true)
UPDATE storage.buckets SET public = false WHERE id = 'data-uploads';

-- Drop open storage policies
DROP POLICY IF EXISTS "Public upload access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access" ON storage.objects;

-- No replacement storage policies needed — the backend uses the service role
-- key for all storage operations (upload, read, delete), which bypasses RLS.
