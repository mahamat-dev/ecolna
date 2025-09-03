-- Optional indexes for Discipline module
CREATE INDEX IF NOT EXISTS idx_disc_incident_status ON discipline_incident(status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_incident_reporter ON discipline_incident(reported_by_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_participant_profile ON discipline_incident_participant(profile_id);
CREATE INDEX IF NOT EXISTS idx_disc_action_profile ON discipline_action(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detention_datetime ON detention_session(date_time);

