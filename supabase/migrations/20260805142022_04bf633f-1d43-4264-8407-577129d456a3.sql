CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador text NOT NULL,
  ip text,
  sucesso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.login_attempts TO service_role;
GRANT SELECT ON public.login_attempts TO authenticated;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read login attempts"
  ON public.login_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_login_attempts_identificador ON public.login_attempts (identificador, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts (ip, created_at DESC);