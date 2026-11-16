CREATE TABLE IF NOT EXISTS destination_comments (
  id UUID PRIMARY KEY,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  author_name VARCHAR(50) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destination_comments_recent
  ON destination_comments (destination_id, created_at DESC);

CREATE TABLE IF NOT EXISTS destination_ratings (
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  voter_key UUID NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (destination_id, voter_key)
);
