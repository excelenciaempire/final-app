require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const { rows } = await pool.query('SELECT email, name, role, state FROM users ORDER BY created_at DESC LIMIT 50');
    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();

