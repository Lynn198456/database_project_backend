import { ensureShowtimesTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const movieId = Number.parseInt(searchParams.get("movieId") || "", 10);
  const screenId = Number.parseInt(searchParams.get("screenId") || "", 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    movieId: Number.isNaN(movieId) ? null : movieId,
    screenId: Number.isNaN(screenId) ? null : screenId
  };
}

function validatePayload(body) {
  const movieId = Number.parseInt(body?.movieId, 10);
  const screenId = Number.parseInt(body?.screenId, 10);
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";
  const price = Number.parseFloat(body?.price);
  const language = typeof body?.language === "string" ? body.language.trim() : "";
  const format = typeof body?.format === "string" ? body.format.trim() : "";

  if (Number.isNaN(movieId) || movieId < 1) return { error: "movieId is required." };
  if (Number.isNaN(screenId) || screenId < 1) return { error: "screenId is required." };
  if (!startTime || !endTime) return { error: "startTime and endTime are required." };
  if (Number.isNaN(price) || price < 0) return { error: "price must be 0 or greater." };

  return { movieId, screenId, startTime, endTime, price, language, format };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureShowtimesTable();
    const { page, limit, movieId, screenId } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];

    if (movieId) {
      values.push(movieId);
      filters.push(`s.movie_id = $${values.length}`);
    }

    if (screenId) {
      values.push(screenId);
      filters.push(`s.screen_id = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const listValues = [...values, limit, offset];

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT s.id, s.movie_id, s.screen_id, s.start_time, s.end_time, s.price, s.language, s.format, s.created_at, s.updated_at,
                 m.title AS movie_title, sc.name AS screen_name, sc.total_seats AS screen_total_seats, t.name AS theater_name
          FROM showtimes s
          JOIN movies m ON m.id = s.movie_id
          JOIN screens sc ON sc.id = s.screen_id
          JOIN theaters t ON t.id = sc.theater_id
          ${whereClause}
          ORDER BY s.start_time ASC
          LIMIT $${listValues.length - 1} OFFSET $${listValues.length}
        `,
        listValues
      ),
      query(`SELECT COUNT(*)::int AS total FROM showtimes s ${whereClause}`, values)
    ]);

    return jsonResponse({ showtimes: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureShowtimesTable();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        INSERT INTO showtimes (movie_id, screen_id, start_time, end_time, price, language, format)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [parsed.movieId, parsed.screenId, parsed.startTime, parsed.endTime, parsed.price, parsed.language || null, parsed.format || null]
    );

    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
