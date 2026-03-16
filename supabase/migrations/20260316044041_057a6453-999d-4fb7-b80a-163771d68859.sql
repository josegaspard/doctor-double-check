
-- Update existing creatives with proper placement-specific images
UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-lives.jpg'
WHERE id = 'b0000000-0000-0000-0000-000000000001'; -- lives_top_banner

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-recordings.jpg'
WHERE id = 'b0000000-0000-0000-0000-000000000002'; -- recordings_top_banner

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-mobile-inline.jpg'
WHERE id = 'b0000000-0000-0000-0000-000000000003'; -- content_inline

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-horizontal-1.jpg'
WHERE id = '680e69ae-9e72-4c32-9883-cb16b4986bfe'; -- news_top_banner

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-vertical-1.jpg'
WHERE id = '7437d85a-cb70-412f-a80e-d9de7d762206'; -- news_sidebar_left

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-vertical-2.jpg'
WHERE id = 'a6046e7b-7fd6-40fc-9e8b-efc754486354'; -- news_sidebar_right

UPDATE ad_creatives SET media_url = 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-horizontal-2.jpg'
WHERE id = '8ee1bab8-9151-4e09-b47d-5d0e93cc9a29'; -- news_inline_mobile

-- Add creative for news_sidebar (24956192...) which had no creative
INSERT INTO ad_creatives (campaign_id, placement_id, media_url, media_type, click_url, alt_text, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '24956192-3dc9-43eb-8eb7-06d1fa84e0d8',
  'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-vertical-1.jpg',
  'image',
  'https://cirugiaesteticauribe.com',
  'Medical Masters - Publicidad Demo',
  true
);
