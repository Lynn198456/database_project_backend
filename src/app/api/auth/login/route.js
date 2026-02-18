import { scryptSync, timingSafeEqual } from "node:crypto";

import { query, ensureUsersTable } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function verifyPassword(password, storedHash) {
  const [salt, hash] = (storedHash || "").split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const hashBuffer = Buffer.from(hash, "hex");
  if (derivedBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedBuffer, hashBuffer);
}

function validatePayload(body) {
  const allowedRoles = new Set(["CUSTOMER", "STAFF", "ADMIN"]);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const expectedRole =
    typeof body?.expectedRole === "string" && body.expectedRole.trim()
      ? body.expectedRole.trim().toUpperCase()
      : null;

  if (!email || !password) {
    return { error: "Please enter email and password." };
  }

  if (expectedRole && !allowedRoles.has(expectedRole)) {
    return { error: "Invalid role." };
  }

  return { email, password, expectedRole };
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

    const result = await query(
      `
        SELECT id, first_name, last_name, email, role, password_hash
        FROM users
        WHERE email = $1
      `,
      [parsed.email]
    );

    if (result.rowCount === 0) {
      return jsonResponse({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = result.rows[0];
    const isValidPassword = verifyPassword(parsed.password, user.password_hash);

    if (!isValidPassword) {
      return jsonResponse({ error: "Invalid email or password." }, { status: 401 });
    }

    if (parsed.expectedRole && user.role !== parsed.expectedRole) {
      return jsonResponse({ error: `This account is not a ${parsed.expectedRole.toLowerCase()} account.` }, { status: 403 });
    }

    return jsonResponse({
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
