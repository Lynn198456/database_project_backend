import { ensureScreensTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const theaterId = Number.parseInt(searchParams.get("theaterId") || "", 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    theaterId: Number.isNaN(theaterId) ? null : theaterId
  };
}

function validatePayload(body) {
  const theaterId = Number.parseInt(body?.theaterId, 10);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const totalSeats = Number.parseInt(body?.totalSeats, 10);

  if (Number.isNaN(theaterId) || theaterId < 1) return { error: "theaterId is required." };
  if (!name) return { error: "name is required." };
  if (Number.isNaN(totalSeats) || totalSeats < 1) return { error: "totalSeats must be greater than 0." };

  return { theaterId, name, totalSeats };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureScreensTable();
    const { page, limit, theaterId } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];

    if (theaterId) {
      values.push(theaterId);
      filters.push(`s.theater_id = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const listValues = [...values, limit, offset];

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT s.id, s.theater_id, s.name, s.total_seats, s.created_at, s.updated_at,
                 t.name AS theater_name
          FROM screens s
          JOIN theaters t ON t.id = s.theater_id
          ${whereClause}
          ORDER BY s.id DESC
          LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
        `,
        listValues
      ),
      query(`SELECT COUNT(*)::int AS total FROM screens s ${whereClause}`, values)
    ]);

    return jsonResponse({ screens: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureScreensTable();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        INSERT INTO screens (theater_id, name, total_seats)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [parsed.theaterId, parsed.name, parsed.totalSeats]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
