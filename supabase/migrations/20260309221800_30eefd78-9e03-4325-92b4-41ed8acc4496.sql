
CREATE TABLE public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  delay_ms integer,
  error_message text,
  message_preview text,
  metadata jsonb
);

-- Index for rate monitoring queries
CREATE INDEX idx_whatsapp_send_log_created_at ON public.whatsapp_send_log (created_at DESC);
CREATE INDEX idx_whatsapp_send_log_status ON public.whatsapp_send_log (status);

-- Enable RLS
ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

-- Team can view logs
CREATE POLICY "Team can view send logs"
  ON public.whatsapp_send_log
  FOR SELECT
  TO authenticated
  USING (is_team_member(auth.uid()));

-- Service role inserts (from edge functions)
CREATE POLICY "Service can insert send logs"
  ON public.whatsapp_send_log
  FOR INSERT
  TO public
  WITH CHECK (true);
