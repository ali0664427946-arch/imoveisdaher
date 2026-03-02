CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON public.property_photos USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_properties_status_created ON public.properties USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_lead ON public.conversations USING btree (last_message_at DESC NULLS LAST, lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction_created ON public.messages USING btree (direction, created_at DESC);