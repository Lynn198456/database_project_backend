import { ensureBookingsTables, ensureUsersTable, ensureWatchlistTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseIdentity(url) {
  const { searchParams } = new URL(url);
  const id = Number.parseInt(searchParams.get("id") || "", 10);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  return {
    id: Number.isNaN(id) ? null : id,
    email
  };
}

async function resolveUser(identity) {
  if (identity.id) {
    const byId = await query("SELECT id, email FROM users WHERE id = $1 LIMIT 1", [identity.id]);
    if (byId.rowCount > 0) return byId.rows[0];
  }

  if (identity.email) {
    const byEmail = await query("SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [identity.email]);
    if (byEmail.rowCount > 0) return byEmail.rows[0];
  }

  return null;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureUsersTable();
    await ensureBookingsTables();
    await ensureWatchlistTable();

    const identity = parseIdentity(request.url);
    if (!identity.id && !identity.email) {
      return jsonResponse({ error: "id or email is required." }, { status: 400 });
    }

    const user = await resolveUser(identity);
    if (!user) {
      return jsonResponse({ error: "User not found." }, { status: 404 });
    }

    const metricsResult = await query(
      `
        SELECT
          COALESCE((SELECT COUNT(*)::int FROM watchlist w WHERE w.user_id = $1), 0) AS watchlist_total,
          COALESCE((SELECT COUNT(*)::int FROM bookings b WHERE b.user_id = $1), 0) AS booking_total,
          COALESCE((
            SELECT ROUND(SUM(p.amount)::numeric, 2)
            FROM payments p
            JOIN bookings b2 ON b2.id = p.booking_id
            WHERE b2.user_id = $1
              AND p.status = 'PAID'
          ), 0)::float8 AS paid_total
      `,
      [user.id]
    );

    const row = metricsResult.rows[0] || {};

    return jsonResponse({
      metrics: {
        watchlistTotal: Number(row.watchlist_total || 0),
        bookingTotal: Number(row.booking_total || 0),
        totalSpent: Number(row.paid_total || 0)
      },
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
