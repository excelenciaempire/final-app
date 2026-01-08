-- Migration 011: Add User Management Columns
-- Created: 2026-01-07
-- Purpose: Add missing columns for user management features

-- Add two_fa_required column to user_security_flags
ALTER TABLE user_security_flags 
  ADD COLUMN IF NOT EXISTS two_fa_required BOOLEAN DEFAULT FALSE;

-- Add trial_end_date column to user_subscriptions for trial management
ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Extend plan_type to include 'trial' option
-- First, drop the existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_subscriptions_plan_type_check'
  ) THEN
    ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_plan_type_check;
  END IF;
END $$;

-- Add new constraint with all plan types
ALTER TABLE user_subscriptions 
  ADD CONSTRAINT user_subscriptions_plan_type_check 
  CHECK (plan_type IN ('free', 'trial', 'pro', 'platinum', 'cancelled'));

-- Add phone_number column to user_profiles if missing
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add is_active column to users table for soft delete
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add note_type to admin_user_notes for distinguishing admin vs support notes
ALTER TABLE admin_user_notes 
  ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'admin';

-- Add admin_clerk_id to user_support_tags if missing
ALTER TABLE user_support_tags 
  ADD COLUMN IF NOT EXISTS admin_clerk_id VARCHAR(255);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_security_flags_admin ON user_security_flags(is_admin);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON user_subscriptions(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Update existing admin users to have platinum subscription
-- This ensures any user with is_admin = TRUE gets unlimited access
UPDATE user_subscriptions us
SET 
  plan_type = 'platinum',
  statements_limit = -1,
  subscription_status = 'active'
FROM user_security_flags sf
WHERE us.clerk_id = sf.user_clerk_id 
  AND sf.is_admin = TRUE
  AND us.plan_type != 'platinum';

COMMENT ON COLUMN user_security_flags.two_fa_required IS 'Whether 2FA is required for this user';
COMMENT ON COLUMN user_subscriptions.trial_end_date IS 'When the trial period ends (NULL if not on trial)';
COMMENT ON COLUMN user_subscriptions.plan_type IS 'free=5/month, trial=temp free, pro=paid, platinum=unlimited/admin';
