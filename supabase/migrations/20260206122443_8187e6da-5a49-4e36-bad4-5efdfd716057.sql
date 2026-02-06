-- Add archived column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for faster filtering
CREATE INDEX idx_conversations_archived ON public.conversations (archived);