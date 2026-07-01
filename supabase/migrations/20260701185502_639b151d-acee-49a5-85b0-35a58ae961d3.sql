
DROP POLICY IF EXISTS "Admins manage election docs storage" ON storage.objects;
CREATE POLICY "Admins manage election docs storage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'election-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'election-documents' AND public.has_role(auth.uid(), 'admin'));
