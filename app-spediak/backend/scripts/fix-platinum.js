const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// List of admin emails that SHOULD have platinum
const ADMIN_EMAILS = [
  'support@hicarolina.com',
  'chipspra@gmail.com',
  'chip@spediak.com',
  'vitalu.solera@gmail.com',
  'derrick@spediak.com'
];

async function run() {
  try {
    console.log('=== CHECKING PLATINUM USERS ===\n');
    
    // Find all platinum users
    const platinumUsers = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit, 
             COALESCE(sf.is_admin, false) as is_admin
      FROM user_subscriptions us 
      LEFT JOIN users u ON us.clerk_id = u.clerk_id 
      LEFT JOIN user_security_flags sf ON us.clerk_id = sf.user_clerk_id
      WHERE us.plan_type = 'platinum'
      ORDER BY u.email
    `);
    
    console.log('All users with Platinum plan:');
    console.table(platinumUsers.rows);
    
    // Find orphaned platinum users (platinum but NOT admin and NOT in admin list)
    const orphaned = platinumUsers.rows.filter(user => {
      const isInAdminList = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      return !user.is_admin && !isInAdminList;
    });
    
    console.log('\n=== ORPHANED PLATINUM USERS (should be FREE) ===');
    if (orphaned.length === 0) {
      console.log('No orphaned platinum users found!');
    } else {
      console.table(orphaned);
      
      // Fix each orphaned user
      console.log('\n=== FIXING ORPHANED USERS ===');
      for (const user of orphaned) {
        console.log(`Fixing ${user.email} (${user.clerk_id})...`);
        await pool.query(`
          UPDATE user_subscriptions 
          SET plan_type = 'free', 
              statements_limit = 5, 
              statements_used = 0,
              updated_at = NOW()
          WHERE clerk_id = $1
        `, [user.clerk_id]);
        console.log(`  ✓ Changed to FREE plan with 5 statements/month`);
      }
      
      console.log(`\n✅ Fixed ${orphaned.length} orphaned platinum users!`);
    }
    
    // Verify the fix
    console.log('\n=== VERIFICATION - Current Platinum Users ===');
    const verifyResult = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit
      FROM user_subscriptions us 
      LEFT JOIN users u ON us.clerk_id = u.clerk_id 
      WHERE us.plan_type = 'platinum'
      ORDER BY u.email
    `);
    console.table(verifyResult.rows);
    
    await pool.end();
    console.log('\nDone!');
    
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

run();
