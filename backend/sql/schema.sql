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
CREATE TABLE IF NOT EXISTS syllabus_history (
  subject TEXT NOT NULL REFERENCES subjects(name),
  syllabus_hash TEXT NOT NULL,
  question_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(subject, syllabus_hash, question_hash)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_subject_fk' AND conrelid = 'questions'::regclass) THEN
    ALTER TABLE questions ADD CONSTRAINT questions_subject_fk
      FOREIGN KEY (subject) REFERENCES subjects(name);
  END IF;
END $$;

-- Stable snapshots let a paper be retrieved even after bank questions are edited.
CREATE TABLE IF NOT EXISTS saved_papers (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject TEXT NOT NULL REFERENCES subjects(name),
  title TEXT NOT NULL,
  paper JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE saved_papers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_saved_papers_subject ON saved_papers(subject, id DESC);

-- LIST partitions are physical subject tables behind the shared questions API.
-- Existing rows and IDs are copied atomically before the old table is removed.
DO $$
DECLARE entry RECORD; partition_name TEXT; next_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_partitioned_table WHERE partrelid='questions'::regclass) THEN
    ALTER TABLE questions RENAME TO questions_before_partition;
    CREATE TABLE questions (LIKE questions_before_partition INCLUDING DEFAULTS INCLUDING IDENTITY INCLUDING CONSTRAINTS)
      PARTITION BY LIST(subject);
    ALTER TABLE questions ADD PRIMARY KEY(id,subject);
    FOR entry IN SELECT name FROM subjects LOOP
      partition_name := 'questions_' || left(regexp_replace(lower(entry.name),'[^a-z0-9]+','_','g'),24) || '_' || substr(md5(entry.name),1,12);
      EXECUTE format('CREATE TABLE %I PARTITION OF questions FOR VALUES IN (%L)', partition_name,entry.name);
    END LOOP;
    INSERT INTO questions OVERRIDING SYSTEM VALUE SELECT * FROM questions_before_partition;
    SELECT greatest(coalesce(max(id),100)::bigint+1,101) INTO next_id FROM questions;
    PERFORM setval(pg_get_serial_sequence('questions','id'),next_id,false);
    DROP TABLE questions_before_partition;
    ALTER TABLE questions ADD CONSTRAINT questions_subject_fk FOREIGN KEY(subject) REFERENCES subjects(name);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_questions_unit_level ON questions(unit,difficulty) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subject_unit_text ON questions(subject,unit,lower(text)) WHERE text<>'' AND NOT is_deleted;
CREATE OR REPLACE FUNCTION create_subject_question_table() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE partition_name TEXT;
BEGIN
  partition_name := 'questions_' || left(regexp_replace(lower(NEW.name),'[^a-z0-9]+','_','g'),24) || '_' || substr(md5(NEW.name),1,12);
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF questions FOR VALUES IN (%L)', partition_name,NEW.name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS subject_question_table ON subjects;
CREATE TRIGGER subject_question_table AFTER INSERT ON subjects FOR EACH ROW EXECUTE FUNCTION create_subject_question_table();
CREATE OR REPLACE VIEW subject_storage AS SELECT name AS subject,
  'questions_' || left(regexp_replace(lower(name),'[^a-z0-9]+','_','g'),24) || '_' || substr(md5(name),1,12) AS table_name FROM subjects;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'SHORT' CHECK(question_type IN ('SHORT','MCQ','FILL_BLANK'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer TEXT NOT NULL DEFAULT '';

-- Unassigned papers/history do not create academic subjects.
ALTER TABLE saved_papers ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE syllabus_history DROP CONSTRAINT IF EXISTS syllabus_history_pkey;
ALTER TABLE syllabus_history ALTER COLUMN subject DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_syllabus_history_scope ON syllabus_history(subject,syllabus_hash,question_hash) NULLS NOT DISTINCT;

CREATE TABLE IF NOT EXISTS reviewed_examples (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES saved_papers(id),
  question_index INTEGER NOT NULL CHECK(question_index BETWEEN 0 AND 49),
  topic TEXT NOT NULL,
  label TEXT NOT NULL CHECK(label IN ('concept','process','comparison','numerical')),
  question JSONB NOT NULL,
  question_hash TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(paper_id,question_index)
);
CREATE TABLE IF NOT EXISTS model_training_runs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE syllabus_history ADD COLUMN IF NOT EXISTS signature_hash TEXT;
