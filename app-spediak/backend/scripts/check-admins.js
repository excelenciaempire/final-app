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

async function checkAdmins() {
  console.log('--- Current Admins ---\n');
  const result = await pool.query(`
    SELECT u.email, sf.is_admin 
    FROM users u 
    JOIN user_security_flags sf ON u.clerk_id = sf.user_clerk_id 
    WHERE sf.is_admin = TRUE
  `);
  result.rows.forEach(a => console.log('👑', a.email));
  
  console.log('\n--- Looking for wipet/daxiake user ---');
  const search = await pool.query(`
    SELECT email FROM users 
    WHERE LOWER(email) LIKE '%wipet%' OR LOWER(email) LIKE '%daxiake%'
  `);
  if (search.rows.length === 0) {
    console.log('No user found with wipet/daxiake in email');
  } else {
    search.rows.forEach(u => console.log('Found:', u.email));
  }
  
  await pool.end();
}

checkAdmins().catch(console.error);

