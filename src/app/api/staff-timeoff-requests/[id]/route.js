import { ensureStaffScheduleTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

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

export async function DELETE(request, { params }) {
  try {
    await ensureStaffScheduleTables();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid request id." }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") || "").trim().toLowerCase();
    const teamMemberId = searchParams.get("teamMemberId");
    const resolvedTeamMemberId = await resolveTeamMemberId(email, teamMemberId);

    if (!resolvedTeamMemberId) {
      return jsonResponse({ error: "Team member not found." }, { status: 404 });
    }

    const result = await query(
      "DELETE FROM staff_time_off_requests WHERE id = $1 AND team_member_id = $2",
      [id, resolvedTeamMemberId]
    );

    if (result.rowCount === 0) {
      return jsonResponse({ error: "Request not found." }, { status: 404 });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
