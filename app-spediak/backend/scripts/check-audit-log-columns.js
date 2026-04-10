#!/usr/bin/env node
/**
 * Check admin_audit_log table structure
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

async function checkAuditLog() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking admin_audit_log table structure...\n');
    
    // Check columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'admin_audit_log'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Columns in admin_audit_log:');
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check recent entries
    console.log('\n📊 Recent audit log entries (last 10):');
    const entriesResult = await client.query(`
      SELECT id, admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, created_at
      FROM admin_audit_log
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (entriesResult.rows.length === 0) {
      console.log('   No entries found in admin_audit_log');
    } else {
      entriesResult.rows.forEach(entry => {
        console.log(`   [${entry.id}] ${entry.action_type} | target_id: ${entry.target_id} | target_user_id: ${entry.target_user_id} | ${entry.created_at}`);
      });
    }
    
    // Test query for specific user
    console.log('\n🔍 Testing audit trail query for user "user_2uHEVBjNDrPfI5YmY1yYzp1rNfD"...');
    const testResult = await client.query(`
      SELECT COUNT(*) as count
      FROM admin_audit_log
      WHERE target_user_id = $1 OR target_id = $1
    `, ['user_2uHEVBjNDrPfI5YmY1yYzp1rNfD']);
    
    console.log(`   Found ${testResult.rows[0].count} audit entries for this user`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAuditLog();
