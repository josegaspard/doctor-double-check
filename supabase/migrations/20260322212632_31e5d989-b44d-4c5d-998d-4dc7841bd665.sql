INSERT INTO public.ad_placements (name, display_name, description, width, height, format, is_active, sort_order)
VALUES 
  ('recording_preroll', 'Recording - Pre-roll Video', 'Video antes de grabación premium', 1280, 720, 'preroll', true, 12),
  ('lives_interstitial_mobile', 'Lives - Interstitial Mobile', 'Interstitial pantalla completa para móvil', 1080, 1920, 'interstitial', true, 13),
  ('lives_interstitial_desktop', 'Lives - Interstitial Desktop', 'Interstitial pantalla completa para desktop/tablet', 1920, 1080, 'interstitial', true, 14);