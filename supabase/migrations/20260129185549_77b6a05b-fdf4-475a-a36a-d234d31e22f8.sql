-- Add YouTube video URL column to properties table
ALTER TABLE public.properties 
ADD COLUMN youtube_url text DEFAULT NULL;