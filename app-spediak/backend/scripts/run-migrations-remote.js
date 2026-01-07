#!/usr/bin/env node
/**
 * Remote Migration Script
 * Executes migrations directly from local machine to Neon Tech database
 * Usage: node scripts/run-migrations-remote.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Neon Tech connection string
const DATABASE_URL = 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('🔗 Connecting to Neon Tech database...\n');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected successfully!\n');
    console.log('🚀 Starting database migrations...\n');

    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📋 Found ${files.length} migration files\n`);

    // Focus on migrations 003 and 004 (the ones that were empty)
    const criticalMigrations = ['003_create_user_profiles_and_subscriptions.sql', '004_create_sop_tables.sql'];
    
    // Run each migration
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Skip if file is empty
      if (sql.trim().length === 0) {
        console.log(`⏭️  Skipping ${file} (empty file)\n`);
        continue;
      }
      
      const isCritical = criticalMigrations.includes(file);
      const prefix = isCritical ? '⭐' : '📝';
      
      console.log(`${prefix} Running migration: ${file}`);
      
      try {
        await client.query(sql);
        console.log(`✅ Successfully applied: ${file}`);
        if (isCritical) {
          console.log(`   🎉 Critical migration completed!`);
        }
        console.log('');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Already exists (skipping): ${file}\n`);
        } else {
          console.error(`❌ Error in ${file}:`, error.message);
          console.log(`⚠️  Continuing with remaining migrations...\n`);
        }
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying database schema...\n');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📊 Current tables in database:');
    const requiredTables = [
      'user_profiles',
      'user_subscriptions',
      'sop_documents',
      'sop_assignments',
      'sop_state_assignments',
      'sop_org_assignments',
      'sop_history',
      'admin_gifted_credits',
      'admin_user_notes',
      'admin_trial_resets',
      'admin_user_overrides',
      'signup_promotions',
      'user_support_tags',
      'user_security_flags'
    ];
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    
    existingTables.forEach(table => {
      const isNew = requiredTables.includes(table);
      const marker = isNew ? '🆕' : '  ';
      console.log(`  ${marker} ✓ ${table}`);
    });

    console.log('\n📈 Summary:');
    console.log(`   Total tables: ${existingTables.length}`);
    
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    if (missingTables.length === 0) {
      console.log('   ✅ All critical tables exist!');
    } else {
      console.log(`   ⚠️  Missing tables: ${missingTables.join(', ')}`);
    }

    // Create missing profiles and subscriptions
    console.log('\n🔧 Auto-fixing user data...\n');
    
    const fixProfilesResult = await client.query(`
      INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
      SELECT 
        u.clerk_id,
        COALESCE(u.state, 'NC'),
        ARRAY[]::TEXT[],
        NULL,
        NULL
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      WHERE up.id IS NULL
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING clerk_id
    `);
    
    console.log(`✅ Created ${fixProfilesResult.rows.length} missing profiles`);
    
    const fixSubsResult = await client.query(`
      INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date)
      SELECT 
        u.clerk_id,
        'free',
        0,
        5,
        NOW()
      FROM users u
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      WHERE us.id IS NULL
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING clerk_id
    `);
    
    console.log(`✅ Created ${fixSubsResult.rows.length} missing subscriptions`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

