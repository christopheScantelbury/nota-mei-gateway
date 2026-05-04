-- Migration: atomic per-MEI RPS sequence (SCALE-01)
-- Replaces the non-atomic SELECT MAX()+1 strategy with a dedicated counter table.
-- Each MEI has exactly one row; concurrent inserts via ON CONFLICT DO UPDATE
-- guarantee that every allocation receives a unique, monotonically-increasing number.

CREATE TABLE IF NOT EXISTS rps_sequences (
  mei_id     UUID    PRIMARY KEY REFERENCES meis(id) ON DELETE CASCADE,
  ultimo_rps BIGINT  NOT NULL DEFAULT 0
);

-- RLS: the Go backend uses service_role (bypasses RLS), so we enable it but
-- do not create user-facing policies — MEIs never query this table directly.
ALTER TABLE rps_sequences ENABLE ROW LEVEL SECURITY;

-- Index is implicit on the PRIMARY KEY; no additional indexes needed.

COMMENT ON TABLE  rps_sequences           IS 'Atomic per-MEI RPS counter — allocated by INSERT ON CONFLICT DO UPDATE.';
COMMENT ON COLUMN rps_sequences.ultimo_rps IS 'Last allocated RPS number for this MEI. Starts at 0; first issued RPS is 1.';
