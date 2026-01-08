const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('=== ALL USERS WITH SUBSCRIPTIONS ===\n');
    
    const allSubs = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit, us.statements_used,
             COALESCE(sf.is_admin, false) as is_admin
      FROM user_subscriptions us 
      LEFT JOIN users u ON us.clerk_id = u.clerk_id 
      LEFT JOIN user_security_flags sf ON us.clerk_id = sf.user_clerk_id
      ORDER BY u.email
    `);
    
    console.log(`Total users with subscriptions: ${allSubs.rows.length}`);
    console.table(allSubs.rows);
    
    console.log('\n=== PLAN TYPE DISTRIBUTION ===');
    const planDist = await pool.query(`
      SELECT plan_type, COUNT(*) as count 
      FROM user_subscriptions 
      GROUP BY plan_type
    `);
    console.table(planDist.rows);
    
    console.log('\n=== USERS MARKED AS ADMIN ===');
    const admins = await pool.query(`
      SELECT sf.user_clerk_id, u.email, sf.is_admin, us.plan_type, us.statements_limit
      FROM user_security_flags sf
      LEFT JOIN users u ON sf.user_clerk_id = u.clerk_id
      LEFT JOIN user_subscriptions us ON sf.user_clerk_id = us.clerk_id
      WHERE sf.is_admin = true
    `);
    console.table(admins.rows);
    
    // Check the specific user from the screenshot
    console.log('\n=== CHECKING bobire5942@emaxasp.com ===');
    const bobire = await pool.query(`
      SELECT u.*, us.plan_type, us.statements_limit, us.statements_used,
             sf.is_admin
      FROM users u
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      LEFT JOIN user_security_flags sf ON u.clerk_id = sf.user_clerk_id
      WHERE u.email ILIKE '%bobire%' OR u.email ILIKE '%emaxasp%'
    `);
    if (bobire.rows.length > 0) {
      console.table(bobire.rows);
    } else {
      console.log('User not found in database');
    }
    
    // Check unlimited users
    console.log('\n=== USERS WITH UNLIMITED STATEMENTS (limit = -1) ===');
    const unlimited = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit
      FROM user_subscriptions us 
      LEFT JOIN users u ON us.clerk_id = u.clerk_id 
      WHERE us.statements_limit = -1
    `);
    console.table(unlimited.rows);
    
    await pool.end();
    
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

run();
