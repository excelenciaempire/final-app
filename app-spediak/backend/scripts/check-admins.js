const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

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

