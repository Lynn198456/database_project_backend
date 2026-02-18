import { ensureStaffTimeRecordsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

function validatePayload(body) {
  const workDate = typeof body?.workDate === "string" ? body.workDate.trim() : "";
  const clockInAt = typeof body?.clockInAt === "string" ? body.clockInAt.trim() : "";
  const clockOutAt = typeof body?.clockOutAt === "string" ? body.clockOutAt.trim() : "";
  const breakMinutes = Number.parseInt(body?.breakMinutes, 10);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "CLOCKED_IN";

  if (!workDate || !clockInAt) return { error: "workDate and clockInAt are required." };
  if (!["CLOCKED_IN", "COMPLETED", "MISSED", "ABSENT"].includes(status)) return { error: "Invalid status." };

  return {
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

export async function GET(_request, { params }) {
  try {
    await ensureStaffTimeRecordsTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid record id." }, { status: 400 });

    const result = await query(
      `
        SELECT str.id, str.team_member_id, str.work_date, str.clock_in_at, str.clock_out_at, str.break_minutes, str.notes, str.status, str.created_at, str.updated_at,
               tm.first_name, tm.last_name, tm.email
        FROM staff_time_records str
        JOIN team_members tm ON tm.id = str.team_member_id
        WHERE str.id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Record not found." }, { status: 404 });
    return jsonResponse({ record: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureStaffTimeRecordsTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid record id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        UPDATE staff_time_records
        SET work_date = $1, clock_in_at = $2, clock_out_at = $3, break_minutes = $4, notes = $5, status = $6, updated_at = NOW()
        WHERE id = $7
      `,
      [parsed.workDate, parsed.clockInAt, parsed.clockOutAt, parsed.breakMinutes, parsed.notes || null, parsed.status, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Record not found." }, { status: 404 });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureStaffTimeRecordsTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid record id." }, { status: 400 });

    const result = await query("DELETE FROM staff_time_records WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Record not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
