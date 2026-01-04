const express = require('express');
const router = express.Router();
const pool = require('../db');
const cloudinary = require('cloudinary').v2;
const { OpenAI } = require('openai');

// Basic health check
router.get('/health', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    service: 'spediak-backend',
    version: '2.0.0',
    checks: {}
  };

  try {
    // Check database connection
    const dbStart = Date.now();
    const dbResult = await pool.query('SELECT NOW()');
    checks.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart + 'ms',
      timestamp: dbResult.rows[0].now
    };
  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // Check Cloudinary configuration
  try {
    checks.checks.cloudinary = {
      status: cloudinary.config().cloud_name ? 'configured' : 'not-configured',
      cloud_name: cloudinary.config().cloud_name ? 'configured' : 'missing'
    };
  } catch (error) {
    checks.checks.cloudinary = {
      status: 'error',
      error: error.message
    };
  }

  // Check OpenAI configuration
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    checks.checks.openai = {
      status: process.env.OPENAI_API_KEY ? 'configured' : 'not-configured'
    };
  } catch (error) {
    checks.checks.openai = {
      status: 'error',
      error: error.message
    };
  }

  // Check Clerk configuration
  checks.checks.clerk = {
    status: process.env.CLERK_SECRET_KEY ? 'configured' : 'not-configured'
  };

  // Overall status
  const allHealthy = Object.values(checks.checks).every(
    check => check.status === 'healthy' || check.status === 'configured'
  );

  res.status(allHealthy ? 200 : 503).json(checks);
});

// Detailed health check with database schema verification
router.get('/health/detailed', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    service: 'spediak-backend',
    version: '2.0.0',
    deployment: process.env.RENDER_SERVICE_NAME || 'local',
    checks: {}
  };

  try {
    // Check all required tables exist
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

    const missingTables = requiredTables.filter(t => !tables.includes(t));

    checks.checks.database_schema = {
      status: missingTables.length === 0 ? 'healthy' : 'incomplete',
      tables_found: tables.length,
      tables_required: requiredTables.length,
      missing_tables: missingTables
    };

    if (missingTables.length > 0) {
      checks.status = 'unhealthy';
    }

    // Check recent activity
    const activityResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM inspections WHERE created_at > NOW() - INTERVAL '24 hours') as inspections_24h,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM ad_inventory WHERE status = 'active') as active_ads
    `);

    checks.checks.activity = {
      status: 'healthy',
      inspections_last_24h: parseInt(activityResult.rows[0].inspections_24h),
      total_users: parseInt(activityResult.rows[0].total_users),
      active_ads: parseInt(activityResult.rows[0].active_ads)
    };

  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.database_schema = {
      status: 'error',
      error: error.message
    };
  }

  // Environment variables check
  checks.checks.environment = {
    status: 'healthy',
    variables: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
      DISCORD_CLIENT_ID: !!process.env.DISCORD_CLIENT_ID,
      DISCORD_CLIENT_SECRET: !!process.env.DISCORD_CLIENT_SECRET
    }
  };

  const missingEnvVars = Object.entries(checks.checks.environment.variables)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    checks.checks.environment.missing = missingEnvVars;
    checks.checks.environment.status = 'incomplete';
  }

  res.status(checks.status === 'healthy' ? 200 : 503).json(checks);
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'spediak-backend'
  });
});

module.exports = router;

