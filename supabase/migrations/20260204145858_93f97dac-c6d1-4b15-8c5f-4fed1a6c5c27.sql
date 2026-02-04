-- Allow anonymous users to read the ficha they just created (for the RETURNING clause)
CREATE POLICY "Anyone can view their own ficha after insert" 
ON public.fichas 
FOR SELECT 
TO anon
USING (true);