-- pending / completed verification attempts.
-- one row per join event that needs (or needed) verifying.
CREATE TABLE IF NOT EXISTS pending_verifications (
  token          TEXT PRIMARY KEY,
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'expired', 'failed')) DEFAULT 'pending',
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  consumed_at    INTEGER,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_verifications_user
  ON pending_verifications (guild_id, user_id);

CREATE INDEX IF NOT EXISTS idx_pending_verifications_status
  ON pending_verifications (status, expires_at);

-- simple audit record of who has been verified, for admin visibility / idempotency.
-- also lets us skip re-DMing someone who is already verified but rejoins.
CREATE TABLE IF NOT EXISTS verified_users (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  verified_at   INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
