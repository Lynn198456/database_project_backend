import { ensureStaffScheduleTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function normalizeType(type) {
  const v = String(type || "").trim().toUpperCase();
  if (v === "VACATION") return "VACATION";
  if (v === "SICK" || v === "SICK LEAVE") return "SICK";
  if (v === "PERSONAL") return "PERSONAL";
  return "OTHER";
}

async function resolveTeamMemberId(email, teamMemberId) {
  const parsedId = Number.parseInt(teamMemberId || "", 10);
  if (!Number.isNaN(parsedId) && parsedId > 0) return parsedId;
  if (!email) return null;

  const result = await query("SELECT id FROM team_members WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
  if (result.rowCount === 0) return null;
  return result.rows[0].id;
}

function validatePayload(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const teamMemberId = Number.parseInt(body?.teamMemberId, 10);
  const requestType = normalizeType(body?.type || body?.requestType);
  const startDate = typeof body?.startDate === "string" ? body.startDate.trim() : "";
  const endDate = typeof body?.endDate === "string" ? body.endDate.trim() : "";
  const partialDay = Boolean(body?.partialDay);
  const partialStartTime = typeof body?.startTime === "string" ? body.startTime.trim() : "";
  const partialEndTime = typeof body?.endTime === "string" ? body.endTime.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason || !startDate || !endDate) {
    return { error: "startDate, endDate, and reason are required." };
  }
  if (new Date(endDate) < new Date(startDate)) {
    return { error: "endDate cannot be before startDate." };
  }

  return {
    email,
    teamMemberId: Number.isNaN(teamMemberId) ? null : teamMemberId,
    requestType,
    startDate,
    endDate,
    partialDay,
    partialStartTime: partialDay ? partialStartTime || null : null,
    partialEndTime: partialDay ? partialEndTime || null : null,
    reason
  };
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
    if (!resolvedTeamMemberId) return jsonResponse({ requests: [] });

    const result = await query(
      `
        SELECT id, team_member_id, request_type, start_date, end_date, partial_day, partial_start_time, partial_end_time, reason, status, created_at, updated_at
        FROM staff_time_off_requests
        WHERE team_member_id = $1
        ORDER BY created_at DESC
      `,
      [resolvedTeamMemberId]
    );

    return jsonResponse({ requests: result.rows, teamMemberId: resolvedTeamMemberId });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureStaffScheduleTables();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const resolvedTeamMemberId = await resolveTeamMemberId(parsed.email, parsed.teamMemberId);
    if (!resolvedTeamMemberId) return jsonResponse({ error: "Team member not found." }, { status: 404 });

    const result = await query(
      `
        INSERT INTO staff_time_off_requests (
          team_member_id, request_type, start_date, end_date, partial_day, partial_start_time, partial_end_time, reason, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING id
      `,
      [
        resolvedTeamMemberId,
        parsed.requestType,
        parsed.startDate,
        parsed.endDate,
        parsed.partialDay,
        parsed.partialStartTime,
        parsed.partialEndTime,
        parsed.reason
      ]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
