import { ensureTeamMembersTable, ensureUsersTable, query, withTransaction } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

const DEFAULT_TEAM_PASSWORD_HASH =
  "cinema_seed_salt:f4e13f565c473529e4d841e977174a4033f234c36b1065361a2bbeca3f1816d8474edd44c1d74878f3fc95e6c32943180ccc567df4d18497e1a7e2e7f39675b0";

function toUserRole(teamRole) {
  return teamRole === "ADMIN" ? "ADMIN" : "STAFF";
}

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const role = typeof searchParams.get("role") === "string" ? searchParams.get("role").trim().toUpperCase() : "";
  const status =
    typeof searchParams.get("status") === "string" ? searchParams.get("status").trim().toUpperCase() : "";
  const q = typeof searchParams.get("q") === "string" ? searchParams.get("q").trim().toLowerCase() : "";

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    role,
    status,
    q
  };
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

export async function GET(request) {
  try {
    await ensureTeamMembersTable();
    const { page, limit, role, status, q } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];

    if (role) {
      values.push(role);
      filters.push(`tm.role = $${values.length}`);
    }
    if (status) {
      values.push(status);
      filters.push(`tm.status = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      filters.push(
        `(LOWER(tm.first_name || ' ' || tm.last_name) LIKE $${values.length} OR LOWER(tm.email) LIKE $${values.length} OR LOWER(tm.department) LIKE $${values.length})`
      );
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const listValues = [...values, limit, offset];

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT tm.id, tm.first_name, tm.last_name, tm.email, tm.phone, tm.role, tm.department, tm.status, tm.theater_id, tm.hired_at, tm.created_at, tm.updated_at,
                 th.name AS theater_name
          FROM team_members tm
          LEFT JOIN theaters th ON th.id = tm.theater_id
          ${whereClause}
          ORDER BY tm.id DESC
          LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
        `,
        listValues
      ),
      query(`SELECT COUNT(*)::int AS total FROM team_members tm ${whereClause}`, values)
    ]);

    return jsonResponse({ teamMembers: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureTeamMembersTable();
    await ensureUsersTable();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const teamMemberId = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO team_members (first_name, last_name, email, phone, role, department, status, theater_id, hired_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
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
          parsed.hiredAt
        ]
      );

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

      return result.rows[0].id;
    });

    return jsonResponse({ id: teamMemberId }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
