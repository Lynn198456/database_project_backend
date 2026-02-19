const defaultOrigin = "http://localhost:5173";

export function buildCorsHeaders() {
  const origin = process.env.FRONTEND_ORIGIN || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

export function jsonResponse(payload, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...buildCorsHeaders(),
    ...(init.headers || {})
  };

  return new Response(JSON.stringify(payload), {
    ...init,
    headers
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders()
  });
}
