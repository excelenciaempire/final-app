require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const requiredTables = [
  'users',
  'inspections',
  'prompts',
  'prompt_versions',
  'prompt_edit_locks',
  'knowledge_base',
  'user_profiles',
  'user_subscriptions',
  'sop_documents',
  'sop_state_assignments',
  'sop_org_assignments',
  'sop_history',
  'ad_inventory',
  'admin_audit_log',
  'discord_connections'
];

async function checkTablesExist() {
  console.log('\n📋 Checking if all required tables exist...\n');
  
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  const existingTables = result.rows.map(r => r.table_name);
  
  console.log('✅ Existing tables:', existingTables.length);
  existingTables.forEach(t => console.log(`   - ${t}`));
  
  const missingTables = requiredTables.filter(t => !existingTables.includes(t));
  
  if (missingTables.length > 0) {
    console.log('\n❌ Missing tables:');
    missingTables.forEach(t => console.log(`   - ${t}`));
    return false;
  }
  
  console.log('\n✅ All required tables exist!');
  return true;
}

async function checkIndexes() {
  console.log('\n📊 Checking indexes...\n');
  
  const result = await pool.query(`
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);
  
  console.log(`✅ Found ${result.rows.length} indexes`);
  
  const indexesByTable = {};
  result.rows.forEach(row => {
    if (!indexesByTable[row.tablename]) {
      indexesByTable[row.tablename] = [];
    }
    indexesByTable[row.tablename].push(row.indexname);
  });
  
  Object.keys(indexesByTable).sort().forEach(table => {
    console.log(`   ${table}: ${indexesByTable[table].length} indexes`);
  });
  
  return true;
}

async function checkTriggers() {
  console.log('\n⚡ Checking triggers...\n');
  
  const result = await pool.query(`
    SELECT 
      trigger_name,
      event_object_table,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);
  
  console.log(`✅ Found ${result.rows.length} triggers`);
  result.rows.forEach(row => {
    console.log(`   - ${row.trigger_name} on ${row.event_object_table}`);
  });
  
  return true;
}

async function checkUserData() {
  console.log('\n👥 Checking user data consistency...\n');
  
  // Count users
  const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(usersResult.rows[0].count);
  console.log(`✅ Total users: ${userCount}`);
  
  // Count user_profiles
  const profilesResult = await pool.query('SELECT COUNT(*) as count FROM user_profiles');
  const profileCount = parseInt(profilesResult.rows[0].count);
  console.log(`✅ User profiles: ${profileCount}`);
  
  // Count user_subscriptions
  const subsResult = await pool.query('SELECT COUNT(*) as count FROM user_subscriptions');
  const subsCount = parseInt(subsResult.rows[0].count);
  console.log(`✅ User subscriptions: ${subsCount}`);
  
  // Check for users missing profiles
  const missingProfiles = await pool.query(`
    SELECT u.clerk_id, u.email 
    FROM users u
    LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
    WHERE up.id IS NULL
  `);
  
  if (missingProfiles.rows.length > 0) {
    console.log(`\n⚠️  ${missingProfiles.rows.length} users missing profiles:`);
    missingProfiles.rows.forEach(u => console.log(`   - ${u.email} (${u.clerk_id})`));
  } else {
    console.log('✅ All users have profiles');
  }
  
  // Check for users missing subscriptions
  const missingSubs = await pool.query(`
    SELECT u.clerk_id, u.email 
    FROM users u
    LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
    WHERE us.id IS NULL
  `);
  
  if (missingSubs.rows.length > 0) {
    console.log(`\n⚠️  ${missingSubs.rows.length} users missing subscriptions:`);
    missingSubs.rows.forEach(u => console.log(`   - ${u.email} (${u.clerk_id})`));
  } else {
    console.log('✅ All users have subscriptions');
  }
  
  return missingProfiles.rows.length === 0 && missingSubs.rows.length === 0;
}

