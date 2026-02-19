const defaultAllowedOrigins = [
  "http://localhost:5173",
  "https://cinema-listic-db-project.pages.dev"
];

function readAllowedOrigins() {
  const envOrigins = String(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...defaultAllowedOrigins, ...envOrigins])];
}

function resolveOrigin(requestOrigin) {
  const allowedOrigins = readAllowedOrigins();

  if (!requestOrigin) {
    return "*";
  }

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (requestOrigin.endsWith(".pages.dev")) {
    return requestOrigin;
  }

  if (requestOrigin.includes("localhost")) {
    return requestOrigin;
  }

  return allowedOrigins[0];
}

export function buildCorsHeaders(request) {
  const requestOrigin = request?.headers?.get("origin");
  const allowedOrigin = resolveOrigin(requestOrigin);

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin"
  };
}

export function jsonResponse(payload, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...buildCorsHeaders(init.request),
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
