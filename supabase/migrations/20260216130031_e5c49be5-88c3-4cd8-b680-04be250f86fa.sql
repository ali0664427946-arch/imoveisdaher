CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_origin_origin_id 
ON public.properties (origin, origin_id) 
WHERE origin_id IS NOT NULL;