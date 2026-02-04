-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create fichas" ON public.fichas;

-- Create a permissive policy for public inserts
CREATE POLICY "Anyone can create fichas" 
ON public.fichas 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);