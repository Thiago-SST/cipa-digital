
-- VOTES: suportar branco/nulo
ALTER TABLE public.votes ALTER COLUMN candidate_id DROP NOT NULL;
DO $$ BEGIN
  CREATE TYPE public.vote_type AS ENUM ('nominal', 'branco', 'nulo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS tipo public.vote_type NOT NULL DEFAULT 'nominal';
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_tipo_candidate_check;
ALTER TABLE public.votes ADD CONSTRAINT votes_tipo_candidate_check
  CHECK ((tipo = 'nominal' AND candidate_id IS NOT NULL) OR (tipo <> 'nominal' AND candidate_id IS NULL));

-- CANDIDATES: origem e unicidade por eleição
DO $$ BEGIN
  CREATE TYPE public.candidate_origem AS ENUM ('admin', 'auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS origem public.candidate_origem NOT NULL DEFAULT 'admin';
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_election_employee_unique;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_election_employee_unique UNIQUE (election_id, employee_id);

-- ORGANIZATION_SETTINGS
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  nome text NOT NULL DEFAULT 'Minha Organização',
  cnpj text,
  endereco text,
  mandato_inicio date,
  mandato_fim date,
  texto_edital text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.organization_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads org settings" ON public.organization_settings;
CREATE POLICY "Anyone reads org settings" ON public.organization_settings FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Admins manage org settings" ON public.organization_settings;
CREATE POLICY "Admins manage org settings" ON public.organization_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.organization_settings (singleton, nome)
  VALUES (true, 'Minha Organização')
  ON CONFLICT (singleton) DO NOTHING;

-- ELECTION_DOCUMENTS: colunas para arquivo
ALTER TABLE public.election_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.election_documents ADD COLUMN IF NOT EXISTS file_name text;
