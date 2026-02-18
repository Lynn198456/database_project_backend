import { ensureMoviesTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
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

export async function GET(_request, { params }) {
  try {
    await ensureMoviesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid movie id." }, { status: 400 });

    const result = await query(
      `
        SELECT id, title, description, duration_min, rating, release_date, poster_url, status, created_at, updated_at
        FROM movies
        WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Movie not found." }, { status: 404 });

    return jsonResponse({ movie: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureMoviesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid movie id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        UPDATE movies
        SET title = $1, description = $2, duration_min = $3, rating = $4, release_date = $5, poster_url = $6, status = $7, updated_at = NOW()
        WHERE id = $8
      `,
      [parsed.title, parsed.description || null, parsed.durationMin, parsed.rating || null, parsed.releaseDate, parsed.posterUrl || null, parsed.status, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Movie not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureMoviesTable();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid movie id." }, { status: 400 });

    const result = await query("DELETE FROM movies WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Movie not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
