-- Migration 015: Add is_soft_deleted column to user_security_flags
-- This tracks whether a user has been soft deleted (can be restored)

ALTER TABLE user_security_flags
  ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_security_flags_soft_deleted 
  ON user_security_flags(is_soft_deleted) WHERE is_soft_deleted = TRUE;
