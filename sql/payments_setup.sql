-- Payments database setup (safe to re-run)
-- Requires existing table: bookings

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  transaction_ref TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (method IN ('CARD', 'CASH', 'WALLET', 'ONLINE_BANKING')),
  CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- Seed missing PAID rows for existing CONFIRMED bookings (idempotent)
INSERT INTO payments (booking_id, method, amount, status, paid_at, transaction_ref)
SELECT
  b.id,
  'ONLINE_BANKING'::text,
  b.total_amount,
  'PAID'::text,
  COALESCE(b.booked_at, NOW()),
  CONCAT('AUTO-PAY-', b.id)
FROM bookings b
WHERE b.status = 'CONFIRMED'
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.booking_id = b.id
  );
