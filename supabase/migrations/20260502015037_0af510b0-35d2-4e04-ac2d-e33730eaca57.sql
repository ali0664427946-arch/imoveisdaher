-- Create evolution audit logs table
CREATE TABLE IF NOT EXISTS public.evolution_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    instance_name TEXT,
    payload JSONB,
    status TEXT, -- 'success', 'invalid_token', 'invalid_signature'
    error_message TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can view logs
CREATE POLICY "Admins can view audit logs"
ON public.evolution_audit_logs
FOR SELECT
USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE email IN (SELECT email FROM public.profiles WHERE role = 'admin')
));

-- Function can insert logs
-- (Assuming service role will be used for inserts from edge functions)
