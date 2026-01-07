-- Migration 006: Add extracted_text column and admin features
-- Safe to re-run (uses IF NOT EXISTS)

-- ============================================
-- PART 1: SOP Documents Enhancement
-- ============================================

-- Add extracted_text column to sop_documents for RAG/AI context
ALTER TABLE sop_documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add file_size column for tracking document sizes
ALTER TABLE sop_documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add extraction_status to track PDF text extraction progress
ALTER TABLE sop_documents ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending';

-- ============================================
-- PART 2: User Profiles Enhancement
-- ============================================

-- Add phone_number to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- ============================================
-- PART 3: Admin Features Tables
-- ============================================

-- Admin gifted credits tracking
CREATE TABLE IF NOT EXISTS admin_gifted_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE CASCADE,
  admin_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE SET NULL,
  credits_amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin notes on users
CREATE TABLE IF NOT EXISTS admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE CASCADE,
  admin_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trial reset history
CREATE TABLE IF NOT EXISTS admin_trial_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE CASCADE,
  admin_clerk_id VARCHAR(255) REFERENCES users(clerk_id) ON DELETE SET NULL,
  previous_usage INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PART 4: Indexes for Performance
-- ============================================

-- Indexes for admin tables
CREATE INDEX IF NOT EXISTS idx_admin_gifted_credits_user ON admin_gifted_credits(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_gifted_credits_admin ON admin_gifted_credits(admin_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON admin_user_notes(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_trial_resets_user ON admin_trial_resets(user_clerk_id);

-- Index for SOP extraction status queries
CREATE INDEX IF NOT EXISTS idx_sop_documents_extraction_status ON sop_documents(extraction_status);

-- ============================================
-- PART 5: Triggers for updated_at
-- ============================================

-- Trigger for admin_user_notes updated_at
CREATE OR REPLACE FUNCTION update_admin_user_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_user_notes_updated_at ON admin_user_notes;
CREATE TRIGGER trigger_admin_user_notes_updated_at
  BEFORE UPDATE ON admin_user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_user_notes_updated_at();

