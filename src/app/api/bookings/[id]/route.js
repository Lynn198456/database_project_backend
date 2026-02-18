import { ensureBookingsTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

function validatePayload(body) {
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";
  const totalAmount = Number.parseFloat(body?.totalAmount);

  if (!["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"].includes(status)) {
    return { error: "Invalid status." };
  }

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return { error: "totalAmount must be 0 or greater." };
  }

  return { status, totalAmount };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(_request, { params }) {
  try {
    await ensureBookingsTables();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid booking id." }, { status: 400 });

    const bookingResult = await query(
      `
        SELECT b.id, b.user_id, b.showtime_id, b.status, b.total_amount, b.booked_at,
               u.email AS user_email, m.title AS movie_title, s.start_time
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        JOIN showtimes s ON s.id = b.showtime_id
        JOIN movies m ON m.id = s.movie_id
        WHERE b.id = $1
      `,
      [id]
    );

    if (bookingResult.rowCount === 0) return jsonResponse({ error: "Booking not found." }, { status: 404 });

    const seatsResult = await query(
      `
        SELECT id, seat_label, price, created_at
        FROM booking_seats
        WHERE booking_id = $1
        ORDER BY id ASC
      `,
      [id]
    );

    return jsonResponse({ booking: bookingResult.rows[0], seats: seatsResult.rows });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureBookingsTables();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid booking id." }, { status: 400 });

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    const result = await query(
      `
        UPDATE bookings
        SET status = $1, total_amount = $2
        WHERE id = $3
      `,
      [parsed.status, parsed.totalAmount, id]
    );

    if (result.rowCount === 0) return jsonResponse({ error: "Booking not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureBookingsTables();
    const id = parseId(await params);
    if (!id) return jsonResponse({ error: "Invalid booking id." }, { status: 400 });

    const result = await query("DELETE FROM bookings WHERE id = $1", [id]);
    if (result.rowCount === 0) return jsonResponse({ error: "Booking not found." }, { status: 404 });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
