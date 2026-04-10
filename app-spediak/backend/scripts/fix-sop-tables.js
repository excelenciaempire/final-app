#!/usr/bin/env node
/**
 * Fix SOP Tables Script
 * Creates missing SOP assignment tables
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixSopTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing SOP assignment tables...\n');

    // Create sop_state_assignments
    console.log('📝 Creating sop_state_assignments...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sop_state_assignments (
        id SERIAL PRIMARY KEY,
        sop_document_id INTEGER NOT NULL,
        state_code VARCHAR(2) NOT NULL,
        assigned_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        effective_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_sop_state_document FOREIGN KEY (sop_document_id) 
          REFERENCES sop_documents(id) ON DELETE CASCADE,
        CONSTRAINT unique_state_sop UNIQUE (state_code, sop_document_id)
      );
    `);
    console.log('✅ sop_state_assignments created\n');

    // Create sop_org_assignments
    console.log('📝 Creating sop_org_assignments...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sop_org_assignments (
        id SERIAL PRIMARY KEY,
        sop_document_id INTEGER NOT NULL,
        organization_name VARCHAR(50) NOT NULL,
        assigned_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        effective_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_sop_org_document FOREIGN KEY (sop_document_id) 
          REFERENCES sop_documents(id) ON DELETE CASCADE,
        CONSTRAINT unique_org_sop UNIQUE (organization_name, sop_document_id)
      );
    `);
    console.log('✅ sop_org_assignments created\n');

    // Create indexes
    console.log('📊 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sop_state_assignments_state ON sop_state_assignments(state_code);
      CREATE INDEX IF NOT EXISTS idx_sop_state_assignments_active ON sop_state_assignments(is_active);
      CREATE INDEX IF NOT EXISTS idx_sop_org_assignments_org ON sop_org_assignments(organization_name);
      CREATE INDEX IF NOT EXISTS idx_sop_org_assignments_active ON sop_org_assignments(is_active);
    `);
    console.log('✅ Indexes created\n');

    // Create triggers
    console.log('⚡ Creating triggers...');
    await client.query(`
      CREATE TRIGGER update_sop_state_assignments_updated_at
      BEFORE UPDATE ON sop_state_assignments
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();

      CREATE TRIGGER update_sop_org_assignments_updated_at
      BEFORE UPDATE ON sop_org_assignments
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
    `);
    console.log('✅ Triggers created\n');

    // Verify
    console.log('🔍 Verifying tables...\n');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sop_state_assignments', 'sop_org_assignments')
      ORDER BY table_name
    `);

    console.log('📊 SOP Assignment tables:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SOP TABLES FIXED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSopTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

