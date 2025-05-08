const { Webhook } = require('svix');
const { Pool } = require('pg');
const express = require('express'); // Need express for raw body

// Initialize DB Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Clerk Webhook Secret - MUST be set in environment variables
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

if (!CLERK_WEBHOOK_SECRET) {
  console.error("FATAL ERROR: CLERK_WEBHOOK_SECRET environment variable is not set.");
  // Optionally exit or prevent server start in a real app
}

const handleClerkWebhook = async (req, res) => {
  console.log('[Webhook] Received request...');
  
  if (!CLERK_WEBHOOK_SECRET) {
    console.error('[Webhook] Webhook secret not configured.');
    return res.status(500).json({ error: 'Webhook secret not configured.' });
  }

  // Get the headers
  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
      console.warn('[Webhook] Missing Svix headers.');
    return res.status(400).json({ error: 'Error occurred -- no svix headers' });
  }

  // Get the body
  // Important: req.body needs to be the raw buffer/string from express.raw()
  const payload = req.body;
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let evt;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
    console.log('[Webhook] Verified successfully. Event type:', evt.type);
  } catch (err) {
    console.error('[Webhook] Error verifying webhook:', err.message);
    return res.status(400).json({ 'error': err.message });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`[Webhook] Processing event type: ${eventType} for ID: ${id}`);

  // Handle the event
  switch (eventType) {
    case 'user.created':
    case 'user.updated': // Handle updates too, to keep data fresh
      // Destructure potentially available fields
      const { id: clerk_id, email_addresses, primary_email_address_id, first_name, last_name, image_url, unsafe_metadata, created_at, updated_at, username: topLevelUsername } = evt.data;
      
      // Robust email extraction
      let primaryEmail = email_addresses?.find(e => e.id === primary_email_address_id)?.email_address;
      if (!primaryEmail) primaryEmail = email_addresses?.find(e => e.verification?.status === 'verified')?.email_address;
      if (!primaryEmail) primaryEmail = email_addresses?.[0]?.email_address;
      
      const fullName = `${first_name || ''} ${last_name || ''}`.trim() || null;
      // Prefer top-level username, fallback to metadata if needed (though metadata shouldn't be primary source)
      const username = topLevelUsername || unsafe_metadata?.username || null;
      const userState = unsafe_metadata?.inspectionState || null;
      const imageUrl = image_url || null;
      const createdAt = created_at;
      const updatedAt = updated_at;

      if (!clerk_id || !primaryEmail) {
        console.error('[Webhook] Missing required user data (ID or Email) in event:', evt.data);
        return res.status(400).json({ error: 'Missing required user data in webhook event.' });
      }

      console.log(`[Webhook] User data extracted: ID=${clerk_id}, Email=${primaryEmail}, Name=${fullName}, Username=${username}, State=${userState}`);
      
      // --- NEW Logic: Try UPDATE first, then INSERT if needed ---
      try {
        // 1. Attempt to UPDATE first based on clerk_id
        const updateQuery = `
          UPDATE users SET
            email = $1,
            name = $2,
            username = $3,
            profile_photo_url = $4,
            state = $5,
            updated_at = TO_TIMESTAMP($6 / 1000.0)
          WHERE clerk_id = $7;
        `;
        const updateValues = [
          primaryEmail,
          fullName,
          username,
          imageUrl,
          userState,
          updatedAt,
          clerk_id
        ];

        const updateResult = await pool.query(updateQuery, updateValues);

        // 2. If no rows were updated, the user doesn't exist, so INSERT
        if (updateResult.rowCount === 0 && eventType === 'user.created') { // Only insert on 'user.created' if update failed
            console.log(`[Webhook] User ${clerk_id} not found for update, attempting INSERT...`);
            const insertQuery = `
                INSERT INTO users (clerk_id, email, name, username, profile_photo_url, state, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0), TO_TIMESTAMP($8 / 1000.0));
            `;
            const insertValues = [
                clerk_id,
                primaryEmail,
                fullName,
                username,
                imageUrl,
                userState,
                createdAt,
                updatedAt
            ];
            try {
                 await pool.query(insertQuery, insertValues);
                 console.log(`[Webhook] Successfully INSERTED user ${clerk_id}`);
            } catch (insertErr) {
                 // Handle potential INSERT error (e.g., maybe email conflict if logic is complex)
                 console.error(`[Webhook] Database error INSERTING user ${clerk_id} after update attempt failed:`, insertErr);
                 // Decide if this should be a 500 or if it's an expected conflict
                 if (insertErr.code !== '23505') { // Only error out if it's not a duplicate key error
                     return res.status(500).json({ error: 'Database insert operation failed.' });
                 } else {
                      console.warn(`[Webhook] INSERT failed for ${clerk_id}, likely due to pre-existing email/username. Update should handle.`);
                 }
            }
        } else if (updateResult.rowCount > 0) {
            console.log(`[Webhook] Successfully UPDATED user ${clerk_id} via webhook.`);
        } else {
             console.log(`[Webhook] User ${clerk_id} not found for update, and event type was not user.created. No action taken.`);
        }

      } catch (dbErr) {
        // Catch potential errors during UPDATE (like email conflict if UPDATE tries to change email)
        console.error('[Webhook] Database error during UPDATE attempt:', dbErr);
        if (dbErr.code === '23505') { // Specifically handle duplicate key on update
             console.warn(`[Webhook] UPDATE failed for ${clerk_id}, likely due to conflicting email/username.`);
             // Don't return 500, just acknowledge webhook potentially
        } else {
            return res.status(500).json({ error: 'Database update operation failed.' });
        }
      }
      break; // End of user.created / user.updated case
    // TODO: Handle user.deleted event if necessary (remove user from your DB)
    // case 'user.deleted':
    //    const { id: deleted_id } = evt.data;
    //    // ... delete user from your DB using deleted_id ...
    //    break;
    default:
      console.log(`[Webhook] Unhandled event type ${eventType}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};

module.exports = { handleClerkWebhook }; 