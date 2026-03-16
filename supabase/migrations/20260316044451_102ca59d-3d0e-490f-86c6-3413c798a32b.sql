UPDATE site_settings SET value = jsonb_set(
  COALESCE(value::jsonb, '{}'::jsonb),
  '{platform}',
  '[
    {"label":"Para Doctores","href":"/for-doctors"},
    {"label":"Para Residentes","href":"/for-residents"},
    {"label":"Para Pacientes","href":"/for-patients"},
    {"label":"Empresas","href":"/enterprise"}
  ]'::jsonb
) WHERE id = 'footer_links';