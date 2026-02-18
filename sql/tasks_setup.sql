-- Staff Tasks database setup (safe to re-run)
-- Requires existing table: team_members

CREATE TABLE IF NOT EXISTS staff_tasks (
  id BIGSERIAL PRIMARY KEY,
  team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  due_date DATE,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_member_status
  ON staff_tasks(team_member_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_due_date
  ON staff_tasks(due_date);

-- Seed sample tasks for active staff members (idempotent by member+title+due)
INSERT INTO staff_tasks (
  team_member_id,
  title,
  description,
  priority,
  due_date,
  due_time,
  status,
  completed_at
)
SELECT
  tm.id,
  seed.title,
  seed.description,
  seed.priority,
  seed.due_date,
  seed.due_time,
  seed.status,
  seed.completed_at
FROM team_members tm
CROSS JOIN (
  VALUES
    ('Clean assigned theater', 'Sweep floors, check seats, remove trash.', 'HIGH', DATE '2026-02-20', TIME '10:00', 'PENDING', NULL),
    ('Restock concession items', 'Top up popcorn, drinks, and candy counters.', 'MEDIUM', DATE '2026-02-20', TIME '11:30', 'IN_PROGRESS', NULL),
    ('Projection check', 'Verify projector lamp, sound, and screen sync.', 'HIGH', DATE '2026-02-20', TIME '13:00', 'COMPLETED', NOW() - INTERVAL '2 hours'),
    ('End-of-day cash count', 'Reconcile POS totals and close register.', 'MEDIUM', DATE '2026-02-20', TIME '21:30', 'PENDING', NULL),
    ('Audit seat condition', 'Inspect and report damaged seats in assigned screens.', 'LOW', DATE '2026-02-21', TIME '09:15', 'PENDING', NULL),
    ('Poster replacement', 'Replace old posters at lobby display wall.', 'LOW', DATE '2026-02-21', TIME '12:45', 'IN_PROGRESS', NULL),
    ('Emergency exit check', 'Verify all exit signs and pathways are clear.', 'HIGH', DATE '2026-02-22', TIME '10:30', 'PENDING', NULL),
    ('Inventory count', 'Count snack inventory and submit report.', 'MEDIUM', DATE '2026-02-22', TIME '15:00', 'PENDING', NULL),
    ('Audio calibration', 'Run sound test and calibrate theater speakers.', 'HIGH', DATE '2026-02-23', TIME '11:00', 'COMPLETED', NOW() - INTERVAL '1 day'),
    ('Assist VIP screening', 'Support seating and guest guidance for VIP show.', 'MEDIUM', DATE '2026-02-24', TIME '18:30', 'PENDING', NULL),
    ('Clean projector booth', 'Dust and sanitize projection room equipment area.', 'LOW', DATE '2026-02-25', TIME '09:30', 'PENDING', NULL),
    ('Refund desk support', 'Handle refund and exchange requests during peak hour.', 'HIGH', DATE '2026-02-26', TIME '17:00', 'IN_PROGRESS', NULL),
    ('Weekend prep checklist', 'Complete opening checklist for weekend operations.', 'MEDIUM', DATE '2026-02-27', TIME '08:45', 'PENDING', NULL),
    ('Close shift report', 'Submit shift summary and unresolved issues log.', 'MEDIUM', DATE '2026-02-28', TIME '22:00', 'PENDING', NULL)
) AS seed(title, description, priority, due_date, due_time, status, completed_at)
WHERE tm.role = 'STAFF'
  AND tm.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1
    FROM staff_tasks st
    WHERE st.team_member_id = tm.id
      AND st.title = seed.title
      AND st.due_date IS NOT DISTINCT FROM seed.due_date
      AND st.due_time IS NOT DISTINCT FROM seed.due_time
  );
