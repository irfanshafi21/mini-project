-- Question Bank schema (PostgreSQL)
-- Question numbers are automatic: the identity column starts at 101, so the API shows Q101, Q102, ...

CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 101) PRIMARY KEY,
  unit        SMALLINT    NOT NULL CHECK (unit BETWEEN 1 AND 5),
  topic       TEXT        NOT NULL,
  subtopic    TEXT        NOT NULL,
  difficulty  TEXT        NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  marks       SMALLINT    NOT NULL CHECK (marks BETWEEN 1 AND 100),
  text        TEXT        NOT NULL DEFAULT '',
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,   -- soft delete, so "undo" is possible
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fast topic-wise search (the HashMap of the Java version)
-- Safe migration: existing questions keep their data under GENERAL.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'GENERAL';
CREATE TABLE IF NOT EXISTS subjects (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO subjects (name) SELECT DISTINCT subject FROM questions ON CONFLICT (name) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions (subject) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_topic      ON questions (topic)            WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_unit_level ON questions (unit, difficulty) WHERE NOT is_deleted;

-- the same question text cannot be added twice in one unit
DROP INDEX IF EXISTS uq_questions_unit_text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subject_unit_text
  ON questions (subject, unit, lower(text)) WHERE text <> '' AND NOT is_deleted;
