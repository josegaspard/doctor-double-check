-- Insert new ad placements for content library
INSERT INTO public.ad_placements (name, display_name, description, format, width, height, is_active, sort_order)
VALUES
  ('content_sidebar_left', 'Content Sidebar Left', 'Left sidebar in content library (desktop)', 'sidebar', 160, 600, true, 20),
  ('content_sidebar_right', 'Content Sidebar Right', 'Right sidebar in content library (desktop)', 'sidebar', 160, 600, true, 21),
  ('content_mid_inline', 'Content Mid Inline', 'Inline ad between content cards', 'banner', 728, 90, true, 22),
  ('content_bottom_banner', 'Content Bottom Banner', 'Bottom banner in content library', 'banner', 728, 90, true, 23);
