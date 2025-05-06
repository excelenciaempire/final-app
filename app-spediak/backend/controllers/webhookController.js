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
      const { id: clerk_id, email_addresses, first_name, last_name, image_url, unsafe_metadata, created_at, updated_at } = evt.data;
      
      const primaryEmail = email_addresses?.find(e => e.id === evt.data.primary_email_address_id)?.email_address || email_addresses?.[0]?.email_address;
      const fullName = `${first_name || ''} ${last_name || ''}`.trim();
      const username = unsafe_metadata?.username || null; // Get username we stored
      const userState = unsafe_metadata?.inspectionState || null; // Get state if set

      if (!clerk_id || !primaryEmail) {
        console.error('[Webhook] Missing required user data (ID or Email) in event:', evt.data);
        return res.status(400).json({ error: 'Missing required user data in webhook event.' });
      }

      console.log(`[Webhook] User data extracted: ID=${clerk_id}, Email=${primaryEmail}, Name=${fullName}, Username=${username}, State=${userState}`);
      
      // Use INSERT ... ON CONFLICT ... DO UPDATE (UPSERT) to handle both creation and updates
      const query = `
        INSERT INTO users (clerk_id, email, name, username, profile_photo_url, state, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (clerk_id) 
        DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          username = EXCLUDED.username,
          profile_photo_url = EXCLUDED.profile_photo_url,
          state = EXCLUDED.state,
          updated_at = $9; -- Use the event timestamp for updated_at
      `;
      // Convert Unix timestamps (ms) from Clerk event to SQL Timestamps
      const createdAtTimestamp = new Date(created_at);
      const updatedAtTimestamp = new Date(updated_at);

      const values = [
        clerk_id,
        primaryEmail,
        fullName,
        username,
        image_url,
        userState,
        createdAtTimestamp, // Use converted timestamp
        updatedAtTimestamp, // Use converted timestamp for initial insert
        updatedAtTimestamp  // Use converted timestamp for update case ($9)
      ];

      try {
        await pool.query(query, values);
        console.log(`[Webhook] Successfully UPSERTED user ${clerk_id} for event ${eventType}`);
      } catch (dbErr) {
        console.error('[Webhook] Database error upserting user:', dbErr);
        // Don't send detailed DB errors back to Clerk
        return res.status(500).json({ error: 'Database operation failed.' });
      }
      break;
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