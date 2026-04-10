#!/usr/bin/env node
/**
 * Remote Database Diagnostics
 * Runs comprehensive database checks connecting to Neon Tech
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

const requiredTables = [
  'users',
  'inspections',
  'prompts',
  'prompt_versions',
  'knowledge_base',
  'user_profiles',
  'user_subscriptions',
  'sop_documents',
  'sop_state_assignments',
  'sop_org_assignments',
  'sop_history',
  'ad_inventory',
  'admin_audit_log',
  'discord_connections'
];

async function runDiagnostics() {
  console.log('🏥 DATABASE DIAGNOSTICS');
  console.log('=' .repeat(60));
  
  try {
    console.log('\n🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!\n');
    
    // Check tables
    console.log('📋 Checking tables...\n');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    console.log(`✅ Found ${existingTables.length} tables:`);
    existingTables.forEach(t => console.log(`   - ${t}`));
    
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing ${missingTables.length} required tables:`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('\n✅ All required tables exist!');
    }
    
    // Check user data consistency
    console.log('\n👥 Checking user data...\n');
    
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Total users: ${userCount.rows[0].count}`);
    
    const profileCount = await pool.query('SELECT COUNT(*) as count FROM user_profiles');
    console.log(`✅ User profiles: ${profileCount.rows[0].count}`);
    
    const subsCount = await pool.query('SELECT COUNT(*) as count FROM user_subscriptions');
    console.log(`✅ User subscriptions: ${subsCount.rows[0].count}`);
    
    // Check for missing profiles
    const missingProfiles = await pool.query(`
      SELECT u.clerk_id, u.email 
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      WHERE up.id IS NULL
    `);
    
    if (missingProfiles.rows.length > 0) {
      console.log(`\n⚠️  ${missingProfiles.rows.length} users missing profiles:`);
      missingProfiles.rows.forEach(u => console.log(`   - ${u.email}`));
    } else {
      console.log('✅ All users have profiles');
    }
    
    // Check for missing subscriptions
    const missingSubs = await pool.query(`
      SELECT u.clerk_id, u.email 
      FROM users u
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      WHERE us.id IS NULL
    `);
    
    if (missingSubs.rows.length > 0) {
      console.log(`\n⚠️  ${missingSubs.rows.length} users missing subscriptions:`);
      missingSubs.rows.forEach(u => console.log(`   - ${u.email}`));
    } else {
      console.log('✅ All users have subscriptions');
    }
    
    // Check subscription plans
    console.log('\n💳 Subscription distribution...\n');
    const planDist = await pool.query(`
      SELECT 
        plan_type,
        COUNT(*) as count,
        ROUND(AVG(statements_used), 1) as avg_used
      FROM user_subscriptions
      GROUP BY plan_type
      ORDER BY plan_type
    `);
    
    planDist.rows.forEach(row => {
      console.log(`   ${row.plan_type}: ${row.count} users (avg: ${row.avg_used} statements used)`);
    });
    
    // Check SOP data
    console.log('\n📄 SOP data...\n');
    const sopDocs = await pool.query('SELECT COUNT(*) as count FROM sop_documents');
    console.log(`✅ SOP documents: ${sopDocs.rows[0].count}`);
    
    const stateAssignments = await pool.query('SELECT COUNT(*) as count FROM sop_state_assignments');
    console.log(`✅ State assignments: ${stateAssignments.rows[0].count}`);
    
    const orgAssignments = await pool.query('SELECT COUNT(*) as count FROM sop_org_assignments');
    console.log(`✅ Organization assignments: ${orgAssignments.rows[0].count}`);
    
    // Check ads
    console.log('\n📢 Ads data...\n');
    const totalAds = await pool.query('SELECT COUNT(*) as count FROM ad_inventory');
    console.log(`✅ Total ads: ${totalAds.rows[0].count}`);
    
    const activeAds = await pool.query("SELECT COUNT(*) as count FROM ad_inventory WHERE status = 'active'");
    console.log(`✅ Active ads: ${activeAds.rows[0].count}`);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    const allGood = missingTables.length === 0 && 
                    missingProfiles.rows.length === 0 && 
                    missingSubs.rows.length === 0;
    
    if (allGood) {
      console.log('✅ ALL CHECKS PASSED!');
      console.log('🎉 Database is healthy and fully operational!');
    } else {
      console.log('⚠️  SOME ISSUES FOUND');
      console.log('Review the output above for details.');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

runDiagnostics();

