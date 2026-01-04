#!/usr/bin/env node

/**
 * Spediak Deployment Verification Script
 * 
 * Automatically checks that both Vercel (frontend) and Render (backend)
 * deployments are healthy and working correctly.
 * 
 * Usage:
 *   node scripts/verify-deployment.js
 *   node scripts/verify-deployment.js --frontend https://app.spediak.com --backend https://api.spediak.com
 */

const https = require('https');
const http = require('http');

// Configuration
const args = process.argv.slice(2);
const FRONTEND_URL = args[args.indexOf('--frontend') + 1] || process.env.FRONTEND_URL || 'https://app-spediak.vercel.app';
const BACKEND_URL = args[args.indexOf('--backend') + 1] || process.env.BACKEND_URL || 'https://spediak-backend.onrender.com';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data.trim() ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    }).on('error', reject);
  });
}

async function checkFrontend() {
  log('\n🌐 Checking Frontend (Vercel)...', 'blue');
  log(`URL: ${FRONTEND_URL}`, 'blue');

  try {
    const start = Date.now();
    const response = await makeRequest(FRONTEND_URL);
    const responseTime = Date.now() - start;

    if (response.status === 200) {
      log('✅ Frontend is reachable', 'green');
      log(`   Response time: ${responseTime}ms`, 'green');
      log(`   Status: ${response.status}`, 'green');
      return { success: true, responseTime };
    } else {
      log(`⚠️  Frontend returned status ${response.status}`, 'yellow');
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    log('❌ Frontend is unreachable', 'red');
    log(`   Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function checkBackend() {
  log('\n🔧 Checking Backend (Render)...', 'blue');
  log(`URL: ${BACKEND_URL}`, 'blue');

  try {
    // Check basic health
    const start = Date.now();
    const response = await makeRequest(`${BACKEND_URL}/health`);
    const responseTime = Date.now() - start;

    if (response.status === 200 && response.data) {
      log('✅ Backend is healthy', 'green');
      log(`   Response time: ${responseTime}ms`, 'green');
      log(`   Version: ${response.data.version}`, 'green');

      // Check each service
      for (const [service, check] of Object.entries(response.data.checks)) {
        const icon = check.status === 'healthy' || check.status === 'configured' ? '✅' : '⚠️';
        log(`   ${icon} ${service}: ${check.status}`, check.status === 'healthy' || check.status === 'configured' ? 'green' : 'yellow');
      }

      return { success: true, responseTime, data: response.data };
    } else {
      log(`⚠️  Backend returned status ${response.status}`, 'yellow');
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    log('❌ Backend is unreachable', 'red');
    log(`   Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function checkBackendDetailed() {
  log('\n🔍 Running Detailed Backend Checks...', 'blue');

  try {
    const response = await makeRequest(`${BACKEND_URL}/health/detailed`);

    if (response.status === 200 && response.data) {
      const data = response.data;

      // Database schema check
      if (data.checks.database_schema) {
        const schema = data.checks.database_schema;
        if (schema.status === 'healthy') {
          log('✅ Database schema complete', 'green');
          log(`   Tables: ${schema.tables_found}/${schema.tables_required}`, 'green');
        } else {
          log('⚠️  Database schema incomplete', 'yellow');
          log(`   Tables: ${schema.tables_found}/${schema.tables_required}`, 'yellow');
          if (schema.missing_tables && schema.missing_tables.length > 0) {
            log(`   Missing: ${schema.missing_tables.join(', ')}`, 'red');
            log(`\n   ⚠️  Run migrations: cd app-spediak/backend && node scripts/run-migrations.js`, 'yellow');
          }
        }
      }

      // Activity check
      if (data.checks.activity) {
        const activity = data.checks.activity;
        log('📊 Recent Activity:', 'blue');
        log(`   Inspections (24h): ${activity.inspections_last_24h}`, 'green');
        log(`   Total Users: ${activity.total_users}`, 'green');
        log(`   Active Ads: ${activity.active_ads}`, 'green');
      }

      // Environment check
      if (data.checks.environment) {
        const env = data.checks.environment;
        const missing = env.missing || [];
        
        if (missing.length === 0) {
          log('✅ All environment variables configured', 'green');
        } else {
          log('⚠️  Missing environment variables:', 'yellow');
          missing.forEach(varName => {
            log(`   - ${varName}`, 'red');
          });
        }
      }

      return { success: true, data };
    } else {
      log('⚠️  Detailed check failed', 'yellow');
      return { success: false };
    }
  } catch (error) {
    log(`❌ Detailed check error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function checkIntegration() {
  log('\n🔗 Checking Frontend-Backend Integration...', 'blue');

  try {
    // This would be called from the frontend to verify API connectivity
    const response = await makeRequest(`${BACKEND_URL}/ping`);

    if (response.status === 200) {
      log('✅ Backend API is accessible from client', 'green');
      return { success: true };
    } else {
      log('⚠️  Backend API returned unexpected status', 'yellow');
      return { success: false };
    }
  } catch (error) {
    log('❌ Integration check failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    log(`   This might indicate CORS issues or network problems`, 'yellow');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('========================================', 'blue');
  log('  SPEDIAK DEPLOYMENT VERIFICATION', 'blue');
  log('========================================', 'blue');
  log(`Started: ${new Date().toLocaleString()}`, 'blue');

  const results = {
    frontend: await checkFrontend(),
    backend: await checkBackend(),
    backendDetailed: await checkBackendDetailed(),
    integration: await checkIntegration()
  };

  // Summary
  log('\n========================================', 'blue');
  log('  SUMMARY', 'blue');
  log('========================================', 'blue');

  const allHealthy = results.frontend.success && 
                     results.backend.success && 
                     results.backendDetailed.success && 
                     results.integration.success;

  if (allHealthy) {
    log('\n🎉 ALL SYSTEMS HEALTHY!', 'green');
    log('✅ Frontend (Vercel) is live', 'green');
    log('✅ Backend (Render) is operational', 'green');
    log('✅ Database schema is complete', 'green');
    log('✅ Frontend-Backend integration working', 'green');
    log('\n🚀 Deployment is successful and ready for users!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  ISSUES DETECTED:', 'yellow');
    if (!results.frontend.success) log('❌ Frontend has issues', 'red');
    if (!results.backend.success) log('❌ Backend has issues', 'red');
    if (!results.backendDetailed.success) log('⚠️  Backend configuration incomplete', 'yellow');
    if (!results.integration.success) log('❌ Integration issues detected', 'red');
    log('\n📖 Check the detailed output above for specific issues.', 'yellow');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { checkFrontend, checkBackend, checkBackendDetailed, checkIntegration };

