-- Migration: Add ad_settings table for configurable ad rotation
-- Created: 2026-01-16

-- Create ad_settings table
CREATE TABLE IF NOT EXISTS ad_settings (
  id SERIAL PRIMARY KEY,
  rotation_interval INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO ad_settings (rotation_interval, created_at, updated_at)
VALUES (10, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE ad_settings IS 'Stores global ad configuration settings';
COMMENT ON COLUMN ad_settings.rotation_interval IS 'Time in seconds between ad rotations (3-120)';
