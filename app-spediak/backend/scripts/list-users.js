require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function listUsers() {
  try {
    const result = await pool.query(`
      SELECT 
        u.clerk_id,
        u.email,
        u.name,
        u.role,
        u.state,
        up.primary_state,
        up.organization,
        up.company_name,
        us.plan_type,
        us.statements_used,
        us.statements_limit,
        u.created_at
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      ORDER BY u.created_at DESC
    `);
    
    console.log(`Total users: ${result.rows.length}\n`);
    console.table(result.rows);
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

listUsers();

