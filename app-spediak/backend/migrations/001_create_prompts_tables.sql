-- Create a function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the 'prompts' table to store the current state of each prompt
CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    prompt_name VARCHAR(255) UNIQUE NOT NULL,
    prompt_content TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by VARCHAR(255),
    username VARCHAR(255),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply the timestamp trigger to the 'prompts' table
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON prompts
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Create the 'prompt_versions' table to store the history of prompt changes
CREATE TABLE IF NOT EXISTS prompt_versions (
    id SERIAL PRIMARY KEY,
    prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    prompt_content TEXT NOT NULL,
    updated_by_id VARCHAR(255) NOT NULL,
    updated_by_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the initial prompts into the new 'prompts' table
-- This will only run if the prompts do not already exist
INSERT INTO prompts (prompt_name, prompt_content)
VALUES 
    ('preliminary_description_prompt', '{\n  "prompt_name": "DDID Home Inspection Support - Spediak",\n  "version": "1.2",\n  "primary_directive": {\n    "use_ddid_template": true,\n    "inspector_notes_only": true,\n    "image_reference_restriction": true\n  },\n  "ddid_template": "Refer to the ''ddid_template'' block in the DDID Home Inspection Support prompt (version 1.0) for authoritative definitions of Describe, Determine, Implication, and Direction. This prompt does not locally redefine the template to ensure centralized update control. This prompt implements DDID logic version 1.2, inheriting the DDID template structure and phrasing logic from version 1.0. Refer to Main Prompt version 1.2 for logic routing, exception handling, and fallback scenarios for module behavior replication.",\n  "modules": {}\n}')
ON CONFLICT (prompt_name) DO NOTHING;

INSERT INTO prompts (prompt_name, prompt_content)
VALUES
    ('ddid_prompt', '{\n  "prompt_name": "DDID Home Inspection Support",\n  "version": "1.0",\n  "primary_directive": {\n    "use_ddid_template": true,\n    "inspector_notes_only": true,\n    "image_reference_restriction": true\n  },\n  "ddid_template": {\n    "DESCRIBE": "Clearly outline the observed condition or defect, using the inspector''s wording if provided. Add necessary context to ensure clarity for non-technical readers. Do not include phrases such as ''as noted by the inspector'' or ''based on the inspector''s observation''—simply state the condition as described.",\n    "DETERMINE": "Briefly explain what system or component is affected, helping the reader understand the area of concern."\n  }\n}')
ON CONFLICT (prompt_name) DO NOTHING;

-- Set the sequence for prompt_versions correctly
-- This ensures the version number starts from the latest version + 1
CREATE OR REPLACE FUNCTION set_initial_version_sequence()
RETURNS TRIGGER AS $$
DECLARE
    max_version INT;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO max_version FROM prompt_versions WHERE prompt_id = NEW.id;
    -- This trigger is for versioning, so we don't need to set a version number here.
    -- The version number will be set in the application logic before creating a new version.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The logic for versioning will be handled in the application code.
-- The application will query the max version for a prompt and insert the new record with version + 1.

COMMENT ON COLUMN prompts.is_locked IS 'True if an admin is currently editing this prompt.';
COMMENT ON COLUMN prompts.locked_by IS 'The user ID of the admin who locked the prompt.';
COMMENT ON COLUMN prompts.username IS 'The username of the admin who locked the prompt.';
COMMENT ON COLUMN prompt_versions.prompt_id IS 'Foreign key to the prompts table.';
COMMENT ON COLUMN prompt_versions.version IS 'The version number of this prompt history record.';
COMMENT ON COLUMN prompt_versions.updated_by_id IS 'The user ID of the admin who made the change.';
COMMENT ON COLUMN prompt_versions.updated_by_username IS 'The username of the admin who made the change.'; 