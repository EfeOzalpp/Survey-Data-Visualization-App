CREATE TABLE survey_responses (
  id text PRIMARY KEY,
  section text NOT NULL CHECK (char_length(section) BETWEEN 1 AND 80),
  q1 numeric(4, 3) NOT NULL CHECK (q1 BETWEEN 0 AND 1),
  q2 numeric(4, 3) NOT NULL CHECK (q2 BETWEEN 0 AND 1),
  q3 numeric(4, 3) NOT NULL CHECK (q3 BETWEEN 0 AND 1),
  q4 numeric(4, 3) NOT NULL CHECK (q4 BETWEEN 0 AND 1),
  q5 numeric(4, 3) NOT NULL CHECK (q5 BETWEEN 0 AND 1),
  avg_weight numeric(4, 3) NOT NULL CHECK (avg_weight BETWEEN 0 AND 1),
  solo_message varchar(160),
  solo_message_updated_at timestamptz,
  submitted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key_sha256 char(64) UNIQUE,
  CONSTRAINT survey_responses_idempotency_key_format
    CHECK (
      idempotency_key_sha256 IS NULL
      OR idempotency_key_sha256 ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX survey_responses_newest_idx
  ON survey_responses (submitted_at DESC, id DESC);

CREATE INDEX survey_responses_section_newest_idx
  ON survey_responses (section, submitted_at DESC, id DESC);
