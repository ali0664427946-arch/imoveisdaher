-- Remove default first
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- Alter the column to text to allow any value
ALTER TABLE public.leads ALTER COLUMN status TYPE text;

-- Drop enums
DROP TYPE IF EXISTS public.lead_status_new;
DROP TYPE IF EXISTS public.lead_status;

-- Create new enum with desired values
CREATE TYPE public.lead_status AS ENUM (
  'entrou_em_contato',
  'visita_agendada',
  'aguardando_imovel',
  'aguardando_retorno',
  'fechado'
);

-- Update existing leads to new status values
UPDATE public.leads SET status = 'entrou_em_contato' WHERE status IN ('novo', 'nao_atendeu');
UPDATE public.leads SET status = 'visita_agendada' WHERE status = 'reuniao_marcada';
UPDATE public.leads SET status = 'aguardando_retorno' WHERE status IN ('retornar', 'nao_quis_reuniao');

-- Set any remaining unmapped statuses to default
UPDATE public.leads SET status = 'entrou_em_contato' WHERE status NOT IN ('entrou_em_contato', 'visita_agendada', 'aguardando_imovel', 'aguardando_retorno', 'fechado');

-- Set the column back to enum type with default
ALTER TABLE public.leads 
  ALTER COLUMN status TYPE public.lead_status USING status::public.lead_status,
  ALTER COLUMN status SET DEFAULT 'entrou_em_contato'::public.lead_status;