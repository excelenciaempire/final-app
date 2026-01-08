-- Migration 012: Add sop_organizations table
-- Stores organizations that can have SOP documents assigned

CREATE TABLE IF NOT EXISTS sop_organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add default organizations
INSERT INTO sop_organizations (name, created_at)
VALUES 
  ('InterNACHI', NOW()),
  ('ASHI', NOW()),
  ('State Specific', NOW())
ON CONFLICT (name) DO NOTHING;
