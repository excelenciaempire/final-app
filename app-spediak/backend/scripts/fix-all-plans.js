const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// List of admin emails that SHOULD have platinum/unlimited
const ADMIN_EMAILS = [
  'support@hicarolina.com',
  'chipspra@gmail.com',
  'chip@spediak.com',
  'vitalu.solera@gmail.com',
  'derrick@spediak.com'
];

async function run() {
  try {
    console.log('=== FIXING ALL PLANS ===\n');
    
    // 1. Make sure all admins have is_admin = true in security flags
    console.log('1. Setting is_admin = true for admin emails...');
    for (const email of ADMIN_EMAILS) {
      // Get clerk_id for this email
      const userResult = await pool.query(
        'SELECT clerk_id FROM users WHERE email = $1',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        console.log(`   ⚠️ ${email} - not found in database`);
        continue;
      }
      
      const clerkId = userResult.rows[0].clerk_id;
      
      // Upsert security flags with is_admin = true
      await pool.query(`
        INSERT INTO user_security_flags (user_clerk_id, is_admin, created_at, updated_at)
        VALUES ($1, TRUE, NOW(), NOW())
        ON CONFLICT (user_clerk_id) 
        DO UPDATE SET is_admin = TRUE, updated_at = NOW()
      `, [clerkId]);
      
      console.log(`   ✓ ${email} - marked as admin`);
    }
    
    // 2. Update all admins to have platinum plan with unlimited statements
    console.log('\n2. Setting platinum plan with unlimited statements for all admins...');
    const updateResult = await pool.query(`
      UPDATE user_subscriptions us
      SET 
        plan_type = 'platinum',
        statements_limit = -1,
        subscription_status = 'active',
        updated_at = NOW()
      FROM user_security_flags sf
      WHERE us.clerk_id = sf.user_clerk_id
        AND sf.is_admin = TRUE
      RETURNING us.clerk_id
    `);
    console.log(`   ✓ Updated ${updateResult.rowCount} admin subscriptions to platinum/unlimited`);
    
    // 3. Change trial users to free plan (they should not see "Platinum Plan")
    console.log('\n3. Changing trial users to free plan with trial benefits...');
    // Actually, let's keep trial but make the frontend display it correctly
    // For now, let's just verify what we have
    
    // Verify the changes
    console.log('\n=== VERIFICATION ===\n');
    
    console.log('Admins after fix:');
    const adminsVerify = await pool.query(`
      SELECT sf.user_clerk_id, u.email, sf.is_admin, us.plan_type, us.statements_limit
      FROM user_security_flags sf
      LEFT JOIN users u ON sf.user_clerk_id = u.clerk_id
      LEFT JOIN user_subscriptions us ON sf.user_clerk_id = us.clerk_id
      WHERE sf.is_admin = TRUE
      ORDER BY u.email
    `);
    console.table(adminsVerify.rows);
    
    console.log('\nAll platinum users:');
    const platinumVerify = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit
      FROM user_subscriptions us
      LEFT JOIN users u ON us.clerk_id = u.clerk_id
      WHERE us.plan_type = 'platinum'
      ORDER BY u.email
    `);
    console.table(platinumVerify.rows);
    
    console.log('\nTrial users:');
    const trialVerify = await pool.query(`
      SELECT us.clerk_id, u.email, us.plan_type, us.statements_limit
      FROM user_subscriptions us
      LEFT JOIN users u ON us.clerk_id = u.clerk_id
      WHERE us.plan_type = 'trial'
      ORDER BY u.email
    `);
    console.table(trialVerify.rows);
    
    await pool.end();
    console.log('\n✅ Done!');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

run();
