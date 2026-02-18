import { ensureShowtimesTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
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

export async function GET(_request, { params }) {
  try {
    await ensureShowtimesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid showtime id." }, { status: 400 });

    const result = await query(
      `
        SELECT s.id, s.movie_id, s.screen_id, s.start_time, s.end_time, s.price, s.language, s.format, s.created_at, s.updated_at,
               m.title AS movie_title, sc.name AS screen_name, sc.total_seats AS screen_total_seats, t.name AS theater_name
        FROM showtimes s
        JOIN movies m ON m.id = s.movie_id
        JOIN screens sc ON sc.id = s.screen_id
        JOIN theaters t ON t.id = sc.theater_id
        WHERE s.id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Showtime not found." }, { status: 404 });

    return jsonResponse({ showtime: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureShowtimesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid showtime id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        UPDATE showtimes
        SET movie_id = $1, screen_id = $2, start_time = $3, end_time = $4, price = $5, language = $6, format = $7, updated_at = NOW()
        WHERE id = $8
      `,
      [parsed.movieId, parsed.screenId, parsed.startTime, parsed.endTime, parsed.price, parsed.language || null, parsed.format || null, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Showtime not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureShowtimesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid showtime id." }, { status: 400 });

    const result = await query("DELETE FROM showtimes WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Showtime not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
