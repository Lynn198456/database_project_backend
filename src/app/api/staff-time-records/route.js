import { ensureStaffTimeRecordsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const teamMemberId = Number.parseInt(searchParams.get("teamMemberId") || "", 10);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const status = (searchParams.get("status") || "").trim().toUpperCase();

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    email,
    teamMemberId: Number.isNaN(teamMemberId) ? null : teamMemberId,
    from,
    to,
    status
  };
}

async function resolveTeamMemberId(email, teamMemberId) {
  if (teamMemberId) return teamMemberId;
  if (!email) return null;

  const result = await query("SELECT id FROM team_members WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
  if (result.rowCount === 0) return null;
  return result.rows[0].id;
}

function validatePayload(body) {
  const teamMemberId = Number.parseInt(body?.teamMemberId, 10);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const workDate = typeof body?.workDate === "string" ? body.workDate.trim() : "";
  const clockInAt = typeof body?.clockInAt === "string" ? body.clockInAt.trim() : "";
  const clockOutAt = typeof body?.clockOutAt === "string" ? body.clockOutAt.trim() : "";
  const breakMinutes = Number.parseInt(body?.breakMinutes, 10);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "CLOCKED_IN";

  if (!workDate || !clockInAt) return { error: "workDate and clockInAt are required." };
  if (!["CLOCKED_IN", "COMPLETED", "MISSED", "ABSENT"].includes(status)) return { error: "Invalid status." };

  return {
    teamMemberId: Number.isNaN(teamMemberId) ? null : teamMemberId,
    email,
    workDate,
    clockInAt,
    clockOutAt: clockOutAt || null,
    breakMinutes: Number.isNaN(breakMinutes) ? 0 : Math.max(0, breakMinutes),
    notes,
    status
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureStaffTimeRecordsTable();
    const { page, limit, email, teamMemberId, from, to, status } = parsePagination(request.url);
    const resolvedTeamMemberId = await resolveTeamMemberId(email, teamMemberId);
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];

    if (resolvedTeamMemberId) {
      values.push(resolvedTeamMemberId);
      filters.push(`str.team_member_id = $${values.length}`);
    }
    if (from) {
      values.push(from);
      filters.push(`str.work_date >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      filters.push(`str.work_date <= $${values.length}`);
    }
    if (status) {
      values.push(status);
      filters.push(`str.status = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const listValues = [...values, limit, offset];

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT str.id, str.team_member_id, str.work_date, str.clock_in_at, str.clock_out_at, str.break_minutes, str.notes, str.status, str.created_at, str.updated_at,
                 tm.first_name, tm.last_name, tm.email
          FROM staff_time_records str
          JOIN team_members tm ON tm.id = str.team_member_id
          ${whereClause}
          ORDER BY str.work_date DESC, str.clock_in_at DESC
          LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
        `,
        listValues
      ),
      query(`SELECT COUNT(*)::int AS total FROM staff_time_records str ${whereClause}`, values)
    ]);

    return jsonResponse({ records: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureStaffTimeRecordsTable();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const resolvedTeamMemberId = await resolveTeamMemberId(parsed.email, parsed.teamMemberId);
    if (!resolvedTeamMemberId) return jsonResponse({ error: "Team member not found." }, { status: 404 });

    const result = await query(
      `
        INSERT INTO staff_time_records (team_member_id, work_date, clock_in_at, clock_out_at, break_minutes, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        resolvedTeamMemberId,
        parsed.workDate,
        parsed.clockInAt,
        parsed.clockOutAt,
        parsed.breakMinutes,
        parsed.notes || null,
        parsed.status
      ]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
