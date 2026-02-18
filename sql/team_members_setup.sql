-- Team Member database setup (safe to re-run)
-- Optional dependency: theaters table (for assigned location)

CREATE TABLE IF NOT EXISTS team_members (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  theater_id BIGINT REFERENCES theaters(id) ON DELETE SET NULL,
  hired_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE'))
);

CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_theater_id ON team_members(theater_id);

-- Seed sample team members (idempotent by email)
INSERT INTO team_members (
  first_name,
  last_name,
  email,
  phone,
  role,
  department,
  status,
  theater_id,
  hired_at
)
SELECT
  seed.first_name,
  seed.last_name,
  seed.email,
  seed.phone,
  seed.role,
  seed.department,
  seed.status,
  th.id,
  seed.hired_at
FROM (
  VALUES
    ('Ava', 'Chen', 'ava.chen@cinemalistic.com', '000-100-0001', 'MANAGER', 'Operations', 'ACTIVE', 'Cinema Listic Central', DATE '2024-01-10'),
    ('Noah', 'Kim', 'noah.kim@cinemalistic.com', '000-100-0002', 'STAFF', 'Box Office', 'ACTIVE', 'Cinema Listic Central', DATE '2024-03-12'),
    ('Mia', 'Patel', 'mia.patel@cinemalistic.com', '000-100-0003', 'STAFF', 'Floor', 'ACTIVE', 'Cinema Listic Riverside', DATE '2024-05-02'),
    ('Leo', 'Nguyen', 'leo.nguyen@cinemalistic.com', '000-100-0004', 'ADMIN', 'Head Office', 'ACTIVE', NULL, DATE '2023-11-20')
) AS seed(first_name, last_name, email, phone, role, department, status, theater_name, hired_at)
LEFT JOIN theaters th ON th.name = seed.theater_name
WHERE NOT EXISTS (
  SELECT 1
  FROM team_members tm
  WHERE LOWER(tm.email) = LOWER(seed.email)
);
