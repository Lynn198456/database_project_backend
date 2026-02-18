-- Theaters database setup (safe to re-run)

CREATE TABLE IF NOT EXISTS theaters (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for searching by city
CREATE INDEX IF NOT EXISTS idx_theaters_city ON theaters(city);

-- Seed theaters (idempotent)
INSERT INTO theaters (name, location, address, city)
SELECT * FROM (
  VALUES
    ('Cinema Listic Central', 'Downtown', '123 Main St', 'Bangkok'),
    ('Cinema Listic Riverside', 'Riverside', '88 River Rd', 'Bangkok'),
    ('Cinema Listic Mall', 'City Mall', '199 Mall Avenue', 'Bangkok'),
    ('Cinema Listic East', 'East District', '44 East Park', 'Bangkok')
) AS seed(name, location, address, city)
WHERE NOT EXISTS (
  SELECT 1
  FROM theaters t
  WHERE LOWER(t.name) = LOWER(seed.name)
);
