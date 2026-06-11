-- P0: doctor payout double-pay guard.
-- process-doctor-payouts inserts a 'processing' row BEFORE the Stripe transfer and
-- treats an insert failure as "already processing → skip" (graceful continue).
-- That lock only works with a DB-level uniqueness guarantee, which was missing:
-- two concurrent admin runs could both insert 'processing' and both transfer.
-- This partial unique index makes the second concurrent insert fail with 23505.
create unique index if not exists ux_doctor_payouts_one_processing
  on public.doctor_payouts (doctor_id)
  where status = 'processing';
