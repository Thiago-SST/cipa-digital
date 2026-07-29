DROP POLICY IF EXISTS "challenges_anyone_insert" ON public.candidate_challenges;
REVOKE INSERT, UPDATE, DELETE ON public.candidate_challenges FROM anon;