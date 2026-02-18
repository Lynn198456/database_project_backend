-- Staff Schedule database setup (safe to re-run)
-- Requires existing table: team_members

CREATE TABLE IF NOT EXISTS staff_schedules (
  id BIGSERIAL PRIMARY KEY,
  team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_on_shift TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  UNIQUE (team_member_id, shift_date, start_time)
);

CREATE TABLE IF NOT EXISTS staff_time_off_requests (
  id BIGSERIAL PRIMARY KEY,
  team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'VACATION',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  partial_day BOOLEAN NOT NULL DEFAULT FALSE,
  partial_start_time TIME,
  partial_end_time TIME,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (request_type IN ('VACATION', 'SICK', 'PERSONAL', 'OTHER')),
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_member_date
  ON staff_schedules(team_member_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date
  ON staff_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_timeoff_member_status
  ON staff_time_off_requests(team_member_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_timeoff_dates
  ON staff_time_off_requests(start_date, end_date);

-- Seed sample shifts for February 2026 (idempotent)
INSERT INTO staff_schedules (
  team_member_id,
  shift_date,
  start_time,
  end_time,
  role_on_shift,
  notes,
  status
)
SELECT
  tm.id,
  day::DATE AS shift_date,
  CASE
    WHEN (tm.id % 2 = 0 AND EXTRACT(ISODOW FROM day) IN (1, 3, 5)) OR (tm.id % 2 = 1 AND EXTRACT(ISODOW FROM day) IN (2, 4, 6))
      THEN TIME '09:00'
    ELSE TIME '14:00'
  END AS start_time,
  CASE
    WHEN (tm.id % 2 = 0 AND EXTRACT(ISODOW FROM day) IN (1, 3, 5)) OR (tm.id % 2 = 1 AND EXTRACT(ISODOW FROM day) IN (2, 4, 6))
      THEN TIME '17:00'
    ELSE TIME '22:00'
  END AS end_time,
  CASE
    WHEN COALESCE(tm.department, '') ILIKE '%box%' THEN 'Box Office'
    WHEN COALESCE(tm.department, '') ILIKE '%floor%' THEN 'Floor Staff'
    ELSE 'Guest Support'
  END AS role_on_shift,
  CASE
    WHEN (tm.id % 2 = 0 AND EXTRACT(ISODOW FROM day) IN (1, 3, 5)) OR (tm.id % 2 = 1 AND EXTRACT(ISODOW FROM day) IN (2, 4, 6))
      THEN 'Morning shift'
    ELSE 'Evening shift'
  END AS notes,
  'SCHEDULED'::TEXT AS status
FROM team_members tm
CROSS JOIN generate_series(DATE '2026-02-01', DATE '2026-02-28', INTERVAL '1 day') day
WHERE tm.role = 'STAFF'
  AND tm.status = 'ACTIVE'
  AND EXTRACT(ISODOW FROM day) BETWEEN 1 AND 6
AND NOT EXISTS (
  SELECT 1
  FROM staff_schedules ss
  WHERE ss.team_member_id = tm.id
    AND ss.shift_date = day::DATE
    AND ss.start_time =
      CASE
        WHEN (tm.id % 2 = 0 AND EXTRACT(ISODOW FROM day) IN (1, 3, 5)) OR (tm.id % 2 = 1 AND EXTRACT(ISODOW FROM day) IN (2, 4, 6))
          THEN TIME '09:00'
        ELSE TIME '14:00'
      END
);

-- Seed sample time-off requests (idempotent)
INSERT INTO staff_time_off_requests (
  team_member_id,
  request_type,
  start_date,
  end_date,
  partial_day,
  partial_start_time,
  partial_end_time,
  reason,
  status
)
SELECT
  tm.id,
  seed.request_type,
  seed.start_date,
  seed.end_date,
  seed.partial_day,
  seed.partial_start_time,
  seed.partial_end_time,
  seed.reason,
  seed.status
FROM (
  VALUES
    ('VACATION', DATE '2026-03-02', DATE '2026-03-03', FALSE, NULL, NULL, 'Family trip', 'PENDING'),
    ('PERSONAL', DATE '2026-02-11', DATE '2026-02-11', TRUE, TIME '15:00', TIME '18:00', 'Bank appointment', 'APPROVED')
) AS seed(request_type, start_date, end_date, partial_day, partial_start_time, partial_end_time, reason, status)
JOIN team_members tm ON tm.role = 'STAFF' AND tm.status = 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1
  FROM staff_time_off_requests r
  WHERE r.team_member_id = tm.id
    AND r.start_date = seed.start_date
    AND r.end_date = seed.end_date
    AND r.reason = seed.reason
);
