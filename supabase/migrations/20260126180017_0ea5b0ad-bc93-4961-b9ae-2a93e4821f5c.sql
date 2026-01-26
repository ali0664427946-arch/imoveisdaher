-- Add unique constraint for property sync (upsert by origin and origin_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_origin_origin_id 
ON public.properties (origin, origin_id) 
WHERE origin_id IS NOT NULL;

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;