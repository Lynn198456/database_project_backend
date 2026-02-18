-- Schedule database setup for movies (safe to re-run)

-- 1) Theaters
CREATE TABLE IF NOT EXISTS theaters (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Screens
CREATE TABLE IF NOT EXISTS screens (
  id BIGSERIAL PRIMARY KEY,
  theater_id BIGINT NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_seats INT NOT NULL CHECK (total_seats > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (theater_id, name)
);

-- 3) Showtimes
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

-- Seed theaters (idempotent)
INSERT INTO theaters (name, location, address, city)
SELECT * FROM (
  VALUES
    ('Cinema Listic Central', 'Downtown', '123 Main St', 'Bangkok'),
    ('Cinema Listic Riverside', 'Riverside', '88 River Rd', 'Bangkok')
) AS t(name, location, address, city)
WHERE NOT EXISTS (
  SELECT 1 FROM theaters x WHERE LOWER(x.name) = LOWER(t.name)
);

-- Seed screens (idempotent)
INSERT INTO screens (theater_id, name, total_seats)
SELECT th.id, s.name, s.total_seats
FROM (
  VALUES
    ('Cinema Listic Central', 'Screen 1', 120),
    ('Cinema Listic Central', 'Screen 2', 100),
    ('Cinema Listic Central', 'IMAX', 180),
    ('Cinema Listic Riverside', 'Screen 1', 110),
    ('Cinema Listic Riverside', 'Screen 2', 90)
) AS s(theater_name, name, total_seats)
JOIN theaters th ON th.name = s.theater_name
WHERE NOT EXISTS (
  SELECT 1
  FROM screens sc
  WHERE sc.theater_id = th.id
    AND LOWER(sc.name) = LOWER(s.name)
);

-- Seed showtimes for movies from movies_setup.sql (idempotent)
-- NOW_SHOWING movies get multiple slots; COMING_SOON gets preview slots.
WITH movie_ids AS (
  SELECT id, title FROM movies
), screen_ids AS (
  SELECT sc.id, sc.name AS screen_name, th.name AS theater_name
  FROM screens sc
  JOIN theaters th ON th.id = sc.theater_id
), seed AS (
  SELECT * FROM (
    VALUES
      -- Dune: Part Two (NOW_SHOWING)
      ('Dune: Part Two', 'Cinema Listic Central', 'IMAX', TIMESTAMPTZ '2026-02-19 10:00:00+07', TIMESTAMPTZ '2026-02-19 12:46:00+07', 280.00, 'English', 'IMAX'),
      ('Dune: Part Two', 'Cinema Listic Central', 'Screen 1', TIMESTAMPTZ '2026-02-19 14:00:00+07', TIMESTAMPTZ '2026-02-19 16:46:00+07', 220.00, 'English', '2D'),
      ('Dune: Part Two', 'Cinema Listic Riverside', 'Screen 1', TIMESTAMPTZ '2026-02-20 19:00:00+07', TIMESTAMPTZ '2026-02-20 21:46:00+07', 210.00, 'English', '2D'),

      -- Inside Out 2 (NOW_SHOWING)
      ('Inside Out 2', 'Cinema Listic Central', 'Screen 2', TIMESTAMPTZ '2026-02-19 11:00:00+07', TIMESTAMPTZ '2026-02-19 12:36:00+07', 180.00, 'English', '2D'),
      ('Inside Out 2', 'Cinema Listic Central', 'Screen 2', TIMESTAMPTZ '2026-02-19 15:30:00+07', TIMESTAMPTZ '2026-02-19 17:06:00+07', 180.00, 'English', '2D'),
      ('Inside Out 2', 'Cinema Listic Riverside', 'Screen 2', TIMESTAMPTZ '2026-02-20 13:15:00+07', TIMESTAMPTZ '2026-02-20 14:51:00+07', 170.00, 'English', '2D'),

      -- Oppenheimer (NOW_SHOWING)
      ('Oppenheimer', 'Cinema Listic Riverside', 'Screen 1', TIMESTAMPTZ '2026-02-19 18:00:00+07', TIMESTAMPTZ '2026-02-19 21:00:00+07', 200.00, 'English', '2D'),
      ('Oppenheimer', 'Cinema Listic Central', 'IMAX', TIMESTAMPTZ '2026-02-20 20:00:00+07', TIMESTAMPTZ '2026-02-20 23:00:00+07', 260.00, 'English', 'IMAX'),

      -- COMING_SOON preview slots
      ('Spider-Man: Beyond the Spider-Verse', 'Cinema Listic Central', 'Screen 1', TIMESTAMPTZ '2026-06-05 13:00:00+07', TIMESTAMPTZ '2026-06-05 15:20:00+07', 220.00, 'English', '2D'),
      ('Spider-Man: Beyond the Spider-Verse', 'Cinema Listic Central', 'IMAX', TIMESTAMPTZ '2026-06-06 19:30:00+07', TIMESTAMPTZ '2026-06-06 21:50:00+07', 260.00, 'English', 'IMAX'),
      ('The Batman Part II', 'Cinema Listic Riverside', 'Screen 2', TIMESTAMPTZ '2026-10-03 19:30:00+07', TIMESTAMPTZ '2026-10-03 22:15:00+07', 240.00, 'English', '2D'),
      ('The Batman Part II', 'Cinema Listic Central', 'IMAX', TIMESTAMPTZ '2026-10-04 20:00:00+07', TIMESTAMPTZ '2026-10-04 22:45:00+07', 280.00, 'English', 'IMAX')
  ) AS x(movie_title, theater_name, screen_name, start_time, end_time, price, language, format)
)
INSERT INTO showtimes (movie_id, screen_id, start_time, end_time, price, language, format)
SELECT m.id, sc.id, s.start_time, s.end_time, s.price, s.language, s.format
FROM seed s
JOIN movie_ids m ON m.title = s.movie_title
JOIN screen_ids sc ON sc.theater_name = s.theater_name AND sc.screen_name = s.screen_name
WHERE NOT EXISTS (
  SELECT 1
  FROM showtimes st
  WHERE st.movie_id = m.id
    AND st.screen_id = sc.id
    AND st.start_time = s.start_time
);

-- February 2026 full-month schedule (2026-02-01 to 2026-02-28), safe re-run
WITH feb_days AS (
  SELECT d::date AS show_date
  FROM generate_series(DATE '2026-02-01', DATE '2026-02-28', INTERVAL '1 day') d
),
feb_templates AS (
  SELECT * FROM (
    VALUES
      ('Dune: Part Two', 'Cinema Listic Central', 'IMAX', TIME '10:00', 166, 280.00, 'English', 'IMAX'),
      ('Dune: Part Two', 'Cinema Listic Central', 'Screen 1', TIME '18:30', 166, 220.00, 'English', '2D'),
      ('Inside Out 2', 'Cinema Listic Central', 'Screen 2', TIME '13:15', 96, 180.00, 'English', '2D'),
      ('Inside Out 2', 'Cinema Listic Riverside', 'Screen 2', TIME '16:30', 96, 170.00, 'English', '2D'),
      ('Oppenheimer', 'Cinema Listic Riverside', 'Screen 1', TIME '20:00', 180, 200.00, 'English', '2D')
  ) AS t(movie_title, theater_name, screen_name, start_clock, duration_min, price, language, format)
),
feb_seed AS (
  SELECT
    t.movie_title,
    t.theater_name,
    t.screen_name,
    (d.show_date + t.start_clock)::timestamptz + INTERVAL '7 hours' AS start_time,
    (d.show_date + t.start_clock + (t.duration_min || ' minutes')::interval)::timestamptz + INTERVAL '7 hours' AS end_time,
    t.price,
    t.language,
    t.format
  FROM feb_days d
  CROSS JOIN feb_templates t
)
INSERT INTO showtimes (movie_id, screen_id, start_time, end_time, price, language, format)
SELECT m.id, sc.id, fs.start_time, fs.end_time, fs.price, fs.language, fs.format
FROM feb_seed fs
JOIN movies m ON m.title = fs.movie_title
JOIN screen_ids sc ON sc.theater_name = fs.theater_name AND sc.screen_name = fs.screen_name
WHERE NOT EXISTS (
  SELECT 1
  FROM showtimes st
  WHERE st.movie_id = m.id
    AND st.screen_id = sc.id
    AND st.start_time = fs.start_time
);

CREATE INDEX IF NOT EXISTS idx_showtimes_movie_id ON showtimes(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_screen_id ON showtimes(screen_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_start_time ON showtimes(start_time);

-- Optional fallback seed:
-- Create one sample slot for any movie that still has no showtimes.
INSERT INTO showtimes (movie_id, screen_id, start_time, end_time, price, language, format)
SELECT
  m.id,
  sc.id,
  TIMESTAMPTZ '2026-12-01 12:00:00+07' + (ROW_NUMBER() OVER (ORDER BY m.id) - 1) * INTERVAL '3 hours',
  TIMESTAMPTZ '2026-12-01 14:00:00+07' + (ROW_NUMBER() OVER (ORDER BY m.id) - 1) * INTERVAL '3 hours',
  180.00,
  'English',
  '2D'
FROM movies m
CROSS JOIN LATERAL (
  SELECT s.id
  FROM screens s
  ORDER BY s.id
  LIMIT 1
) sc
WHERE NOT EXISTS (
  SELECT 1
  FROM showtimes st
  WHERE st.movie_id = m.id
);
