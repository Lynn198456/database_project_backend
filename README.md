# Database Project Backend (Next.js + PostgreSQL)

This backend exposes API routes used by the frontend app.

## Stack

- Next.js App Router
- PostgreSQL via `pg`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and set your Postgres URL:

```bash
cp .env.local.example .env.local
```

3. Start the backend:

```bash
npm run dev
```

Backend runs on [http://localhost:4000](http://localhost:4000).

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `FRONTEND_ORIGIN`: allowed frontend origin for CORS (default: `http://localhost:5173`)

## API Endpoints

- `GET /api/health` - health check and database connectivity
- `GET /api/items?page=1&limit=100` - list items
- `POST /api/items` - create item `{ "name": "...", "value": "..." }`
- `GET /api/items/:id` - fetch item
- `PUT /api/items/:id` - update item `{ "name": "...", "value": "..." }`
- `DELETE /api/items/:id` - delete item
- `POST /api/auth/register` - create user account `{ "firstName", "lastName", "email", "phone?", "password", "confirmPassword", "role?" }`
- `POST /api/auth/login` - login user `{ "email", "password", "expectedRole?" }`
- `GET /api/movies`, `POST /api/movies`, `GET|PUT|DELETE /api/movies/:id`
- `GET /api/theaters`, `POST /api/theaters`, `GET|PUT|DELETE /api/theaters/:id`
- `GET /api/showtimes`, `POST /api/showtimes`, `GET|PUT|DELETE /api/showtimes/:id`
- `GET /api/bookings`, `POST /api/bookings`, `GET|PUT|DELETE /api/bookings/:id`
- `GET /api/payments/summary?range=today|week|month|all` - revenue summary from paid payments

## Notes

- The `items` table is created automatically on first API request.
- The API includes CORS headers for the configured frontend origin.
