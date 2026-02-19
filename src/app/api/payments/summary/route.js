import { ensureBookingsTables, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseRange(url) {
  const { searchParams } = new URL(url);
  const value = (searchParams.get("range") || "week").trim().toLowerCase();

  if (["today", "week", "month", "all"].includes(value)) {
    return value;
  }

  return "week";
}

function getRangeClause(range) {
  if (range === "today") {
    return "AND COALESCE(p.paid_at, p.created_at) >= DATE_TRUNC('day', NOW())";
  }

  if (range === "week") {
    return "AND COALESCE(p.paid_at, p.created_at) >= DATE_TRUNC('week', NOW())";
  }

  if (range === "month") {
    return "AND COALESCE(p.paid_at, p.created_at) >= DATE_TRUNC('month', NOW())";
  }

  return "";
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request) {
  try {
    await ensureBookingsTables();

    const range = parseRange(request.url);
    const rangeClause = getRangeClause(range);

    const result = await query(
      `
        SELECT
          COALESCE(COUNT(*)::int, 0) AS paid_count,
          COALESCE(ROUND(SUM(p.amount)::numeric, 2), 0)::float8 AS paid_total
        FROM payments p
        WHERE p.status = 'PAID'
        ${rangeClause}
      `
    );

    const row = result.rows[0] || {};

    return jsonResponse({
      range,
      revenue: {
        total: Number(row.paid_total || 0),
        paidCount: Number(row.paid_count || 0)
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
