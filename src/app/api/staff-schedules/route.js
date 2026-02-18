import { ensureStaffScheduleTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

async function resolveTeamMemberId(email, teamMemberId) {
  const parsedId = Number.parseInt(teamMemberId || "", 10);
  if (!Number.isNaN(parsedId) && parsedId > 0) return parsedId;
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
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") || "").trim().toLowerCase();
    const teamMemberId = searchParams.get("teamMemberId");

    const resolvedTeamMemberId = await resolveTeamMemberId(email, teamMemberId);
    if (!resolvedTeamMemberId) {
      return jsonResponse({ schedules: [] });
    }

    const result = await query(
      `
        SELECT ss.id, ss.team_member_id, ss.shift_date, ss.start_time, ss.end_time, ss.role_on_shift, ss.notes, ss.status, ss.created_at, ss.updated_at,
               tm.first_name, tm.last_name, tm.email
        FROM staff_schedules ss
        JOIN team_members tm ON tm.id = ss.team_member_id
        WHERE ss.team_member_id = $1
        ORDER BY ss.shift_date ASC, ss.start_time ASC
      `,
      [resolvedTeamMemberId]
    );

    return jsonResponse({ schedules: result.rows, teamMemberId: resolvedTeamMemberId });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
