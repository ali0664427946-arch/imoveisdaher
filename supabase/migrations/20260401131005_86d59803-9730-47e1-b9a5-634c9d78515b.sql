CREATE POLICY "Anon can view documents via ficha protocol"
ON public.documents
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.fichas
    WHERE fichas.id = documents.ficha_id
  )
);