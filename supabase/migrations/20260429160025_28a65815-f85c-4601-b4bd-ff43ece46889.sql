ALTER TABLE public.fichas 
ADD COLUMN guarantee_type TEXT CHECK (guarantee_type IN ('deposito', 'fiador', 'seguro_fianca'));

COMMENT ON COLUMN public.fichas.guarantee_type IS 'Tipo de garantia selecionada pelo locatário: deposito, fiador ou seguro_fianca';