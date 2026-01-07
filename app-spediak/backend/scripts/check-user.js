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

async function checkUser() {
  try {
    const userEmail = 'juandiegoriosmesa@gmail.com';
    
    console.log(`\n🔍 Checking user: ${userEmail}\n`);
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT clerk_id, name, email, created_at FROM users WHERE email = $1',
      [userEmail]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:');
    console.log(JSON.stringify(user, null, 2));
    
    // Check profile
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE clerk_id = $1',
      [user.clerk_id]
    );
    
    console.log('\n📋 User Profile:');
    if (profileResult.rows.length === 0) {
      console.log('❌ No profile found - CREATING NOW...');
      await pool.query(
        `INSERT INTO user_profiles (clerk_id, primary_state, created_at, updated_at)
         VALUES ($1, 'NC', NOW(), NOW())`,
        [user.clerk_id]
      );
      console.log('✅ Profile created with default state NC');
    } else {
      console.log(JSON.stringify(profileResult.rows[0], null, 2));
    }
    
    // Check subscription
    const subResult = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [user.clerk_id]
    );
    
    console.log('\n💳 User Subscription:');
    if (subResult.rows.length === 0) {
      console.log('❌ No subscription found - CREATING NOW...');
      await pool.query(
        `INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, created_at, updated_at)
         VALUES ($1, 'free', 0, 5, NOW(), NOW(), NOW())`,
        [user.clerk_id]
      );
      console.log('✅ Free subscription created (0/5 statements)');
    } else {
      console.log(JSON.stringify(subResult.rows[0], null, 2));
    }
    
    console.log('\n✅ User verification complete!\n');
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await pool.end();
  }
}

checkUser();


