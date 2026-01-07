-- Migration 003: User Profiles and Subscriptions
-- Created: 2026-01-04
-- Purpose: Add user profile management and subscription tracking

-- User profiles with extended information
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  profile_photo_url TEXT,
  primary_state VARCHAR(2) DEFAULT 'NC',
  secondary_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  organization VARCHAR(50),
  company_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_user_profiles_clerk_id FOREIGN KEY (clerk_id) 
    REFERENCES users(clerk_id) ON DELETE CASCADE
);

-- User subscriptions and usage tracking
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'platinum')),
  statements_used INTEGER DEFAULT 0,
  statements_limit INTEGER DEFAULT 5,
  last_reset_date TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(20) DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_user_subscriptions_clerk_id FOREIGN KEY (clerk_id) 
    REFERENCES users(clerk_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id ON user_profiles(clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_primary_state ON user_profiles(primary_state);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_clerk_id ON user_subscriptions(clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_type ON user_subscriptions(plan_type);

-- Create update triggers
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE user_profiles IS 'Extended user profile information including state and organization';
COMMENT ON TABLE user_subscriptions IS 'User subscription plans and statement usage tracking';
COMMENT ON COLUMN user_subscriptions.statements_limit IS 'Free=5, Pro/Platinum=unlimited(-1)';

