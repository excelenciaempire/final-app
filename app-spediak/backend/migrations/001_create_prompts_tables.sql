-- Create the prompts table to store the current version and locking info
CREATE TABLE prompts (
    id SERIAL PRIMARY KEY,
    prompt_name VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    locked_by VARCHAR(255),
    locked_at TIMESTAMPTZ
);

-- Create the prompt_versions table to store the history of changes
CREATE TABLE prompt_versions (
    id SERIAL PRIMARY KEY,
    prompt_id INTEGER REFERENCES prompts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    updated_by_user_id VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT prompt_version_unique UNIQUE (prompt_id, version)
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at timestamp on the prompts table
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON prompts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Insert the initial prompts from the prompts.json file
-- You will need to run a script to do this after the migration is applied
INSERT INTO prompts (prompt_name, content) VALUES ('ddid_prompt', 'Initial DDID Prompt Content');
INSERT INTO prompts (prompt_name, content) VALUES ('pre_description_prompt', 'Initial Pre-Description Prompt Content'); 