-- Trigger function to enforce guarantee_type on insert/update
CREATE OR REPLACE FUNCTION public.validate_ficha_guarantee_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- On INSERT: guarantee_type is mandatory
  IF TG_OP = 'INSERT' THEN
    IF NEW.guarantee_type IS NULL OR NEW.guarantee_type NOT IN ('deposito', 'fiador', 'seguro_fianca') THEN
      RAISE EXCEPTION 'Forma de garantia é obrigatória. Selecione: deposito, fiador ou seguro_fianca.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- On UPDATE: cannot clear guarantee_type if it was previously set
  IF TG_OP = 'UPDATE' THEN
    IF OLD.guarantee_type IS NOT NULL AND (NEW.guarantee_type IS NULL OR NEW.guarantee_type NOT IN ('deposito', 'fiador', 'seguro_fianca')) THEN
      RAISE EXCEPTION 'Forma de garantia não pode ser removida ou inválida.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ficha_guarantee_type ON public.fichas;

CREATE TRIGGER enforce_ficha_guarantee_type
BEFORE INSERT OR UPDATE ON public.fichas
FOR EACH ROW
EXECUTE FUNCTION public.validate_ficha_guarantee_type();