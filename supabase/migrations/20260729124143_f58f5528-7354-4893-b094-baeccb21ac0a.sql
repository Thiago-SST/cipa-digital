DROP POLICY IF EXISTS "challenges_read_all" ON public.candidate_challenges;
CREATE POLICY "challenges_admin_read" ON public.candidate_challenges
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.candidate_challenges FROM anon;

DROP POLICY IF EXISTS "commission_read_all" ON public.election_commission_members;
CREATE POLICY "commission_admin_read" ON public.election_commission_members
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.election_commission_members FROM anon;

DROP POLICY IF EXISTS "notices_read_all" ON public.election_notices;
CREATE POLICY "notices_read_authenticated" ON public.election_notices
  FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.election_notices FROM anon;