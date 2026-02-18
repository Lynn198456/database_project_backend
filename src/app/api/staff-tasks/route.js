import { ensureStaffTasksTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const status = typeof searchParams.get("status") === "string" ? searchParams.get("status").trim().toUpperCase() : "";
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const teamMemberId = Number.parseInt(searchParams.get("teamMemberId") || "", 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    status,
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

function validatePayload(body) {
  const teamMemberId = Number.parseInt(body?.teamMemberId, 10);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const priority = typeof body?.priority === "string" ? body.priority.trim().toUpperCase() : "MEDIUM";
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate.trim() : "";
  const dueTime = typeof body?.dueTime === "string" ? body.dueTime.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "PENDING";

  if (!title) return { error: "title is required." };
  if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) return { error: "Invalid priority." };
  if (!["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) return { error: "Invalid status." };

  return {
    teamMemberId: Number.isNaN(teamMemberId) ? null : teamMemberId,
    email,
    title,
    description,
    priority,
    dueDate: dueDate || null,
    dueTime: dueTime || null,
    status
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureStaffTasksTable();
    const { page, limit, status, email, teamMemberId } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const resolvedTeamMemberId = await resolveTeamMemberId(email, teamMemberId);

    const filters = [];
    const values = [];

    if (resolvedTeamMemberId) {
      values.push(resolvedTeamMemberId);
      filters.push(`st.team_member_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      filters.push(`st.status = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const listValues = [...values, limit, offset];

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT st.id, st.team_member_id, st.title, st.description, st.priority, st.due_date, st.due_time, st.status, st.created_at, st.updated_at, st.completed_at,
                 tm.first_name, tm.last_name, tm.email
          FROM staff_tasks st
          JOIN team_members tm ON tm.id = st.team_member_id
          ${whereClause}
          ORDER BY st.due_date ASC NULLS LAST, st.due_time ASC NULLS LAST, st.id DESC
          LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
        `,
        listValues
      ),
      query(`SELECT COUNT(*)::int AS total FROM staff_tasks st ${whereClause}`, values)
    ]);

    return jsonResponse({ tasks: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureStaffTasksTable();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const resolvedTeamMemberId = await resolveTeamMemberId(parsed.email, parsed.teamMemberId);
    if (!resolvedTeamMemberId) return jsonResponse({ error: "Team member not found." }, { status: 404 });

    const completedAt = parsed.status === "COMPLETED" ? new Date().toISOString() : null;

    const result = await query(
      `
        INSERT INTO staff_tasks (team_member_id, title, description, priority, due_date, due_time, status, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [resolvedTeamMemberId, parsed.title, parsed.description || null, parsed.priority, parsed.dueDate, parsed.dueTime, parsed.status, completedAt]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
