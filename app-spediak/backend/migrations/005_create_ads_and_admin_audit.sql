-- Migration 005: Ad Management and Admin Audit Logging
-- Created: 2026-01-04
-- Purpose: Add ad inventory for banner rotation and admin action tracking

-- Ad inventory for banner rotation
CREATE TABLE IF NOT EXISTS ad_inventory (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  destination_url TEXT NOT NULL,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255),
  action_type VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100),
  target_id VARCHAR(255),
  action_details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discord integration tracking
CREATE TABLE IF NOT EXISTS discord_connections (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  discord_user_id VARCHAR(255) NOT NULL,
  discord_username VARCHAR(255),
  discord_discriminator VARCHAR(10),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ad_inventory_status ON ad_inventory(status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_connections_clerk_id ON discord_connections(clerk_id);

-- Create update trigger for ads
CREATE TRIGGER update_ad_inventory_updated_at
BEFORE UPDATE ON ad_inventory
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Create update trigger for discord
CREATE TRIGGER update_discord_connections_updated_at
BEFORE UPDATE ON discord_connections
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

COMMENT ON TABLE ad_inventory IS 'Banner ads for rotation on free plan';
COMMENT ON TABLE admin_audit_log IS 'Immutable log of all admin actions';
COMMENT ON TABLE discord_connections IS 'Discord OAuth connections';

