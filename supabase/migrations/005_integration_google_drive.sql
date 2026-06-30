-- Allow the google_drive integration type (the integrations UI offers it, but
-- the original CHECK constraint omitted it).
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;

ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN (
    'google_sheets',
    'google_docs',
    'google_calendar',
    'gmail',
    'google_drive',
    'webhook'
  ));
