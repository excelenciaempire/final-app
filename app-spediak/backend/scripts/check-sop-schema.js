const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Hvm0Vl9YEqhn@ep-raspy-thunder-a4eiuopm-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  console.log('=== sop_assignments columns ===');
  const assignments = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'sop_assignments'"
  );
  assignments.rows.forEach(r => console.log(' -', r.column_name));

  console.log('\n=== sop_history columns ===');
  const history = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'sop_history'"
  );
  history.rows.forEach(r => console.log(' -', r.column_name));

  console.log('\n=== sop_documents columns ===');
  const docs = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'sop_documents'"
  );
  docs.rows.forEach(r => console.log(' -', r.column_name));

  await pool.end();
}

checkColumns().catch(console.error);

