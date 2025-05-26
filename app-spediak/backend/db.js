const { Pool } = require('pg');
require('dotenv').config(); // To load environment variables from a .env file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Your Neon connection string
  ssl: {
    rejectUnauthorized: false // Adjust SSL settings as per Neon's recommendations if needed
  }
});

pool.on('connect', () => {
  console.log('Connected to Neon database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool; 