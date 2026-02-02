-- Add unique constraint for origin + origin_id to enable upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_origin_origin_id 
ON public.properties(origin, origin_id) 
WHERE origin_id IS NOT NULL;

-- Add unique constraint for property_photos to prevent duplicate photos
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_photos_property_url 
ON public.property_photos(property_id, url);