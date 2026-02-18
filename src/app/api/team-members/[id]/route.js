import { ensureTeamMembersTable, ensureUsersTable, query, withTransaction } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

const DEFAULT_TEAM_PASSWORD_HASH =
  "cinema_seed_salt:f4e13f565c473529e4d841e977174a4033f234c36b1065361a2bbeca3f1816d8474edd44c1d74878f3fc95e6c32943180ccc567df4d18497e1a7e2e7f39675b0";

function toUserRole(teamRole) {
  return teamRole === "ADMIN" ? "ADMIN" : "STAFF";
}

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

function validatePayload(body) {
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const role = typeof body?.role === "string" ? body.role.trim().toUpperCase() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "ACTIVE";
  const theaterId = Number.parseInt(body?.theaterId, 10);
  const hiredAt = typeof body?.hiredAt === "string" ? body.hiredAt.trim() : "";

  if (!firstName || !lastName || !email || !role) {
    return { error: "firstName, lastName, email, and role are required." };
  }
  if (!/\S+@\S+\.\S+/.test(email)) return { error: "Invalid email." };
  if (!["ADMIN", "MANAGER", "STAFF"].includes(role)) return { error: "Invalid role." };
  if (!["ACTIVE", "INACTIVE", "ON_LEAVE"].includes(status)) return { error: "Invalid status." };

  return {
    firstName,
    lastName,
    email,
    phone,
    role,
    department,
    status,
    theaterId: Number.isNaN(theaterId) ? null : theaterId,
    hiredAt: hiredAt || null
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(_request, { params }) {
  try {
    await ensureTeamMembersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid team member id." }, { status: 400 });

    const result = await query(
      `
        SELECT tm.id, tm.first_name, tm.last_name, tm.email, tm.phone, tm.role, tm.department, tm.status, tm.theater_id, tm.hired_at, tm.created_at, tm.updated_at,
               th.name AS theater_name
        FROM team_members tm
        LEFT JOIN theaters th ON th.id = tm.theater_id
        WHERE tm.id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Team member not found." }, { status: 404 });
    return jsonResponse({ teamMember: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureTeamMembersTable();
    await ensureUsersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid team member id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const updated = await withTransaction(async (client) => {
      const existingResult = await client.query("SELECT email FROM team_members WHERE id = $1", [id]);
      if (existingResult.rowCount === 0) return false;
      const oldEmail = existingResult.rows[0].email;

      await client.query(
        `
          UPDATE team_members
          SET first_name = $1, last_name = $2, email = $3, phone = $4, role = $5, department = $6, status = $7, theater_id = $8, hired_at = $9, updated_at = NOW()
          WHERE id = $10
        `,
        [
          parsed.firstName,
          parsed.lastName,
          parsed.email,
          parsed.phone || null,
          parsed.role,
          parsed.department || null,
          parsed.status,
          parsed.theaterId,
          parsed.hiredAt,
          id
        ]
      );

      const userUpdate = await client.query(
        `
          UPDATE users
          SET first_name = $1, last_name = $2, email = $3, phone = $4, role = $5, updated_at = NOW()
          WHERE email = $6
        `,
        [
          parsed.firstName,
          parsed.lastName,
          parsed.email,
          parsed.phone || null,
          toUserRole(parsed.role),
          oldEmail
        ]
      );

      if (userUpdate.rowCount === 0) {
        await client.query(
          `
            INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE
            SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              phone = EXCLUDED.phone,
              role = EXCLUDED.role,
              updated_at = NOW()
          `,
          [
            parsed.firstName,
            parsed.lastName,
            parsed.email,
            parsed.phone || null,
            DEFAULT_TEAM_PASSWORD_HASH,
            toUserRole(parsed.role)
          ]
        );
      }

      return true;
    });

    if (!updated) return jsonResponse({ error: "Team member not found." }, { status: 404 });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureTeamMembersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid team member id." }, { status: 400 });

    const result = await query("DELETE FROM team_members WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Team member not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
