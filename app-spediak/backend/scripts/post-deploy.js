#!/usr/bin/env node

/**
 * Post-Deployment Script for Render
 * 
 * This script runs automatically after Render deploys the backend.
 * It verifies the deployment is healthy and optionally runs migrations.
 * 
 * Configure in Render:
 * Build Command: npm install
 * Start Command: npm start
 * Post-Deploy Hook: node scripts/post-deploy.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyDeployment() {
  console.log('🚀 Running post-deployment verification...\n');

  try {
    // Check database connection
    console.log('📊 Checking database connection...');
    const result = await pool.query('SELECT NOW(), version()');
    console.log('✅ Database connected successfully');
    console.log(`   Server time: ${result.rows[0].now}`);
    console.log(`   PostgreSQL version: ${result.rows[0].version.split(',')[0]}\n`);

    // Check all tables exist
    console.log('🔍 Verifying database schema...');
    const tableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tableResult.rows.map(r => r.table_name);
    const requiredTables = [
      'users',
      'inspections',
      'prompts',
      'prompt_versions',
      'knowledge_documents',
      'knowledge_chunks',
      'user_profiles',
      'user_subscriptions',
      'sop_documents',
      'sop_assignments',
      'sop_history',
      'ad_inventory',
      'admin_audit_log',
      'discord_connections'
    ];

    console.log(`Found ${tables.length} tables:`);
    tables.forEach(table => {
      const required = requiredTables.includes(table);
      console.log(`   ${required ? '✅' : '⚪'} ${table}`);
    });

    const missingTables = requiredTables.filter(t => !tables.includes(t));
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables detected:');
      missingTables.forEach(table => console.log(`   ❌ ${table}`));
      console.log('\n💡 Run migrations: node scripts/run-migrations.js');
      
      // Auto-run migrations if enabled
      if (process.env.AUTO_RUN_MIGRATIONS === 'true') {
        console.log('\n🔄 AUTO_RUN_MIGRATIONS enabled, running migrations...');
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
          exec('node scripts/run-migrations.js', (error, stdout, stderr) => {
            if (error) {
              console.error('❌ Migration failed:', error);
              reject(error);
            } else {
              console.log(stdout);
              console.log('✅ Migrations completed');
              resolve();
            }
          });
        });
      }
    } else {
      console.log('\n✅ All required tables present\n');
    }

    // Check environment variables
    console.log('🔐 Checking environment variables...');
    const requiredEnvVars = [
      'DATABASE_URL',
      'OPENAI_API_KEY',
      'CLERK_SECRET_KEY',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length === 0) {
      console.log('✅ All required environment variables configured\n');
    } else {
      console.log('⚠️  Missing environment variables:');
      missingEnvVars.forEach(varName => console.log(`   ❌ ${varName}`));
      console.log('\n💡 Add missing variables in Render dashboard\n');
    }

    // Success summary
    console.log('========================================');
    console.log('  POST-DEPLOYMENT VERIFICATION');
    console.log('========================================');
    console.log(`✅ Database: Connected`);
    console.log(`✅ Schema: ${tables.length} tables`);
    console.log(`${missingTables.length === 0 ? '✅' : '⚠️ '} Required tables: ${missingTables.length === 0 ? 'Complete' : `${missingTables.length} missing`}`);
    console.log(`${missingEnvVars.length === 0 ? '✅' : '⚠️ '} Environment: ${missingEnvVars.length === 0 ? 'Complete' : `${missingEnvVars.length} missing`}`);
    console.log('========================================\n');

    if (missingTables.length === 0 && missingEnvVars.length === 0) {
      console.log('🎉 Deployment verification passed!');
      console.log('🚀 Service is ready to accept requests\n');
      process.exit(0);
    } else {
      console.log('⚠️  Deployment has warnings (service will still start)');
      console.log('📖 Review issues above\n');
      process.exit(0); // Don't fail deployment, just warn
    }

  } catch (error) {
    console.error('❌ Post-deployment verification failed:', error);
    console.error('\n⚠️  Service will still start, but may have issues');
    console.error('📖 Check Render logs for details\n');
    process.exit(0); // Don't fail deployment
  } finally {
    await pool.end();
  }
}

verifyDeployment();

