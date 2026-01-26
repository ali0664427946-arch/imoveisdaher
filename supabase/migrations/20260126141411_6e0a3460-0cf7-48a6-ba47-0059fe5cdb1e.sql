-- Create storage bucket for ficha documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ficha-documents',
  'ficha-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage policies for ficha documents
CREATE POLICY "Anyone can upload ficha documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ficha-documents');

CREATE POLICY "Team can view ficha documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ficha-documents' 
  AND is_team_member(auth.uid())
);

CREATE POLICY "Team can delete ficha documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ficha-documents' 
  AND is_team_member(auth.uid())
);

-- Add ai_analyses array to track history
ALTER TABLE public.fichas
ADD COLUMN IF NOT EXISTS ai_analyses jsonb[] DEFAULT ARRAY[]::jsonb[];