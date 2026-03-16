
-- Seed demo ad campaign
INSERT INTO public.ad_campaigns (
  id, advertiser_id, name, status, budget, spent, target_impressions, target_clicks,
  start_date, end_date, target_roles, target_language, placement_ids
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '4990fc77-77d0-4c71-84e4-edb8d4a01097',
  'Demo - Salud Digital',
  'active',
  5000,
  0,
  100000,
  5000,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '90 days',
  ARRAY['patient', 'resident', 'doctor'],
  NULL,
  ARRAY['2b5dca50-94f2-4309-8a2a-6ef12299acf2', '2a3a0349-0353-45bf-a96e-4d4f614cdf4a', '93b11910-70e2-4fc5-9a67-da9a42caa8fb']::uuid[]
) ON CONFLICT (id) DO NOTHING;

-- Seed creatives for each placement
INSERT INTO public.ad_creatives (id, campaign_id, placement_id, media_url, media_type, click_url, alt_text, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2b5dca50-94f2-4309-8a2a-6ef12299acf2', 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo%2Fbanner-wide.jpg', 'image', 'https://doc-seek-relay.lovable.app/doctors', 'Consulta Médica Online - Tu salud primero', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '2a3a0349-0353-45bf-a96e-4d4f614cdf4a', 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo%2Fbanner-wide.jpg', 'image', 'https://doc-seek-relay.lovable.app/doctors', 'Encuentra tu médico especialista', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '93b11910-70e2-4fc5-9a67-da9a42caa8fb', 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo%2Fbanner-mobile.jpg', 'image', 'https://doc-seek-relay.lovable.app/content', 'Contenido médico premium', true)
ON CONFLICT (id) DO NOTHING;

-- Seed a payment for the campaign
INSERT INTO public.ad_payments (id, campaign_id, amount, status, payment_method) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 5000, 'completed', 'demo')
ON CONFLICT (id) DO NOTHING;
