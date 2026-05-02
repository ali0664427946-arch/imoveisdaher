UPDATE public.integrations_settings
SET value = jsonb_set(value, '{base_url}', '"https://api.agencialapiscriativo.com.br"'::jsonb),
    updated_at = now()
WHERE key = 'evolution_api'
  AND value->>'base_url' LIKE '%/manager%';