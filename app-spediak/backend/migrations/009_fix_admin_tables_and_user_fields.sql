-- Migration 009: Fix admin tables and add missing user fields
-- Created: 2026-01-07
-- Purpose: Fix table structures and add missing columns for full functionality

-- Fix admin_user_overrides - change unique constraint from user_clerk_id to user_email
ALTER TABLE admin_user_overrides 
  DROP CONSTRAINT IF EXISTS admin_user_overrides_user_clerk_id_key;

-- Add unique constraint on user_email instead (allows null user_clerk_id for pre-registered users)
ALTER TABLE admin_user_overrides
  ALTER COLUMN user_clerk_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_user_overrides_user_email_key'
  ) THEN
    ALTER TABLE admin_user_overrides ADD CONSTRAINT admin_user_overrides_user_email_key UNIQUE (user_email);
  END IF;
END $$;

-- Add missing columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add missing columns to user_subscriptions table  
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Add note_type to admin_user_notes for support notes
ALTER TABLE admin_user_notes
  ADD COLUMN IF NOT EXISTS note_type VARCHAR(50) DEFAULT 'general';

-- Create unique constraint for support notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_support_note_per_user'
  ) THEN
    -- This allows only ONE 'support' note per user (used for quick support notes)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_support_note 
    ON admin_user_notes(user_clerk_id, note_type) 
    WHERE note_type = 'support';
  END IF;
END $$;

-- Ensure sop_history has all required columns
ALTER TABLE sop_history
  ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS assignment_value VARCHAR(100),
  ADD COLUMN IF NOT EXISTS change_details JSONB;

-- Update sop_history indexes
CREATE INDEX IF NOT EXISTS idx_sop_history_assignment_type ON sop_history(assignment_type);
CREATE INDEX IF NOT EXISTS idx_sop_history_assignment_value ON sop_history(assignment_value);

-- Ensure inspections table has state_used column for tracking
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS state_used VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ddid_text TEXT;

-- Update ddid_text to copy from ddid if null (for existing records)
UPDATE inspections SET ddid_text = ddid WHERE ddid_text IS NULL AND ddid IS NOT NULL;

-- Add index for user audit log lookup
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_id ON admin_audit_log(target_id);

COMMENT ON COLUMN admin_user_overrides.user_clerk_id IS 'Clerk ID of user, null if user not yet registered';
COMMENT ON COLUMN admin_user_overrides.user_email IS 'Email address used as primary lookup key';