async function checkSopData() {
  console.log('\n📄 Checking SOP data...\n');
  
  const docsResult = await pool.query('SELECT COUNT(*) as count FROM sop_documents');
  const docsCount = parseInt(docsResult.rows[0].count);
  console.log(`✅ SOP documents: ${docsCount}`);
  
  const stateAssignments = await pool.query('SELECT COUNT(*) as count FROM sop_state_assignments');
  const stateCount = parseInt(stateAssignments.rows[0].count);
  console.log(`✅ State assignments: ${stateCount}`);
  
  const orgAssignments = await pool.query('SELECT COUNT(*) as count FROM sop_org_assignments');
  const orgCount = parseInt(orgAssignments.rows[0].count);
  console.log(`✅ Organization assignments: ${orgCount}`);
  
  const historyResult = await pool.query('SELECT COUNT(*) as count FROM sop_history');
  const historyCount = parseInt(historyResult.rows[0].count);
  console.log(`✅ SOP history entries: ${historyCount}`);
  
  return true;
}

async function checkAdsData() {
  console.log('\n📢 Checking Ads data...\n');
  
  const adsResult = await pool.query('SELECT COUNT(*) as count FROM ad_inventory');
  const adsCount = parseInt(adsResult.rows[0].count);
  console.log(`✅ Ad inventory: ${adsCount}`);
  
  const activeAds = await pool.query("SELECT COUNT(*) as count FROM ad_inventory WHERE status = 'active'");
  const activeCount = parseInt(activeAds.rows[0].count);
  console.log(`✅ Active ads: ${activeCount}`);
  
  return true;
}

async function checkForeignKeys() {
  console.log('\n🔗 Checking foreign key constraints...\n');
  
  const result = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);
  
  console.log(`✅ Found ${result.rows.length} foreign key constraints`);
  result.rows.forEach(row => {
    console.log(`   - ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
  });
  
  return true;
}

async function checkSubscriptionPlans() {
  console.log('\n💳 Checking subscription plan distribution...\n');
  
  const result = await pool.query(`
    SELECT 
      plan_type,
      COUNT(*) as count,
      AVG(statements_used) as avg_used,
      AVG(statements_limit) as avg_limit
    FROM user_subscriptions
    GROUP BY plan_type
    ORDER BY plan_type
  `);
  
  result.rows.forEach(row => {
    console.log(`   ${row.plan_type}: ${row.count} users (avg: ${parseFloat(row.avg_used).toFixed(1)}/${parseFloat(row.avg_limit).toFixed(0)} statements)`);
  });
  
  return true;
}

async function fixMissingProfiles() {
  console.log('\n🔧 Fixing missing profiles and subscriptions...\n');
  
  // Fix missing profiles
  const fixProfilesResult = await pool.query(`
    INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
    SELECT 
      u.clerk_id,
      COALESCE(u.state, 'NC'),
      ARRAY[]::TEXT[],
      NULL,
      NULL
    FROM users u
    LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
    WHERE up.id IS NULL
    ON CONFLICT (clerk_id) DO NOTHING
    RETURNING clerk_id
  `);
  
  console.log(`✅ Created ${fixProfilesResult.rows.length} missing profiles`);
  
  // Fix missing subscriptions
  const fixSubsResult = await pool.query(`
    INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date)
    SELECT 
      u.clerk_id,
      'free',
      0,
      5,
      NOW()
    FROM users u
    LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
    WHERE us.id IS NULL
    ON CONFLICT (clerk_id) DO NOTHING
    RETURNING clerk_id
  `);
  
  console.log(`✅ Created ${fixSubsResult.rows.length} missing subscriptions`);
  
  return true;
}

async function runDiagnostics() {
  console.log('🏥 DATABASE DIAGNOSTICS');
  console.log('=' .repeat(60));
  
  try {
    console.log('\n🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!\n');
    
    const allChecks = [];
    
    allChecks.push(await checkTablesExist());
    allChecks.push(await checkIndexes());
    allChecks.push(await checkTriggers());
    allChecks.push(await checkForeignKeys());
    allChecks.push(await checkUserData());
    allChecks.push(await checkSubscriptionPlans());
    allChecks.push(await checkSopData());
    allChecks.push(await checkAdsData());
    
    // Auto-fix if needed
    const userDataOk = allChecks[4];
    if (!userDataOk) {
      await fixMissingProfiles();
      console.log('\n🔄 Re-checking user data after fixes...');
      await checkUserData();
    }
    
    console.log('\n' + '='.repeat(60));
    const allPassed = allChecks.every(c => c === true);
    
    if (allPassed) {
      console.log('✅ ALL CHECKS PASSED!');
      console.log('🎉 Database is healthy and fully operational!');
    } else {
      console.log('⚠️  SOME CHECKS FAILED');
      console.log('Please review the output above and run migrations if needed.');
    }
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run diagnostics
runDiagnostics();

