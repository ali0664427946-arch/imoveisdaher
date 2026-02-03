-- Create contacts table for managing WhatsApp contacts separately from leads
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT,
  email TEXT,
  tags TEXT[] DEFAULT '{}',
  origin TEXT DEFAULT 'whatsapp_import',
  last_contact_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  -- Ensure phone is unique to avoid duplicates
  CONSTRAINT contacts_phone_unique UNIQUE (phone_normalized)
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for team access
CREATE POLICY "Team can view contacts" 
ON public.contacts 
FOR SELECT 
USING (is_team_member(auth.uid()));

CREATE POLICY "Team can create contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (is_team_member(auth.uid()));

CREATE POLICY "Team can update contacts" 
ON public.contacts 
FOR UPDATE 
USING (is_team_member(auth.uid()));

CREATE POLICY "Team can delete contacts" 
ON public.contacts 
FOR DELETE 
USING (is_team_member(auth.uid()));

-- Create index for faster searches
CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_phone_normalized ON public.contacts(phone_normalized);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);
CREATE INDEX idx_contacts_origin ON public.contacts(origin);
CREATE INDEX idx_contacts_last_contact ON public.contacts(last_contact_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();