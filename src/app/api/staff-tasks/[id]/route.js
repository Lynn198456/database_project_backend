import { ensureStaffTasksTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

function validatePayload(body) {
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

export async function GET(_request, { params }) {
  try {
    await ensureStaffTasksTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid task id." }, { status: 400 });

    const result = await query(
      `
        SELECT st.id, st.team_member_id, st.title, st.description, st.priority, st.due_date, st.due_time, st.status, st.created_at, st.updated_at, st.completed_at,
               tm.first_name, tm.last_name, tm.email
        FROM staff_tasks st
        JOIN team_members tm ON tm.id = st.team_member_id
        WHERE st.id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Task not found." }, { status: 404 });
    return jsonResponse({ task: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureStaffTasksTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid task id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const completedAtSql = parsed.status === "COMPLETED" ? "NOW()" : "NULL";

    const result = await query(
      `
        UPDATE staff_tasks
        SET title = $1, description = $2, priority = $3, due_date = $4, due_time = $5, status = $6,
            completed_at = ${completedAtSql}, updated_at = NOW()
        WHERE id = $7
      `,
      [parsed.title, parsed.description || null, parsed.priority, parsed.dueDate, parsed.dueTime, parsed.status, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Task not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureStaffTasksTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid task id." }, { status: 400 });

    const result = await query("DELETE FROM staff_tasks WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Task not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
