require('dotenv').config(); // Load environment variables from .env file
const { Pool } = require('pg');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// --- Configuration ---
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY; // Ensure this is set in your .env

if (!DATABASE_URL || !CLERK_SECRET_KEY) {
  console.error('Error: DATABASE_URL and CLERK_SECRET_KEY environment variables must be set.');
  process.exit(1);
}

// Initialize DB Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Adjust SSL based on your DB requirements
});

// --- Main Sync Function ---
async function syncClerkUsers() {
  console.log('Starting Clerk user sync...');
  let clerkUsers = [];
  let offset = 0;
  const limit = 50; // Fetch users in batches

  try {
    // 1. Fetch all users from Clerk (handles pagination)
    console.log('Fetching users from Clerk...');
    while (true) {
      const batch = await clerkClient.users.getUserList({ limit, offset });
      if (batch.length === 0) {
        break; // No more users
      }
      clerkUsers = clerkUsers.concat(batch);
      offset += batch.length;
      console.log(`Fetched ${clerkUsers.length} users so far...`);
    }
    console.log(`Total users fetched from Clerk: ${clerkUsers.length}`);

    if (clerkUsers.length === 0) {
      console.log('No users found in Clerk. Exiting.');
      return;
    }

    // 2. Connect to the database
    const client = await pool.connect();
    console.log('Connected to database.');

    try {
      // 3. Insert/Update users in the database
      let insertedCount = 0;
      let updatedCount = 0;

      for (const user of clerkUsers) {
        // Log first
        console.log("--- Raw User Object Start ---");
        console.log(JSON.stringify(user, null, 2)); 
        console.log("--- Raw User Object End ---");

        // Destructure only the ID, access others directly
        const { id: clerk_id } = user;

        // Access email directly
        const primaryEmail = user.emailAddresses?.[0]?.emailAddress;

        // Access other fields directly from the user object
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;
        const username = user.username || null; 
        const userState = user.unsafeMetadata?.inspectionState || null;
        const imageUrl = user.imageUrl || null;
        const createdAt = user.createdAt; // Raw timestamp number
        const updatedAt = user.updatedAt; // Raw timestamp number

        if (!clerk_id || !primaryEmail) {
          console.warn(`Skipping user ${clerk_id || '(no ID)'} due to missing ID or final Email:`, { id: clerk_id, email: primaryEmail });
          continue;
        }

        const query = `
          INSERT INTO users (clerk_id, email, name, username, profile_photo_url, state, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0), TO_TIMESTAMP($8 / 1000.0))
          ON CONFLICT (clerk_id) 
          DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            username = EXCLUDED.username,
            profile_photo_url = EXCLUDED.profile_photo_url,
            state = EXCLUDED.state,
            updated_at = TO_TIMESTAMP($9 / 1000.0)
          RETURNING xmax;
        `;

        // Build values array using directly accessed properties
        const values = [
          clerk_id,
          primaryEmail,
          fullName,
          username,
          imageUrl,      // Use directly accessed imageUrl
          userState,     // Use directly accessed userState
          createdAt,     // Use directly accessed createdAt
          updatedAt,     // Use directly accessed updatedAt
          updatedAt      // Use directly accessed updatedAt for update case ($9)
        ];

        console.log(` -> Preparing to UPSERT user ${clerk_id} with values:`, values);

        try {
          const result = await client.query(query, values);
          const wasInserted = result.rows[0]?.xmax === '0';
          
          if (wasInserted) {
            insertedCount++;
            console.log(` -> INSERTED user ${clerk_id}`);
            
            // For new users, create profile and subscription
            const organization = user.unsafeMetadata?.organization || null;
            const companyName = user.unsafeMetadata?.companyName || null;
            
            // Create user profile
            await client.query(`
              INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (clerk_id) DO NOTHING
            `, [clerk_id, userState || 'NC', [], organization, companyName]);
            console.log(` -> Created user_profiles for ${clerk_id}`);
            
            // Create user subscription (check for active promo)
            let bonusStatements = 0;
            let promoId = null;
            
            try {
              const promoResult = await client.query(`
                SELECT id, free_statements, promo_name
                FROM signup_promotions 
                WHERE is_active = TRUE 
                AND start_date <= CURRENT_DATE 
                AND end_date >= CURRENT_DATE
                ORDER BY created_at DESC
                LIMIT 1
              `);
              
              if (promoResult.rows.length > 0) {
                bonusStatements = promoResult.rows[0].free_statements || 0;
                promoId = promoResult.rows[0].id;
                console.log(` -> Active promotion found: ${promoResult.rows[0].promo_name} (+${bonusStatements} statements)`);
              }
            } catch (promoErr) {
              console.warn(` -> Error checking promotions:`, promoErr.message);
            }
            
            const baseLimit = 5;
            const totalLimit = baseLimit + bonusStatements;
            
            await client.query(`
              INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, subscription_status)
              VALUES ($1, $2, $3, $4, NOW(), $5)
              ON CONFLICT (clerk_id) DO NOTHING
            `, [clerk_id, 'free', 0, totalLimit, 'active']);
            console.log(` -> Created user_subscriptions for ${clerk_id} (limit: ${totalLimit})`);
            
            // Update promo info if applicable
            if (promoId) {
              await client.query(`
                UPDATE users SET signup_promo_id = $1, promo_statements_granted = $2
                WHERE clerk_id = $3
              `, [promoId, bonusStatements, clerk_id]);
            }
            
            // Create default security flags
            await client.query(`
              INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag)
              VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE)
              ON CONFLICT (user_clerk_id) DO NOTHING
            `, [clerk_id]);
            console.log(` -> Created user_security_flags for ${clerk_id}`);
            
          } else {
            updatedCount++;
            console.log(` -> UPDATED user ${clerk_id}`);
            
            // Ensure profile and subscription exist for existing users
            await client.query(`
              INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (clerk_id) DO NOTHING
            `, [clerk_id, userState || 'NC', [], null, null]);
            
            await client.query(`
              INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, subscription_status)
              VALUES ($1, $2, $3, $4, NOW(), $5)
              ON CONFLICT (clerk_id) DO NOTHING
            `, [clerk_id, 'free', 0, 5, 'active']);
            
            await client.query(`
              INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag)
              VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE)
              ON CONFLICT (user_clerk_id) DO NOTHING
            `, [clerk_id]);
          }
        } catch (dbErr) {
          console.error(`Error upserting user ${clerk_id}:`, dbErr);
        }
      }
      console.log(`Sync finished. Inserted: ${insertedCount}, Updated: ${updatedCount}`);

    } finally {
      // 4. Release the database connection
      client.release();
      console.log('Database connection released.');
    }

  } catch (error) {
    console.error('Error during Clerk user sync:', error);
  } finally {
    // Ensure the pool closes
    await pool.end();
    console.log('Database pool closed.');
  }
}

// --- Run the sync function ---
syncClerkUsers(); 