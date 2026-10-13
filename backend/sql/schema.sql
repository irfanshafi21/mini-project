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
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS syllabus_questions BIGINT NOT NULL DEFAULT 0 CHECK (syllabus_questions >= 0);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS bank_questions BIGINT NOT NULL DEFAULT 0 CHECK (bank_questions >= 0);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS generated_papers BIGINT NOT NULL DEFAULT 0 CHECK (generated_papers >= 0);
INSERT INTO subjects (name) SELECT DISTINCT subject FROM questions ON CONFLICT (name) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions (subject) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_topic      ON questions (topic)            WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_unit_level ON questions (unit, difficulty) WHERE NOT is_deleted;

-- the same question text cannot be added twice in one unit
DROP INDEX IF EXISTS uq_questions_unit_text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subject_unit_text
  ON questions (subject, unit, lower(text)) WHERE text <> '' AND NOT is_deleted;

-- Preserve existing subjects, then enforce registration at the database layer.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_subject_fk' AND conrelid = 'questions'::regclass) THEN
    ALTER TABLE questions ADD CONSTRAINT questions_subject_fk
      FOREIGN KEY (subject) REFERENCES subjects(name);
  END IF;
END $$;
