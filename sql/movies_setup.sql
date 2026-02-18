-- Create movies table
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

-- Seed starter movies (safe re-run)
INSERT INTO movies (title, description, duration_min, rating, release_date, poster_url, status)
SELECT * FROM (
  VALUES
    ('Dune: Part Two', 'Paul Atreides unites with the Fremen and seeks revenge against conspirators.', 166, 'PG-13', DATE '2024-03-01', NULL, 'NOW_SHOWING'),
    ('Oppenheimer', 'A scientist faces the moral cost of creating the atomic bomb.', 180, 'R', DATE '2023-07-21', NULL, 'NOW_SHOWING'),
    ('Inside Out 2', 'Riley''s emotions face new challenges in her teen years.', 96, 'PG', DATE '2024-06-14', NULL, 'NOW_SHOWING'),
    ('Spider-Man: Beyond the Spider-Verse', 'Miles Morales returns for a multiverse journey.', 140, 'PG-13', DATE '2026-06-04', NULL, 'COMING_SOON'),
    ('The Batman Part II', 'Gotham faces a new wave of crime and fear.', 165, 'PG-13', DATE '2026-10-02', NULL, 'COMING_SOON'),
    ('Interstellar', 'A team travels through a wormhole to save humanity.', 169, 'PG-13', DATE '2014-11-07', NULL, 'ARCHIVED'),
    ('The Dark Knight', 'Batman confronts the Joker in Gotham City.', 152, 'PG-13', DATE '2008-07-18', NULL, 'ARCHIVED'),
    ('Parasite', 'A poor family infiltrates a wealthy household.', 132, 'R', DATE '2019-05-30', NULL, 'ARCHIVED')
) AS seed(title, description, duration_min, rating, release_date, poster_url, status)
WHERE NOT EXISTS (
  SELECT 1 FROM movies m WHERE LOWER(m.title) = LOWER(seed.title)
);
