ALTER TABLE public.properties ADD COLUMN features jsonb DEFAULT '{}';

COMMENT ON COLUMN public.properties.features IS 'Property and condo features/amenities as key-value booleans matching OLX format';