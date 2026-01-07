-- Migration 008: Admin User Management System
-- Created: 2026-01-07
-- Purpose: Add comprehensive user management features for admins

-- User statement overrides (per-user limits/allowances)
CREATE TABLE IF NOT EXISTS admin_user_overrides (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL UNIQUE,
  user_email VARCHAR(255) NOT NULL,
  statement_allowance INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sign-up promotions (affects new users during promo period)
CREATE TABLE IF NOT EXISTS signup_promotions (
  id SERIAL PRIMARY KEY,
  promo_name VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  free_statements INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User support tags (for categorizing users)
CREATE TABLE IF NOT EXISTS user_support_tags (
  id SERIAL PRIMARY KEY,
  user_clerk_id VARCHAR(255) NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  tag_color VARCHAR(20) DEFAULT '#6366f1',
  added_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_tag UNIQUE (user_clerk_id, tag_name)
);

-- User roles and security flags
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin action audit log (expanded)
ALTER TABLE admin_audit_log 
  ADD COLUMN IF NOT EXISTS action_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Track which users signed up during promotions
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS signup_promo_id INTEGER REFERENCES signup_promotions(id),
  ADD COLUMN IF NOT EXISTS promo_statements_granted INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_overrides_clerk_id ON admin_user_overrides(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_overrides_email ON admin_user_overrides(user_email);
CREATE INDEX IF NOT EXISTS idx_signup_promotions_dates ON signup_promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_signup_promotions_active ON signup_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_support_tags_user ON user_support_tags(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_security_flags_user ON user_security_flags(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_category ON admin_audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_audit_log(target_user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_user_overrides_updated_at') THEN
    CREATE TRIGGER update_admin_user_overrides_updated_at
    BEFORE UPDATE ON admin_user_overrides
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_signup_promotions_updated_at') THEN
    CREATE TRIGGER update_signup_promotions_updated_at
    BEFORE UPDATE ON signup_promotions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_security_flags_updated_at') THEN
    CREATE TRIGGER update_user_security_flags_updated_at
    BEFORE UPDATE ON user_security_flags
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE admin_user_overrides IS 'Per-user statement allowance overrides set by admins';
COMMENT ON TABLE signup_promotions IS 'Time-bound promotions giving extra statements to new signups';
COMMENT ON TABLE user_support_tags IS 'Tags for categorizing users in support workflow';
COMMENT ON TABLE user_security_flags IS 'User roles, security controls, and suspension status';

