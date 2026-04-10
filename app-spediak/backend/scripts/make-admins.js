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

async function makeAdmins() {
  const adminEmails = [
    'vitalu.solera@gmail.com',
    'wipet50436@daxiake.com',
    'support@hicarolina.com',
    'chipspra@gmail.com',
    'chip@spediak.com'
  ];

  console.log('Making the following users admins:\n');
  
  for (const email of adminEmails) {
    try {
      // Find the user by email
      const userResult = await pool.query(
        'SELECT clerk_id, email FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        console.log('❌ User not found:', email);
        continue;
      }
      
      const clerkId = userResult.rows[0].clerk_id;
      
      // Check if security flags exist
      const flagsResult = await pool.query(
        'SELECT * FROM user_security_flags WHERE user_clerk_id = $1',
        [clerkId]
      );
      
      if (flagsResult.rows.length === 0) {
        // Create security flags with is_admin = true
        await pool.query(
          'INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag) VALUES ($1, TRUE, FALSE, FALSE, FALSE, FALSE)',
          [clerkId]
        );
        console.log('✅ Created admin flags for:', email);
      } else {
        // Update existing flags
        await pool.query(
          'UPDATE user_security_flags SET is_admin = TRUE WHERE user_clerk_id = $1',
          [clerkId]
        );
        console.log('✅ Updated to admin:', email);
      }
    } catch (err) {
      console.error('Error for', email, ':', err.message);
    }
  }
  
  // Verify admins
  console.log('\n--- Current Admins ---');
  const admins = await pool.query(`
    SELECT u.email, u.first_name, u.last_name, sf.is_admin 
    FROM users u 
    JOIN user_security_flags sf ON u.clerk_id = sf.user_clerk_id 
    WHERE sf.is_admin = TRUE
  `);
  admins.rows.forEach(a => console.log('👑', a.first_name || '', a.last_name || '', '-', a.email));
  
  await pool.end();
  console.log('\nDone!');
}

makeAdmins().catch(console.error);

