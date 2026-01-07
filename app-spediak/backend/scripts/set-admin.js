require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function setAdmin() {
  const email = 'juandiegorios2010@gmail.com';
  
  try {
    console.log(`Setting admin role for ${email}...`);
    
    // Update users table
    const userResult = await pool.query(
      `UPDATE users SET role = $1 WHERE email = $2 RETURNING clerk_id, email, role`,
      ['admin', email]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`User with email ${email} not found in users table`);
      process.exit(1);
    }
    
    console.log('✅ Admin role set in users table:', userResult.rows[0]);
    
    // Also update Clerk unsafe_metadata (you'll need to do this via Clerk Dashboard or API)
    console.log('\n⚠️  IMPORTANT: Also update Clerk Dashboard:');
    console.log('1. Go to https://dashboard.clerk.com');
    console.log(`2. Find user: ${email}`);
    console.log('3. Go to "Metadata" tab');
    console.log('4. In "Unsafe metadata", add: { "role": "admin" }');
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error setting admin role:', err);
    await pool.end();
    process.exit(1);
  }
}

setAdmin();

