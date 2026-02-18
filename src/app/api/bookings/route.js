import { ensureBookingsTables, query, withTransaction } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parsePagination(url) {
  const { searchParams } = new URL(url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const userId = Number.parseInt(searchParams.get("userId") || "", 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200),
    userId: Number.isNaN(userId) ? null : userId
  };
}

function validatePayload(body) {
  const userId = Number.parseInt(body?.userId, 10);
  const showtimeId = Number.parseInt(body?.showtimeId, 10);
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "CONFIRMED";
  const totalAmount = Number.parseFloat(body?.totalAmount);
  const seats = Array.isArray(body?.seats) ? body.seats : [];

  if (Number.isNaN(userId) || userId < 1) return { error: "userId is required." };
  if (Number.isNaN(showtimeId) || showtimeId < 1) return { error: "showtimeId is required." };
  if (Number.isNaN(totalAmount) || totalAmount < 0) return { error: "totalAmount must be 0 or greater." };
  if (!["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"].includes(status)) return { error: "Invalid status." };

  return { userId, showtimeId, status, totalAmount, seats };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureBookingsTables();
    const { page, limit, userId } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    const params = [];
    let whereClause = "";

    if (userId) {
      params.push(userId);
      whereClause = `WHERE b.user_id = $${params.length}`;
    }

    params.push(limit, offset);

    const [rowsResult, countResult] = await Promise.all([
      query(
        `
          SELECT b.id, b.user_id, b.showtime_id, b.status, b.total_amount, b.booked_at,
                 u.email AS user_email, m.title AS movie_title, s.start_time
          FROM bookings b
          JOIN users u ON u.id = b.user_id
          JOIN showtimes s ON s.id = b.showtime_id
          JOIN movies m ON m.id = s.movie_id
          ${whereClause}
          ORDER BY b.id DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      ),
      query(`SELECT COUNT(*)::int AS total FROM bookings b ${whereClause}`, userId ? [userId] : [])
    ]);

    return jsonResponse({ bookings: rowsResult.rows, total: countResult.rows[0].total, page, limit });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureBookingsTables();
    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const normalizedSeats = [];
    for (const seat of parsed.seats) {
      const seatLabel = typeof seat?.seatLabel === "string" ? seat.seatLabel.trim() : "";
      const seatPrice = Number.parseFloat(seat?.price);

      if (!seatLabel || Number.isNaN(seatPrice) || seatPrice < 0) {
        return jsonResponse({ error: "Each seat must include seatLabel and non-negative price." }, { status: 400 });
      }
      normalizedSeats.push({ seatLabel, seatPrice });
    }

    const bookingId = await withTransaction(async (client) => {
      const bookingResult = await client.query(
        `
          INSERT INTO bookings (user_id, showtime_id, status, total_amount)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [parsed.userId, parsed.showtimeId, parsed.status, parsed.totalAmount]
      );

      const createdBookingId = bookingResult.rows[0].id;

      for (const seat of normalizedSeats) {
        await client.query(
          `
            INSERT INTO booking_seats (booking_id, seat_label, price)
            VALUES ($1, $2, $3)
          `,
          [createdBookingId, seat.seatLabel, seat.seatPrice]
        );
      }

      return createdBookingId;
    });

    return jsonResponse({ id: bookingId }, { status: 201 });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
