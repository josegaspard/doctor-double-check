ALTER TABLE purchases
  DROP CONSTRAINT purchases_recording_id_fkey;

ALTER TABLE purchases
  ALTER COLUMN recording_id DROP NOT NULL;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_recording_id_fkey
  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL;