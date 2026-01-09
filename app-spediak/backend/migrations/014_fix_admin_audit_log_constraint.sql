-- Migration 014: Fix admin_audit_log constraint issue
-- Problem: admin_id is NOT NULL but we're using admin_clerk_id for inserts
-- Solution: Make admin_id nullable and ensure we always set admin_clerk_id

-- Step 1: Make admin_id nullable
ALTER TABLE admin_audit_log 
  ALTER COLUMN admin_id DROP NOT NULL;

-- Step 2: Set admin_id from admin_clerk_id where admin_id is null
UPDATE admin_audit_log 
SET admin_id = admin_clerk_id 
WHERE admin_id IS NULL AND admin_clerk_id IS NOT NULL;

-- Step 3: Set admin_clerk_id from admin_id where admin_clerk_id is null  
UPDATE admin_audit_log 
SET admin_clerk_id = admin_id 
WHERE admin_clerk_id IS NULL AND admin_id IS NOT NULL;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_desc ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS 'Immutable log of all admin actions - uses admin_clerk_id as primary admin identifier';
