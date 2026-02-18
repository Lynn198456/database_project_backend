import { ensureTheatersTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

function validatePayload(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const city = typeof body?.city === "string" ? body.city.trim() : "";

  if (!name || !city) return { error: "name and city are required." };

  return { name, location, address, city };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(_request, { params }) {
  try {
    await ensureTheatersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid theater id." }, { status: 400 });

    const result = await query(
      `
        SELECT id, name, location, address, city, created_at, updated_at
        FROM theaters
        WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Theater not found." }, { status: 404 });

    return jsonResponse({ theater: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureTheatersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid theater id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        UPDATE theaters
        SET name = $1, location = $2, address = $3, city = $4, updated_at = NOW()
        WHERE id = $5
      `,
      [parsed.name, parsed.location || null, parsed.address || null, parsed.city, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Theater not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureTheatersTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid theater id." }, { status: 400 });

    const result = await query("DELETE FROM theaters WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Theater not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
