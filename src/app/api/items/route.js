import { ensureItemsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "100", 10);

  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const safeLimit = Number.isNaN(limit) || limit < 1 ? 100 : Math.min(limit, 500);

  return { page: safePage, limit: safeLimit };
}

function validatePayload(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const value = typeof body?.value === "string" ? body.value.trim() : "";

  if (!name || !value) {
    return { error: "Both 'name' and 'value' are required." };
  }

  return { name, value };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureItemsTable();
    const { page, limit } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const [itemsResult, countResult] = await Promise.all([
      query(
        `
          SELECT id, name, value, created_at, updated_at
          FROM items
          ORDER BY id DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      query("SELECT COUNT(*)::int AS total FROM items")
    ]);

    return jsonResponse({
      items: itemsResult.rows,
      total: countResult.rows[0].total,
      page,
      limit
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureItemsTable();
    const body = await request.json();
    const parsed = validatePayload(body);

    if (parsed.error) {
      return jsonResponse({ error: parsed.error }, { status: 400 });
    }

    const result = await query(
      `
        INSERT INTO items (name, value)
        VALUES ($1, $2)
        RETURNING id
      `,
      [parsed.name, parsed.value]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
