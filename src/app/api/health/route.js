import { ensureItemsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    await ensureItemsTable();
    await query("SELECT 1");

    return jsonResponse({
      ok: true,
      service: "database_project_backend",
      database: "connected"
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Database connection failed",
        details: error.message
      },
      { status: 500 }
    );
  }
}
