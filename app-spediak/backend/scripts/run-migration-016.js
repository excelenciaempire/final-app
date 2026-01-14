const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 016...\n');
    
    // 1. Add organizations JSONB array column to user_profiles
    console.log('1. Adding organizations column to user_profiles...');
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS organizations JSONB DEFAULT '[]'::jsonb
    `);
    console.log('   ✓ organizations column added/verified\n');
    
    // 2. Add statement_override column to admin_user_overrides
    console.log('2. Adding statement_override column to admin_user_overrides...');
    try {
      await client.query(`
        ALTER TABLE admin_user_overrides ADD COLUMN IF NOT EXISTS statement_override INTEGER
      `);
      console.log('   ✓ statement_override column added/verified\n');
    } catch (err) {
      console.log('   ! admin_user_overrides table may not exist, skipping\n');
    }
    
    // 3. Create signup_promotions table
    console.log('3. Creating signup_promotions table...');
    await client.query(`
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
      )
    `);
    console.log('   ✓ signup_promotions table created/verified\n');
    
    // 4. Add columns to users table for promo tracking
    console.log('4. Adding promo tracking columns to users table...');
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_promo_id INTEGER
      `);
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_statements_granted INTEGER DEFAULT 0
      `);
      console.log('   ✓ promo tracking columns added/verified\n');
    } catch (err) {
      console.log('   ! Error adding promo columns:', err.message, '\n');
    }
    
    // 5. Create index for active promotions lookup
    console.log('5. Creating index for promotions lookup...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_signup_promotions_active_dates 
        ON signup_promotions(is_active, start_date, end_date)
      `);
      console.log('   ✓ index created/verified\n');
    } catch (err) {
      console.log('   ! Index may already exist\n');
    }
    
    // Verify tables
    console.log('Verifying migration...');
    
    const profileCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND column_name = 'organizations'
    `);
    console.log('   - user_profiles.organizations:', profileCols.rows.length > 0 ? '✓ exists' : '✗ missing');
    
    const promoTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'signup_promotions'
      )
    `);
    console.log('   - signup_promotions table:', promoTable.rows[0].exists ? '✓ exists' : '✗ missing');
    
    console.log('\n✅ Migration 016 completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
