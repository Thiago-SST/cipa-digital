ALTER TABLE public.votes REPLICA IDENTITY FULL;
ALTER TABLE public.vote_tokens REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vote_tokens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_tokens;
  END IF;
END $$;