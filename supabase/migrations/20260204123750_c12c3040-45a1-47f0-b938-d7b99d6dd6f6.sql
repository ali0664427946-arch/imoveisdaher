-- Add group_name column to conversations table to store WhatsApp group names
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT NULL;

-- Add is_group column to easily identify group conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;