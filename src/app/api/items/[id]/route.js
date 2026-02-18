import { ensureItemsTable, query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/cors";

function parseId(params) {
  const id = Number.parseInt(params.id, 10);

  if (Number.isNaN(id) || id < 1) {
    return null;
  }

  return id;
}

function validatePayload(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const value = typeof body?.value === "string" ? body.value.trim() : "";

  if (!name || !value) {
    return { error: "Both 'name' and 'value' are required." };
  }

  return { name, value };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(_request, { params }) {
  try {
    await ensureItemsTable();
    const resolvedParams = await params;
    const id = parseId(resolvedParams);

    if (!id) {
      return jsonResponse({ error: "Invalid item id." }, { status: 400 });
    }

    const result = await query(
      `
        SELECT id, name, value, created_at, updated_at
        FROM items
        WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return jsonResponse({ error: "Item not found." }, { status: 404 });
    }

    return jsonResponse({ item: result.rows[0] });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureItemsTable();
    const resolvedParams = await params;
    const id = parseId(resolvedParams);

    if (!id) {
      return jsonResponse({ error: "Invalid item id." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = validatePayload(body);

    if (parsed.error) {
      return jsonResponse({ error: parsed.error }, { status: 400 });
    }

    const result = await query(
      `
        UPDATE items
        SET name = $1, value = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [parsed.name, parsed.value, id]
    );

    if (result.rowCount === 0) {
      return jsonResponse({ error: "Item not found." }, { status: 404 });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureItemsTable();
    const resolvedParams = await params;
    const id = parseId(resolvedParams);

    if (!id) {
      return jsonResponse({ error: "Invalid item id." }, { status: 400 });
    }

    const result = await query("DELETE FROM items WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return jsonResponse({ error: "Item not found." }, { status: 404 });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}
