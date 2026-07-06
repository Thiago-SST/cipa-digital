
-- Extend election_status enum
ALTER TYPE public.election_status ADD VALUE IF NOT EXISTS 'published' BEFORE 'registration';
ALTER TYPE public.election_status ADD VALUE IF NOT EXISTS 'homologation' AFTER 'registration';
ALTER TYPE public.election_status ADD VALUE IF NOT EXISTS 'counting' AFTER 'voting';
ALTER TYPE public.election_status ADD VALUE IF NOT EXISTS 'result_homologation' AFTER 'counting';
ALTER TYPE public.election_status ADD VALUE IF NOT EXISTS 'concluded' AFTER 'result_homologation';

-- Milestones on elections
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS data_publicacao_edital timestamptz,
  ADD COLUMN IF NOT EXISTS data_homologacao_inscricoes timestamptz,
  ADD COLUMN IF NOT EXISTS data_homologacao_resultado timestamptz,
  ADD COLUMN IF NOT EXISTS data_posse date,
  ADD COLUMN IF NOT EXISTS mandato_inicio date,
  ADD COLUMN IF NOT EXISTS mandato_fim date,
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

-- Commission members
CREATE TABLE IF NOT EXISTS public.election_commission_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  nome text NOT NULL,
  matricula text,
  papel text NOT NULL CHECK (papel IN ('presidente','secretario','membro')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.election_commission_members TO authenticated;
GRANT ALL ON public.election_commission_members TO service_role;
GRANT SELECT ON public.election_commission_members TO anon;
ALTER TABLE public.election_commission_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_read_all" ON public.election_commission_members FOR SELECT USING (true);
CREATE POLICY "commission_admin_write" ON public.election_commission_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Candidate challenges (impugnações)
CREATE TABLE IF NOT EXISTS public.candidate_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  autor_matricula text NOT NULL,
  autor_nome text NOT NULL,
  motivo text NOT NULL,
  decisao text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente','deferido','indeferido')),
  justificativa text,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_challenges TO authenticated;
GRANT ALL ON public.candidate_challenges TO service_role;
GRANT SELECT, INSERT ON public.candidate_challenges TO anon;
ALTER TABLE public.candidate_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_read_all" ON public.candidate_challenges FOR SELECT USING (true);
CREATE POLICY "challenges_anyone_insert" ON public.candidate_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "challenges_admin_update" ON public.candidate_challenges
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "challenges_admin_delete" ON public.candidate_challenges
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Official notices to voters
CREATE TABLE IF NOT EXISTS public.election_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('edital','homologacao_inscricoes','abertura_votacao','encerramento_votacao','resultado','homologacao_resultado','posse','geral')),
  titulo text NOT NULL,
  corpo text NOT NULL,
  publicado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.election_notices TO authenticated;
GRANT ALL ON public.election_notices TO service_role;
GRANT SELECT ON public.election_notices TO anon;
ALTER TABLE public.election_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notices_read_all" ON public.election_notices FOR SELECT USING (true);
CREATE POLICY "notices_admin_write" ON public.election_notices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_commission_election ON public.election_commission_members(election_id);
CREATE INDEX IF NOT EXISTS idx_challenges_election ON public.candidate_challenges(election_id);
CREATE INDEX IF NOT EXISTS idx_challenges_candidate ON public.candidate_challenges(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notices_election ON public.election_notices(election_id, publicado_em DESC);
