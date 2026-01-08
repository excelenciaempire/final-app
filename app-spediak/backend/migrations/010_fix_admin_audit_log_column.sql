-- Migration 010: Fix admin_audit_log column names and ensure all admin tables exist
-- Created: 2026-01-08
-- Purpose: Rename admin_id to admin_clerk_id and add missing columns/tables

-- Step 1: Add admin_clerk_id column if it doesn't exist, copying from admin_id
ALTER TABLE admin_audit_log 
  ADD COLUMN IF NOT EXISTS admin_clerk_id VARCHAR(255);

-- Copy data from admin_id to admin_clerk_id if admin_id exists and admin_clerk_id is empty
UPDATE admin_audit_log 
SET admin_clerk_id = admin_id 
WHERE admin_clerk_id IS NULL AND admin_id IS NOT NULL;

-- Step 2: Ensure all required columns exist on admin_audit_log
ALTER TABLE admin_audit_log 
  ADD COLUMN IF NOT EXISTS action_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_user_id VARCHAR(255);

-- Step 3: Copy target_entity to target_type if target_type is empty
UPDATE admin_audit_log 
SET target_type = target_entity 
WHERE target_type IS NULL AND target_entity IS NOT NULL;

-- Step 4: Create admin_user_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_user_notes (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL,
  admin_clerk_id VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  note_type VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create admin_gifted_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_gifted_credits (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL,
  admin_clerk_id VARCHAR(255) NOT NULL,
  credits_amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create admin_trial_resets table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_trial_resets (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL,
  admin_clerk_id VARCHAR(255) NOT NULL,
  previous_usage INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create user_support_tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_support_tags (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  tag_color VARCHAR(20) DEFAULT '#6366f1',
  admin_clerk_id VARCHAR(255),
  added_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_tag UNIQUE (user_clerk_id, tag_name)
);

-- Step 8: Create user_security_flags table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_security_flags (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_beta_user BOOLEAN DEFAULT FALSE,
  is_vip BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_by VARCHAR(255),
  fraud_flag BOOLEAN DEFAULT FALSE,
  fraud_notes TEXT,
  require_2fa VARCHAR(20) DEFAULT 'off',
  role VARCHAR(50) DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 9: Add missing columns to user_subscriptions
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Step 10: Add missing columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 11: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_clerk_id ON admin_audit_log(admin_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_id ON admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON admin_user_notes(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_gifted_credits_user ON admin_gifted_credits(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_trial_resets_user ON admin_trial_resets(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_support_tags_user ON user_support_tags(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_security_flags_user ON user_security_flags(user_clerk_id);

COMMENT ON TABLE admin_user_notes IS 'Admin notes on users for support and management';
COMMENT ON TABLE admin_gifted_credits IS 'Log of credits gifted to users by admins';
COMMENT ON TABLE admin_trial_resets IS 'Log of trial resets performed by admins';
COMMENT ON TABLE user_support_tags IS 'Tags for categorizing users in support workflow';
COMMENT ON TABLE user_security_flags IS 'User roles, security controls, and suspension status';
