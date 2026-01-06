const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateExistingUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting user data migration...\n');

    // Get all existing users from the users table
    const usersResult = await client.query('SELECT * FROM users ORDER BY created_at');
    const users = usersResult.rows;
    
    console.log(`Found ${users.length} existing users to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const clerkId = user.clerk_id;
      
      try {
        // Check if user_profile already exists
        const profileCheck = await client.query(
          'SELECT id FROM user_profiles WHERE clerk_id = $1',
          [clerkId]
        );

        if (profileCheck.rows.length === 0) {
          // Create user_profile entry
          await client.query(`
            INSERT INTO user_profiles (
              clerk_id, 
              profile_photo_url, 
              primary_state, 
              secondary_states, 
              organization, 
              company_name,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            clerkId,
            null, // profile_photo_url - will be updated by user
            'NC', // default primary_state
            [], // empty secondary_states array
            null, // organization - will be set by user
            null, // company_name - will be set by user
            user.created_at || new Date(),
            user.updated_at || new Date()
          ]);
          
          console.log(`✓ Created profile for user: ${clerkId}`);
        } else {
          console.log(`⊘ Profile already exists for: ${clerkId}`);
          skippedCount++;
          continue;
        }

        // Check if user_subscription already exists
        const subCheck = await client.query(
          'SELECT id FROM user_subscriptions WHERE clerk_id = $1',
          [clerkId]
        );

        if (subCheck.rows.length === 0) {
          // Create user_subscription entry with free tier defaults
          await client.query(`
            INSERT INTO user_subscriptions (
              clerk_id,
              plan_type,
              statements_used,
              statements_limit,
              last_reset_date,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            clerkId,
            'free', // default plan
            0, // statements_used starts at 0
            5, // free tier limit
            new Date(), // last_reset_date
            user.created_at || new Date(),
            user.updated_at || new Date()
          ]);
          
          console.log(`✓ Created subscription for user: ${clerkId}`);
        } else {
          console.log(`⊘ Subscription already exists for: ${clerkId}`);
        }

        migratedCount++;
        console.log('');

      } catch (error) {
        console.error(`❌ Error migrating user ${clerkId}:`, error.message);
        errorCount++;
        console.log('');
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount} users`);
    console.log(`  ⊘ Skipped (already exists): ${skippedCount} users`);
    console.log(`  ❌ Errors: ${errorCount} users`);
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const profileCount = await client.query('SELECT COUNT(*) FROM user_profiles');
    const subCount = await client.query('SELECT COUNT(*) FROM user_subscriptions');
    
    console.log(`  • user_profiles table: ${profileCount.rows[0].count} entries`);
    console.log(`  • user_subscriptions table: ${subCount.rows[0].count} entries`);
    
    console.log('\n✅ User migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateExistingUsers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

