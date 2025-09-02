-- Optional indexes for Assessments module (performance)
-- Safe to run multiple times due to IF NOT EXISTS

-- Question lookups by subject
CREATE INDEX IF NOT EXISTS idx_question_subject ON question(subject_id);

-- Quiz availability queries
CREATE INDEX IF NOT EXISTS idx_quiz_status_window ON quiz(status, open_at, close_at);
CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz(created_at DESC);

-- Audience filtering
CREATE INDEX IF NOT EXISTS idx_quiz_audience_quiz ON quiz_audience(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_audience_scope ON quiz_audience(scope);
CREATE INDEX IF NOT EXISTS idx_quiz_audience_section ON quiz_audience(class_section_id);
CREATE INDEX IF NOT EXISTS idx_quiz_audience_grade ON quiz_audience(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_quiz_audience_subject ON quiz_audience(subject_id);

-- Attempts filtering and grading
CREATE INDEX IF NOT EXISTS idx_attempt_student ON quiz_attempt(student_profile_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempt_status ON quiz_attempt(status);
CREATE INDEX IF NOT EXISTS idx_attempt_question_attempt ON attempt_question(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answer_attempt ON attempt_answer(attempt_id);