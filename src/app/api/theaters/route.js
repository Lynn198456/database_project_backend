import { ensureTheatersTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200)
  };
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

export async function GET(request) {
  try {
    await ensureTheatersTable();
    const { page, limit } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT id, name, location, address, city, created_at, updated_at
          FROM theaters
          ORDER BY id DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      query("SELECT COUNT(*)::int AS total FROM theaters")
    ]);

    return jsonResponse({ theaters: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureTheatersTable();
    const parsed = validatePayload(await request.json());

    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        INSERT INTO theaters (name, location, address, city)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [parsed.name, parsed.location || null, parsed.address || null, parsed.city]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
