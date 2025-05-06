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
          if (result.rows[0]?.xmax === '0') {
            insertedCount++;
             console.log(` -> INSERTED user ${clerk_id}`);
          } else {
            updatedCount++;
             console.log(` -> UPDATED user ${clerk_id}`);
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