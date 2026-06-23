
-- ENUMS
CREATE TYPE public.election_status AS ENUM ('draft','registration','voting','closed');
CREATE TYPE public.candidate_status AS ENUM ('pending','approved','rejected');

-- ELECTIONS
CREATE TABLE public.elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  data_inicio_inscricao timestamptz,
  data_fim_inscricao timestamptz,
  data_inicio_votacao timestamptz,
  data_fim_votacao timestamptz,
  vagas_titulares int NOT NULL DEFAULT 3,
  vagas_suplentes int NOT NULL DEFAULT 3,
  status public.election_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.elections TO service_role;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES (aptos a votar)
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  matricula text NOT NULL UNIQUE,
  cpf text UNIQUE,
  setor text,
  cargo text,
  email text,
  data_nascimento date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- CANDIDATES
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  nome text NOT NULL,
  matricula text NOT NULL,
  setor text,
  cargo text,
  foto_url text,
  proposta text,
  numero int,
  status public.candidate_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_candidates_election ON public.candidates(election_id);

-- VOTES (anônimos: apenas referência ao candidato e momento)
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_votes_election ON public.votes(election_id);
CREATE INDEX idx_votes_candidate ON public.votes(candidate_id);

-- VOTE TOKENS (controla quem votou, sem ligar ao voto em si)
CREATE TABLE public.vote_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, employee_id)
);
GRANT ALL ON public.vote_tokens TO service_role;
ALTER TABLE public.vote_tokens ENABLE ROW LEVEL SECURITY;

-- ACCESS LOGS
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator text,
  acao text NOT NULL,
  detalhes jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.access_logs TO service_role;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- SEED: eleição ativa de exemplo
INSERT INTO public.elections (id, nome, descricao, data_inicio_votacao, data_fim_votacao, vagas_titulares, vagas_suplentes, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Eleição CIPA 2026/2027',
  'Eleição dos representantes dos empregados na Comissão Interna de Prevenção de Acidentes e de Assédio (gestão 2026/2027).',
  now() - interval '1 day',
  now() + interval '7 days',
  3,
  3,
  'voting'
);

-- SEED: empregados de exemplo
INSERT INTO public.employees (nome, matricula, cpf, setor, cargo, data_nascimento) VALUES
('Ana Souza',         '1001', '11111111111', 'Administrativo', 'Analista',        '1990-05-12'),
('Bruno Lima',        '1002', '22222222222', 'Operações',      'Operador',        '1985-03-22'),
('Carla Mendes',      '1003', '33333333333', 'TI',             'Desenvolvedora',  '1992-11-30'),
('Diego Ferreira',    '1004', '44444444444', 'Manutenção',     'Técnico',         '1988-07-08'),
('Eduarda Ribeiro',   '1005', '55555555555', 'RH',             'Analista de RH',  '1995-01-25');

-- SEED: candidatos aprovados
INSERT INTO public.candidates (election_id, nome, matricula, setor, cargo, proposta, numero, status) VALUES
('00000000-0000-0000-0000-000000000001','Ana Souza',      '1001','Administrativo','Analista',       'Reforçar a cultura de segurança com treinamentos mensais e canais abertos de denúncia.', 10,'approved'),
('00000000-0000-0000-0000-000000000001','Bruno Lima',     '1002','Operações',     'Operador',       'Mapear riscos por setor e implantar inspeções participativas semanais.',                 20,'approved'),
('00000000-0000-0000-0000-000000000001','Carla Mendes',   '1003','TI',            'Desenvolvedora','Digitalizar checklists de segurança e criar painel de indicadores de incidentes.',        30,'approved'),
('00000000-0000-0000-0000-000000000001','Diego Ferreira', '1004','Manutenção',    'Técnico',       'Padronizar EPIs por função e revisar procedimentos de bloqueio e sinalização.',          40,'approved');
