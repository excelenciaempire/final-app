-- Migration 018: Default SOP System
-- Created: 2026-01-20
-- Purpose: Add default SOP assignment for all states with exclusion support

-- Default SOP settings table
CREATE TABLE IF NOT EXISTS default_sop_settings (
  id SERIAL PRIMARY KEY,
  default_document_id INTEGER REFERENCES sop_documents(id) ON DELETE SET NULL,
  excluded_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial default (InterNACHI document)
INSERT INTO default_sop_settings (default_document_id, excluded_states, created_at, updated_at)
VALUES (20, ARRAY[]::TEXT[], NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_default_sop_settings_document ON default_sop_settings(default_document_id);

-- Comment
COMMENT ON TABLE default_sop_settings IS 'Default SOP document applied to all states unless excluded';
