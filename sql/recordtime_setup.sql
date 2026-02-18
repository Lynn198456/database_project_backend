-- Staff record time database setup (safe to re-run)
-- Requires existing table: team_members

CREATE TABLE IF NOT EXISTS staff_time_records (
  id BIGSERIAL PRIMARY KEY,
  team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  break_minutes INT NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'CLOCKED_IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (break_minutes >= 0),
  CHECK (status IN ('CLOCKED_IN', 'COMPLETED', 'MISSED', 'ABSENT')),
  UNIQUE (team_member_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_time_records_member_date
  ON staff_time_records(team_member_id, work_date);
CREATE INDEX IF NOT EXISTS idx_staff_time_records_date
  ON staff_time_records(work_date);

-- Seed sample time records for active staff (idempotent)
INSERT INTO staff_time_records (
  team_member_id,
  work_date,
  clock_in_at,
  clock_out_at,
  break_minutes,
  notes,
  status
)
SELECT
  tm.id,
  seed.work_date,
  seed.clock_in_at,
  seed.clock_out_at,
  seed.break_minutes,
  seed.notes,
  seed.status
FROM team_members tm
CROSS JOIN (
  VALUES
    (DATE '2026-02-16', TIMESTAMPTZ '2026-02-16 09:00:00+07', TIMESTAMPTZ '2026-02-16 17:00:00+07', 30, 'Regular shift', 'COMPLETED'),
    (DATE '2026-02-17', TIMESTAMPTZ '2026-02-17 14:00:00+07', TIMESTAMPTZ '2026-02-17 22:00:00+07', 30, 'Evening shift', 'COMPLETED'),
    (DATE '2026-02-18', TIMESTAMPTZ '2026-02-18 09:05:00+07', NULL, 0, 'Clocked in late by 5 minutes', 'CLOCKED_IN')
) AS seed(work_date, clock_in_at, clock_out_at, break_minutes, notes, status)
WHERE tm.role = 'STAFF'
  AND tm.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1
    FROM staff_time_records str
    WHERE str.team_member_id = tm.id
      AND str.work_date = seed.work_date
  );
