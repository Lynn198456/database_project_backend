-- Book Ticket database setup (safe to re-run)
-- Requires existing tables: users, showtimes

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  showtime_id BIGINT NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED'))
);

CREATE TABLE IF NOT EXISTS booking_seats (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, seat_label)
);

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

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_showtime_id ON bookings(showtime_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON bookings(booked_at);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
