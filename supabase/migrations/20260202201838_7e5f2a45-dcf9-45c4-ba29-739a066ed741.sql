-- Create scheduled_messages table for WhatsApp message scheduling
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ficha_id UUID REFERENCES public.fichas(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Team members can view all scheduled messages
CREATE POLICY "Team can view scheduled messages"
ON public.scheduled_messages
FOR SELECT
USING (is_team_member(auth.uid()));

-- Team members can create scheduled messages
CREATE POLICY "Team can create scheduled messages"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (is_team_member(auth.uid()) AND created_by = auth.uid());

-- Team members can update scheduled messages (cancel, etc)
CREATE POLICY "Team can update scheduled messages"
ON public.scheduled_messages
FOR UPDATE
USING (is_team_member(auth.uid()));

-- Team members can delete scheduled messages
CREATE POLICY "Team can delete scheduled messages"
ON public.scheduled_messages
FOR DELETE
USING (is_team_member(auth.uid()));

-- Create index for efficient querying of pending messages
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_at) 
WHERE status = 'pending';

-- Create index for lead/ficha lookups
CREATE INDEX idx_scheduled_messages_lead ON public.scheduled_messages(lead_id);
CREATE INDEX idx_scheduled_messages_ficha ON public.scheduled_messages(ficha_id);