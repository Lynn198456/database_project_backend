import { ensureBookingsTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function validatePayload(body) {
  const bookingId = Number.parseInt(body?.bookingId, 10);
  const amount = Number.parseFloat(body?.amount);
  const method = typeof body?.method === "string" ? body.method.trim().toUpperCase() : "WALLET";
  const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "PAID";
  const transactionRef = typeof body?.transactionRef === "string" ? body.transactionRef.trim() : null;

  if (Number.isNaN(bookingId) || bookingId < 1) return { error: "bookingId is required." };
  if (Number.isNaN(amount) || amount < 0) return { error: "amount must be 0 or greater." };
  if (!["CARD", "CASH", "WALLET", "ONLINE_BANKING"].includes(method)) return { error: "Invalid method." };
  if (!["PENDING", "PAID", "FAILED", "REFUNDED"].includes(status)) return { error: "Invalid status." };

  return { bookingId, amount, method, status, transactionRef };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request) {
  try {
    await ensureBookingsTables();

    const parsed = validatePayload(await request.json());
    if (parsed.error) return jsonResponse({ error: parsed.error }, { status: 400 });

    try {
      const result = await query(
        `
          INSERT INTO payments (booking_id, method, amount, status, paid_at, transaction_ref)
          VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'PAID' THEN NOW() ELSE NULL END, $5)
          RETURNING id
        `,
        [parsed.bookingId, parsed.method, parsed.amount, parsed.status, parsed.transactionRef]
      );

      return jsonResponse({ id: result.rows[0].id }, { status: 201 });
    } catch (error) {
      // Unique transaction_ref already exists: return existing payment id for idempotency.
      if (error?.code === "23505" && parsed.transactionRef) {
        const existing = await query("SELECT id FROM payments WHERE transaction_ref = $1 LIMIT 1", [parsed.transactionRef]);
        if (existing.rowCount > 0) {
          return jsonResponse({ id: existing.rows[0].id, existed: true });
        }
      }
      throw error;
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
