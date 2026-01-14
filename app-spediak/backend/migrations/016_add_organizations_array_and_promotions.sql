-- Migration 016: Add organizations array to user_profiles and create signup_promotions table

-- Add organizations JSONB array column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS organizations JSONB DEFAULT '[]'::jsonb;

-- Add statement_override column to admin_user_overrides if it doesn't exist
ALTER TABLE admin_user_overrides ADD COLUMN IF NOT EXISTS statement_override INTEGER;

-- Create signup_promotions table for admin-defined promotions
CREATE TABLE IF NOT EXISTS signup_promotions (
    id SERIAL PRIMARY KEY,
    promo_name VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    free_statements INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to users table for promo tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_promo_id INTEGER REFERENCES signup_promotions(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_statements_granted INTEGER DEFAULT 0;

-- Create index for active promotions lookup
CREATE INDEX IF NOT EXISTS idx_signup_promotions_active_dates 
ON signup_promotions(is_active, start_date, end_date);

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('016', 'Add organizations array and signup promotions', NOW())
ON CONFLICT DO NOTHING;
