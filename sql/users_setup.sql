-- Users database setup (safe to re-run)

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  profile_photo TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('CUSTOMER', 'STAFF', 'ADMIN'))
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Sample users (password: 12345678)
-- Hash format is scrypt "salt:hexhash" to match /api/auth/login verification.
INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
VALUES
  (
    'Admin',
    'User',
    'admin@cinemalistic.com',
    '000-000-0001',
    'cinema_seed_salt:f4e13f565c473529e4d841e977174a4033f234c36b1065361a2bbeca3f1816d8474edd44c1d74878f3fc95e6c32943180ccc567df4d18497e1a7e2e7f39675b0',
    'ADMIN'
  ),
  (
    'Staff',
    'User',
    'staff@cinemalistic.com',
    '000-000-0002',
    'cinema_seed_salt:f4e13f565c473529e4d841e977174a4033f234c36b1065361a2bbeca3f1816d8474edd44c1d74878f3fc95e6c32943180ccc567df4d18497e1a7e2e7f39675b0',
    'STAFF'
  ),
  (
    'Customer',
    'User',
    'customer@cinemalistic.com',
    '000-000-0003',
    'cinema_seed_salt:f4e13f565c473529e4d841e977174a4033f234c36b1065361a2bbeca3f1816d8474edd44c1d74878f3fc95e6c32943180ccc567df4d18497e1a7e2e7f39675b0',
    'CUSTOMER'
  ),
  (
    'Winwin',
    'User',
    'winwin@gmail.com',
    '000-000-0013',
    'c1nema2026:ca777b2344c48cd1472863f687d25146a0351948f49ec15b9374a208675ebf6bc5bed235f6e7d66317933a86ca34d9fcb13074dfe77884b69201bcde3671f53d',
    'CUSTOMER'
  )
ON CONFLICT (email) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  updated_at = NOW();
