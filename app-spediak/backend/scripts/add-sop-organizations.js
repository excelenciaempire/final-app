/**
 * Migration: Add sop_organizations table
 */
const pool = require('../db');

async function migrate() {
  try {
    console.log('Creating sop_organizations table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sop_organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    console.log('✅ sop_organizations table created');
    
    // Add default organizations
    const defaults = ['InterNACHI', 'ASHI', 'State Specific'];
    for (const name of defaults) {
      await pool.query(`
        INSERT INTO sop_organizations (name, created_at)
        VALUES ($1, NOW())
        ON CONFLICT (name) DO NOTHING
      `, [name]);
    }
    
    console.log('✅ Default organizations added');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

migrate();
