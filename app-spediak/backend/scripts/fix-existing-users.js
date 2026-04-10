#!/usr/bin/env node
/**
 * Fix Existing Users Script
 * Ensures all users have profile, subscription, and security flag records
 * Usage: node scripts/fix-existing-users.js
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

async function fixExistingUsers() {
  console.log('🔗 Connecting to Neon Tech database...\n');
  
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected successfully!\n');
    console.log('🔧 Fixing existing users...\n');
    
    // Get all users without profiles
    const usersWithoutProfiles = await client.query(`
      SELECT u.clerk_id, u.state, u.email
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      WHERE up.id IS NULL
    `);
    
    console.log(`📋 Found ${usersWithoutProfiles.rows.length} users without profiles`);
    
    for (const user of usersWithoutProfiles.rows) {
      await client.query(`
        INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (clerk_id) DO NOTHING
      `, [user.clerk_id, user.state || 'NC', [], null, null]);
      console.log(`  ✓ Created profile for ${user.email || user.clerk_id}`);
    }
    
    // Get all users without subscriptions
    const usersWithoutSubs = await client.query(`
      SELECT u.clerk_id, u.email
      FROM users u
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      WHERE us.id IS NULL
    `);
    
    console.log(`\n📋 Found ${usersWithoutSubs.rows.length} users without subscriptions`);
    
    // Check for active promo
    let bonusStatements = 0;
    let promoId = null;
    
    const promoResult = await client.query(`
      SELECT id, free_statements, promo_name
      FROM signup_promotions 
      WHERE is_active = TRUE 
      AND start_date <= CURRENT_DATE 
      AND end_date >= CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (promoResult.rows.length > 0) {
      bonusStatements = promoResult.rows[0].free_statements || 0;
      promoId = promoResult.rows[0].id;
      console.log(`🎁 Active promotion: ${promoResult.rows[0].promo_name} (+${bonusStatements} statements)`);
    }
    
    const baseLimit = 5;
    const totalLimit = baseLimit + bonusStatements;
    
    for (const user of usersWithoutSubs.rows) {
      await client.query(`
        INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, subscription_status)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (clerk_id) DO NOTHING
      `, [user.clerk_id, 'free', 0, totalLimit, 'active']);
      console.log(`  ✓ Created subscription for ${user.email || user.clerk_id} (limit: ${totalLimit})`);
      
      // Link promo if applicable
      if (promoId) {
        await client.query(`
          UPDATE users SET signup_promo_id = $1, promo_statements_granted = $2
          WHERE clerk_id = $3
        `, [promoId, bonusStatements, user.clerk_id]);
      }
    }
    
    // Get all users without security flags
    const usersWithoutFlags = await client.query(`
      SELECT u.clerk_id, u.email
      FROM users u
      LEFT JOIN user_security_flags sf ON u.clerk_id = sf.user_clerk_id
      WHERE sf.id IS NULL
    `);
    
    console.log(`\n📋 Found ${usersWithoutFlags.rows.length} users without security flags`);
    
    for (const user of usersWithoutFlags.rows) {
      await client.query(`
        INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag)
        VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE)
        ON CONFLICT (user_clerk_id) DO NOTHING
      `, [user.clerk_id]);
      console.log(`  ✓ Created security flags for ${user.email || user.clerk_id}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const totalUsers = await client.query('SELECT COUNT(*) FROM users');
    const totalProfiles = await client.query('SELECT COUNT(*) FROM user_profiles');
    const totalSubs = await client.query('SELECT COUNT(*) FROM user_subscriptions');
    const totalFlags = await client.query('SELECT COUNT(*) FROM user_security_flags');
    
    console.log(`Total Users: ${totalUsers.rows[0].count}`);
    console.log(`Total Profiles: ${totalProfiles.rows[0].count}`);
    console.log(`Total Subscriptions: ${totalSubs.rows[0].count}`);
    console.log(`Total Security Flags: ${totalFlags.rows[0].count}`);
    
    console.log('\n🎉 ALL EXISTING USERS FIXED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixExistingUsers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

