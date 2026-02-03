-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can create fichas" ON public.fichas;

-- Create a new permissive INSERT policy that allows anyone (including anonymous) to create fichas
CREATE POLICY "Anyone can create fichas"
ON public.fichas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);