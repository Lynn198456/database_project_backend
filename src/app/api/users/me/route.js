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
  const hasProfilePhoto = Object.prototype.hasOwnProperty.call(body || {}, "profilePhoto");
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : null;
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const profilePhoto = hasProfilePhoto ? String(body?.profilePhoto || "").trim() : null;

  if (
    firstName === null &&
    lastName === null &&
    phone === null &&
    !hasProfilePhoto
  ) {
    return { error: "No updatable fields provided." };
  }

  if ((firstName !== null && !firstName) || (lastName !== null && !lastName)) {
    return { error: "firstName and lastName cannot be empty." };
  }

  return {
    firstName,
    lastName,
    phone: phone === null ? null : phone || null,
    profilePhotoProvided: hasProfilePhoto,
    profilePhoto
  };
}

function toUserPayload(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    profilePhoto: row.profile_photo || "",
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
        , profile_photo
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
        , profile_photo
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
            SET
              first_name = COALESCE($1, first_name),
              last_name = COALESCE($2, last_name),
              phone = COALESCE($3, phone),
              profile_photo = CASE WHEN $4 THEN $5 ELSE profile_photo END,
              updated_at = NOW()
            WHERE id = $6
            RETURNING id, first_name, last_name, email, phone, profile_photo, role, created_at, updated_at
          `,
          [parsed.firstName, parsed.lastName, parsed.phone, parsed.profilePhotoProvided, parsed.profilePhoto, id]
        )
      : await query(
          `
            UPDATE users
            SET
              first_name = COALESCE($1, first_name),
              last_name = COALESCE($2, last_name),
              phone = COALESCE($3, phone),
              profile_photo = CASE WHEN $4 THEN $5 ELSE profile_photo END,
              updated_at = NOW()
            WHERE LOWER(email) = LOWER($6)
            RETURNING id, first_name, last_name, email, phone, profile_photo, role, created_at, updated_at
          `,
          [parsed.firstName, parsed.lastName, parsed.phone, parsed.profilePhotoProvided, parsed.profilePhoto, email]
        );

    if (updateResult.rowCount === 0) {
      return jsonResponse({ error: "User not found." }, { status: 404 });
    }

    return jsonResponse({ ok: true, user: toUserPayload(updateResult.rows[0]) });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
