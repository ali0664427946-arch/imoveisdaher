-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to property photos
CREATE POLICY "Public can view property photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-photos');

-- Allow team members to upload property photos
CREATE POLICY "Team can upload property photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-photos' 
  AND is_team_member(auth.uid())
);

-- Allow team members to update property photos
CREATE POLICY "Team can update property photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-photos' 
  AND is_team_member(auth.uid())
);

-- Allow team members to delete property photos
CREATE POLICY "Team can delete property photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-photos' 
  AND is_team_member(auth.uid())
);