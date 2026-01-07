const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixAllUsers() {
  try {
    console.log('\n🔧 Fixing all users in database...\n');
    
    // Get all users
    const usersResult = await pool.query('SELECT clerk_id, name, email FROM users');
    const users = usersResult.rows;
    
    console.log(`Found ${users.length} users total\n`);
    
    let fixedProfiles = 0;
    let fixedSubscriptions = 0;
    
    for (const user of users) {
      console.log(`Checking user: ${user.email} (${user.name})`);
      
      // Check and create profile if missing
      const profileCheck = await pool.query(
        'SELECT * FROM user_profiles WHERE clerk_id = $1',
        [user.clerk_id]
      );
      
      if (profileCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO user_profiles (clerk_id, primary_state, created_at, updated_at)
           VALUES ($1, 'NC', NOW(), NOW())`,
          [user.clerk_id]
        );
        console.log('  ✅ Created profile');
        fixedProfiles++;
      } else {
        console.log('  ✓ Profile exists');
      }
      
      // Check and create subscription if missing
      const subCheck = await pool.query(
        'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
        [user.clerk_id]
      );
      
      if (subCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, created_at, updated_at)
           VALUES ($1, 'free', 0, 5, NOW(), NOW(), NOW())`,
          [user.clerk_id]
        );
        console.log('  ✅ Created subscription (Free plan, 0/5 statements)');
        fixedSubscriptions++;
      } else {
        const sub = subCheck.rows[0];
        console.log(`  ✓ Subscription exists (${sub.plan_type}, ${sub.statements_used}/${sub.statements_limit})`);
      }
      
      console.log('');
    }
    
    console.log('\n📊 Summary:');
    console.log(`  • Total users: ${users.length}`);
    console.log(`  • Profiles created: ${fixedProfiles}`);
    console.log(`  • Subscriptions created: ${fixedSubscriptions}`);
    console.log('\n✅ All users fixed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixAllUsers();


