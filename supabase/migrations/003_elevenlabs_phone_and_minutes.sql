-- Add ElevenLabs phone number ID to phone_numbers table
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id text;

-- Create unique index on elevenlabs_conversation_id for upserts from webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_elevenlabs_conv_id_unique
  ON calls (elevenlabs_conversation_id)
  WHERE elevenlabs_conversation_id IS NOT NULL;

-- RPC to atomically increment minutes_used
CREATE OR REPLACE FUNCTION increment_minutes_used(p_org_id uuid, p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET minutes_used = minutes_used + p_minutes
  WHERE id = p_org_id;
END;
$$;
