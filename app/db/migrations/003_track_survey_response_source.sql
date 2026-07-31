ALTER TABLE survey_responses
  ADD COLUMN source_system text NOT NULL DEFAULT 'postgres';

ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_source_system
  CHECK (source_system IN ('postgres', 'sanity'));
