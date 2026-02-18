import { randomBytes, scryptSync } from "node:crypto";

import { ensureUsersTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function validatePayload(body) {
  const allowedRoles = new Set(["CUSTOMER", "STAFF", "ADMIN"]);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  const role = typeof body?.role === "string" ? body.role.trim().toUpperCase() : "CUSTOMER";

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return { error: "Please fill in all required fields." };
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (!allowedRoles.has(role)) {
    return { error: "Invalid role." };
  }

  return { firstName, lastName, email, phone, password, role };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request) {
  try {
    await ensureUsersTable();
    const body = await request.json();
    const parsed = validatePayload(body);

    if (parsed.error) {
      return jsonResponse({ error: parsed.error }, { status: 400 });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [parsed.email]);
    if (existing.rowCount > 0) {
      return jsonResponse({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = hashPassword(parsed.password);

    const result = await query(
      `
        INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, first_name, last_name, email, role
      `,
      [parsed.firstName, parsed.lastName, parsed.email, parsed.phone || null, passwordHash, parsed.role]
    );

    return jsonResponse(
      {
        ok: true,
        user: {
          id: result.rows[0].id,
          firstName: result.rows[0].first_name,
          lastName: result.rows[0].last_name,
          email: result.rows[0].email,
          role: result.rows[0].role
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
