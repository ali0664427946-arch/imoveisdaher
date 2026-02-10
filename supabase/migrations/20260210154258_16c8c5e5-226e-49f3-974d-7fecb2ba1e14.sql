-- Add missing indexes to improve webhook and inbox performance

-- Index for conversations ordering (used in Inbox list)
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
ON public.conversations (last_message_at DESC NULLS LAST);

-- Index for group conversation lookup by external_thread_id
CREATE INDEX IF NOT EXISTS idx_conversations_external_thread_id 
ON public.conversations (external_thread_id) 
WHERE external_thread_id IS NOT NULL;

-- Index for conversations channel+external_thread_id (webhook group lookup)
CREATE INDEX IF NOT EXISTS idx_conversations_channel_thread 
ON public.conversations (channel, external_thread_id);

-- Index for lead phone lookups (webhook uses exact match on multiple formats)
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized ON public.leads (phone_normalized);

-- Index for messages direction+provider (used in LastMessagesCards)
CREATE INDEX IF NOT EXISTS idx_messages_direction_provider 
ON public.messages (direction, provider, created_at DESC);

-- Analyze tables to update statistics
ANALYZE public.conversations;
ANALYZE public.messages;
ANALYZE public.leads;