-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Enable realtime for fichas table
ALTER PUBLICATION supabase_realtime ADD TABLE public.fichas;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;