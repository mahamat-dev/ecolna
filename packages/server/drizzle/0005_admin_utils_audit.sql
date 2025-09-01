-- Migration: extend audit_log for admin utils (audit + search)
-- 1) Add new columns if not exist
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_roles text[],
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- 2) Keep backward-compat columns (already exist):
-- actor_profile_id, action, entity_type, entity_id, description, metadata, created_at

-- 3) Foreign key for actor_user_id
DO $$ BEGIN
  ALTER TABLE audit_log
    ADD CONSTRAINT fk_audit_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_at_desc ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_actor_user ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_meta_gin ON audit_log USING GIN (meta);

-- 5) Optional FTS column + GIN index
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(summary,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(meta::text,'')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_audit_tsv ON audit_log USING GIN (tsv);