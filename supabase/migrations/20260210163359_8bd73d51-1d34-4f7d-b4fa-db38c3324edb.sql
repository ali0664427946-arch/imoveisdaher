
-- Create storage bucket for archived messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('archived-messages', 'archived-messages', false)
ON CONFLICT (id) DO NOTHING;

-- Only team members can read archived messages
CREATE POLICY "Team can read archived messages"
ON storage.objects FOR SELECT
USING (bucket_id = 'archived-messages' AND public.is_team_member(auth.uid()));

-- Service role (edge functions) can insert/delete
CREATE POLICY "Service can manage archived messages"
ON storage.objects FOR ALL
USING (bucket_id = 'archived-messages')
WITH CHECK (bucket_id = 'archived-messages');
