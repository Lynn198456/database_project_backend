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
let watchlistTableInitPromise;
let teamMembersTableInitPromise;
let staffScheduleTablesInitPromise;
let staffTasksTableInitPromise;
let staffTimeRecordsTableInitPromise;

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
    usersTableInitPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          profile_photo TEXT,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'CUSTOMER',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS profile_photo TEXT;
      `);
    })();
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

export async function ensureWatchlistTable() {
  if (!watchlistTableInitPromise) {
    watchlistTableInitPromise = (async () => {
      await ensureUsersTable();
      await ensureMoviesTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS watchlist (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, movie_id)
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_watchlist_user_id
          ON watchlist(user_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_watchlist_movie_id
          ON watchlist(movie_id);
      `);
    })();
  }

  await watchlistTableInitPromise;
}

export async function ensureTeamMembersTable() {
  if (!teamMembersTableInitPromise) {
    teamMembersTableInitPromise = (async () => {
      await ensureTheatersTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS team_members (
          id BIGSERIAL PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          role TEXT NOT NULL,
          department TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          theater_id BIGINT REFERENCES theaters(id) ON DELETE SET NULL,
          hired_at DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
          CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE'))
        );
      `);
    })();
  }

  await teamMembersTableInitPromise;
}

export async function ensureStaffScheduleTables() {
  if (!staffScheduleTablesInitPromise) {
    staffScheduleTablesInitPromise = (async () => {
      await ensureTeamMembersTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_schedules (
          id BIGSERIAL PRIMARY KEY,
          team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
          shift_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          role_on_shift TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'SCHEDULED',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (end_time > start_time),
          CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
          UNIQUE (team_member_id, shift_date, start_time)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_time_off_requests (
          id BIGSERIAL PRIMARY KEY,
          team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
          request_type TEXT NOT NULL DEFAULT 'VACATION',
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          partial_day BOOLEAN NOT NULL DEFAULT FALSE,
          partial_start_time TIME,
          partial_end_time TIME,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (request_type IN ('VACATION', 'SICK', 'PERSONAL', 'OTHER')),
          CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
          CHECK (end_date >= start_date)
        );
      `);
    })();
  }

  await staffScheduleTablesInitPromise;
}

export async function ensureStaffTasksTable() {
  if (!staffTasksTableInitPromise) {
    staffTasksTableInitPromise = (async () => {
      await ensureTeamMembersTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_tasks (
          id BIGSERIAL PRIMARY KEY,
          team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT NOT NULL DEFAULT 'MEDIUM',
          due_date DATE,
          due_time TIME,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
          CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_tasks_member_status
          ON staff_tasks(team_member_id, status);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_tasks_due_date
          ON staff_tasks(due_date);
      `);
    })();
  }

  await staffTasksTableInitPromise;
}

export async function ensureStaffTimeRecordsTable() {
  if (!staffTimeRecordsTableInitPromise) {
    staffTimeRecordsTableInitPromise = (async () => {
      await ensureTeamMembersTable();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_time_records (
          id BIGSERIAL PRIMARY KEY,
          team_member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
          work_date DATE NOT NULL,
          clock_in_at TIMESTAMPTZ NOT NULL,
          clock_out_at TIMESTAMPTZ,
          break_minutes INT NOT NULL DEFAULT 0,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'CLOCKED_IN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (break_minutes >= 0),
          CHECK (status IN ('CLOCKED_IN', 'COMPLETED', 'MISSED', 'ABSENT')),
          UNIQUE (team_member_id, work_date)
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_time_records_member_date
          ON staff_time_records(team_member_id, work_date);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_staff_time_records_date
          ON staff_time_records(work_date);
      `);
    })();
  }

  await staffTimeRecordsTableInitPromise;
}
