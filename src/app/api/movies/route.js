import { ensureMoviesTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const status = searchParams.get("status");

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    status: status ? status.toUpperCase() : null
  };
}

function validatePayload(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const durationMin = Number.parseInt(body?.durationMin, 10);
  const rating = typeof body?.rating === "string" ? body.rating.trim() : "";
  const releaseDate = typeof body?.releaseDate === "string" ? body.releaseDate.trim() : "";
  const posterUrl = typeof body?.posterUrl === "string" ? body.posterUrl.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "COMING_SOON";

  if (!title) return { error: "Title is required." };
  if (Number.isNaN(durationMin) || durationMin <= 0) return { error: "durationMin must be greater than 0." };
  if (!["NOW_SHOWING", "COMING_SOON", "ARCHIVED"].includes(status)) return { error: "Invalid status." };

  return { title, description, durationMin, rating, releaseDate: releaseDate || null, posterUrl, status };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureMoviesTable();
    const { page, limit, status } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const params = [];
    let whereClause = "";
    if (status) {
      params.push(status);
      whereClause = `WHERE status = $${params.length}`;
    }

    params.push(limit, offset);

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT id, title, description, duration_min, rating, release_date, poster_url, status, created_at, updated_at
          FROM movies
          ${whereClause}
          ORDER BY id DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      ),
      query(`SELECT COUNT(*)::int AS total FROM movies ${whereClause}`, status ? [status] : [])
    ]);

    return jsonResponse({
      movies: rowsResult.rows,
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
    await ensureMoviesTable();
    const body = await request.json();
    const parsed = validatePayload(body);

    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        INSERT INTO movies (title, description, duration_min, rating, release_date, poster_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [parsed.title, parsed.description || null, parsed.durationMin, parsed.rating || null, parsed.releaseDate, parsed.posterUrl || null, parsed.status]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
