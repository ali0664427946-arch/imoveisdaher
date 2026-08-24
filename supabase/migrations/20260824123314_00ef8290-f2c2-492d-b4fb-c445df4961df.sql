UPDATE public.fichas
SET form_data = jsonb_set(
  coalesce(form_data, '{}'::jsonb),
  '{additional_tenants}',
  coalesce((
    SELECT jsonb_agg(t)
    FROM jsonb_array_elements(coalesce(form_data->'additional_tenants', '[]'::jsonb)) AS t
    WHERE t->>'full_name' <> 'TESTE DIAGNOSTICO'
  ), '[]'::jsonb)
)
WHERE protocol = 'DH-20260824-4401';