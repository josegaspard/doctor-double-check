
-- Add country/currency columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'MX';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'MXN';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_flag TEXT DEFAULT '🇲🇽';

-- Exchange rates cache table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'MXN',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

-- Public read access for exchange rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exchange rates" ON exchange_rates FOR SELECT USING (true);
