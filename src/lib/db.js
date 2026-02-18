import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const globalForDb = globalThis;

const pool =
  globalForDb.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

let tableInitPromise;
let usersTableInitPromise;
let moviesTableInitPromise;
let theatersTableInitPromise;
let screensTableInitPromise;
let showtimesTableInitPromise;
let bookingsTablesInitPromise;

export async function ensureItemsTable() {
  if (!tableInitPromise) {
    tableInitPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  await tableInitPromise;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureUsersTable() {
  if (!usersTableInitPromise) {
    usersTableInitPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CUSTOMER',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  await usersTableInitPromise;
}

export async function ensureMoviesTable() {
  if (!moviesTableInitPromise) {
    moviesTableInitPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS movies (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        duration_min INT NOT NULL CHECK (duration_min > 0),
        rating TEXT,
        release_date DATE,
        poster_url TEXT,
        status TEXT NOT NULL DEFAULT 'COMING_SOON',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (status IN ('NOW_SHOWING', 'COMING_SOON', 'ARCHIVED'))
      );
    `);
  }

  await moviesTableInitPromise;
}

export async function ensureTheatersTable() {
  if (!theatersTableInitPromise) {
    theatersTableInitPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS theaters (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        address TEXT,
        city TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  await theatersTableInitPromise;
}

export async function ensureScreensTable() {
  if (!screensTableInitPromise) {
    screensTableInitPromise = (async () => {
      await ensureTheatersTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS screens (
          id BIGSERIAL PRIMARY KEY,
          theater_id BIGINT NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          total_seats INT NOT NULL CHECK (total_seats > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (theater_id, name)
        );
      `);
    })();
  }

  await screensTableInitPromise;
}

export async function ensureShowtimesTable() {
  if (!showtimesTableInitPromise) {
    showtimesTableInitPromise = (async () => {
      await ensureMoviesTable();
      await ensureScreensTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS showtimes (
          id BIGSERIAL PRIMARY KEY,
          movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
          screen_id BIGINT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
          language TEXT,
          format TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (end_time > start_time)
        );
      `);
    })();
  }

  await showtimesTableInitPromise;
}

export async function ensureBookingsTables() {
  if (!bookingsTablesInitPromise) {
    bookingsTablesInitPromise = (async () => {
      await ensureUsersTable();
      await ensureShowtimesTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          showtime_id BIGINT NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'PENDING',
          total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
          booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED'))
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS booking_seats (
          id BIGSERIAL PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          seat_label TEXT NOT NULL,
          price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (booking_id, seat_label)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id BIGSERIAL PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          method TEXT NOT NULL,
          amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
          status TEXT NOT NULL DEFAULT 'PENDING',
          paid_at TIMESTAMPTZ,
          transaction_ref TEXT UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (method IN ('CARD', 'CASH', 'WALLET', 'ONLINE_BANKING')),
          CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'))
        );
      `);
    })();
  }

  await bookingsTablesInitPromise;
}
