import { ensureUsersTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
}

function validateUpdatePayload(body) {
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!firstName || !lastName) {
    return { error: "firstName and lastName are required." };
  }

  return { firstName, lastName, phone: phone || null };
}

function toUserPayload(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getUserByIdentity({ id, email }) {
  if (id) {
    const result = await query(
      `
        SELECT id, first_name, last_name, email, phone, role, created_at, updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );
    return result.rowCount ? result.rows[0] : null;
  }

  if (email) {
    const result = await query(
      `
        SELECT id, first_name, last_name, email, phone, role, created_at, updated_at
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );
    return result.rowCount ? result.rows[0] : null;
  }

  return null;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureUsersTable();

    const { searchParams } = new URL(request.url);
    const id = parseId(searchParams.get("id"));
    const email = normalizeEmail(searchParams.get("email"));

    if (!id && !email) {
      return jsonResponse({ error: "id or email is required." }, { status: 400 });
    }

    const user = await getUserByIdentity({ id, email });
    if (!user) {
      return jsonResponse({ error: "User not found." }, { status: 404 });
    }

    return jsonResponse({ user: toUserPayload(user) });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureUsersTable();

    const { searchParams } = new URL(request.url);
    const id = parseId(searchParams.get("id"));
    const email = normalizeEmail(searchParams.get("email"));

    if (!id && !email) {
      return jsonResponse({ error: "id or email is required." }, { status: 400 });
    }

    const parsed = validateUpdatePayload(await request.json());
    if (parsed.error) {
      return jsonResponse({ error: parsed.error }, { status: 400 });
    }

    const updateResult = id
      ? await query(
          `
            UPDATE users
            SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, first_name, last_name, email, phone, role, created_at, updated_at
          `,
          [parsed.firstName, parsed.lastName, parsed.phone, id]
        )
      : await query(
          `
            UPDATE users
            SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW()
            WHERE LOWER(email) = LOWER($4)
            RETURNING id, first_name, last_name, email, phone, role, created_at, updated_at
          `,
          [parsed.firstName, parsed.lastName, parsed.phone, email]
        );

    if (updateResult.rowCount === 0) {
      return jsonResponse({ error: "User not found." }, { status: 404 });
    }

    return jsonResponse({ ok: true, user: toUserPayload(updateResult.rows[0]) });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
