-- Create storage bucket for inbox media files (images and PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inbox-media', 'inbox-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow team members to upload files
CREATE POLICY "Team can upload inbox media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inbox-media' 
  AND is_team_member(auth.uid())
);

-- Allow team members to view/download files
CREATE POLICY "Team can view inbox media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inbox-media');

-- Allow team members to delete their uploads
CREATE POLICY "Team can delete inbox media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inbox-media' 
  AND is_team_member(auth.uid())
);