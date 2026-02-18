-- Watchlist database setup (safe to re-run)
-- Requires existing tables: users, movies

CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_movie_id ON watchlist(movie_id);

-- Seed sample watchlist entries for customer users and available movies (idempotent)
INSERT INTO watchlist (user_id, movie_id)
SELECT u.id, m.id
FROM users u
JOIN movies m ON m.status IN ('NOW_SHOWING', 'COMING_SOON')
WHERE u.role = 'CUSTOMER'
  AND m.id IN (
    SELECT id
    FROM movies
    WHERE status IN ('NOW_SHOWING', 'COMING_SOON')
    ORDER BY id
    LIMIT 3
  )
  AND NOT EXISTS (
    SELECT 1
    FROM watchlist w
    WHERE w.user_id = u.id
      AND w.movie_id = m.id
  );
