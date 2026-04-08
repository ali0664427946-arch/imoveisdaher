ALTER TABLE public.properties 
ADD COLUMN publication_type text NOT NULL DEFAULT 'STANDARD';

-- Migrate existing featured properties
UPDATE public.properties SET publication_type = 'PREMIUM' WHERE featured = true;