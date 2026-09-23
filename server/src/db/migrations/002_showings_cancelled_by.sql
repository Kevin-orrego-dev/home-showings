-- =====================================================================
-- 002: record WHO cancelled a showing (the buyer or the seller),
-- so both sides can see "Cancelled by seller" in their list.
-- Schema changes always go in a NEW migration; 001 is never edited
-- once it has been applied somewhere.
-- =====================================================================

ALTER TABLE showings
  ADD COLUMN cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Keep the data consistent: a cancelled showing has a cancellation time, an active one doesn't.
ALTER TABLE showings
  ADD CONSTRAINT showings_cancel_fields_consistent
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL));
