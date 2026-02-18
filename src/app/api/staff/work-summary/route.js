import { ensureStaffScheduleTables, ensureStaffTasksTable, ensureStaffTimeRecordsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseIdentity(url) {
  const { searchParams } = new URL(url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const teamMemberId = Number.parseInt(searchParams.get("teamMemberId") || "", 10);

  return {
    email,
    teamMemberId: Number.isNaN(teamMemberId) ? null : teamMemberId
  };
}

async function resolveTeamMemberId(email, teamMemberId) {
  if (teamMemberId) return teamMemberId;
  if (!email) return null;

  const result = await query("SELECT id FROM team_members WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
  if (result.rowCount === 0) return null;
  return result.rows[0].id;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureStaffScheduleTables();
    await ensureStaffTasksTable();
    await ensureStaffTimeRecordsTable();

    const { email, teamMemberId } = parseIdentity(request.url);
    const resolvedTeamMemberId = await resolveTeamMemberId(email, teamMemberId);

    if (!resolvedTeamMemberId) {
      return jsonResponse({
        summary: {
          totalHours: 0,
          shiftsCompleted: 0,
          tasksCompleted: 0,
          pendingTimeOffRequests: 0,
          upcomingShifts: 0,
          openTasks: 0
        }
      });
    }

    const result = await query(
      `
        SELECT
          COALESCE((
            SELECT ROUND(SUM(
              CASE
                WHEN str.clock_out_at IS NULL THEN 0
                ELSE GREATEST(0, EXTRACT(EPOCH FROM (str.clock_out_at - str.clock_in_at))/3600.0 - (str.break_minutes::numeric/60.0))
              END
            )::numeric, 2)
            FROM staff_time_records str
            WHERE str.team_member_id = $1
              AND str.status = 'COMPLETED'
          ), 0)::float8 AS total_hours,

          COALESCE((
            SELECT COUNT(*)::int
            FROM staff_schedules ss
            WHERE ss.team_member_id = $1
              AND ss.status = 'COMPLETED'
          ), 0)::int AS shifts_completed,

          COALESCE((
            SELECT COUNT(*)::int
            FROM staff_tasks st
            WHERE st.team_member_id = $1
              AND st.status = 'COMPLETED'
          ), 0)::int AS tasks_completed,

          COALESCE((
            SELECT COUNT(*)::int
            FROM staff_time_off_requests tor
            WHERE tor.team_member_id = $1
              AND tor.status = 'PENDING'
          ), 0)::int AS pending_time_off_requests,

          COALESCE((
            SELECT COUNT(*)::int
            FROM staff_schedules ss2
            WHERE ss2.team_member_id = $1
              AND ss2.status = 'SCHEDULED'
              AND ss2.shift_date >= CURRENT_DATE
          ), 0)::int AS upcoming_shifts,

          COALESCE((
            SELECT COUNT(*)::int
            FROM staff_tasks st2
            WHERE st2.team_member_id = $1
              AND st2.status IN ('PENDING', 'IN_PROGRESS')
          ), 0)::int AS open_tasks
      `,
      [resolvedTeamMemberId]
    );

    const row = result.rows[0] || {};

    return jsonResponse({
      summary: {
        totalHours: Number(row.total_hours || 0),
        shiftsCompleted: Number(row.shifts_completed || 0),
        tasksCompleted: Number(row.tasks_completed || 0),
        pendingTimeOffRequests: Number(row.pending_time_off_requests || 0),
        upcomingShifts: Number(row.upcoming_shifts || 0),
        openTasks: Number(row.open_tasks || 0)
      },
      teamMemberId: resolvedTeamMemberId
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
