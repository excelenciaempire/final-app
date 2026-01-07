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
  const { id } = evt.data; // This might be undefined for some event types, but generally present for user.*
  const eventType = evt.type;

  console.log(`[Webhook] Processing event type: ${eventType} for primary ID (if applicable): ${id}`);

  // Handle the event
  switch (eventType) {
    case 'user.created':
      const {
        id: clerk_id_created,
        email_addresses: email_addresses_created,
        primary_email_address_id: primary_email_address_id_created,
        first_name: first_name_created,
        last_name: last_name_created,
        image_url: image_url_created,
        unsafe_metadata: unsafe_metadata_created,
        created_at: created_at_created,
        updated_at: updated_at_created, // Clerk sends this on create as well
        username: username_created_toplevel 
      } = evt.data;

      let primaryEmailCreated = email_addresses_created?.find(e => e.id === primary_email_address_id_created)?.email_address;
      if (!primaryEmailCreated && email_addresses_created?.length > 0) {
         primaryEmailCreated = email_addresses_created.find(e => e.verification?.status === 'verified')?.email_address;
         if (!primaryEmailCreated) primaryEmailCreated = email_addresses_created[0].email_address; // Fallback to the first email
      }
      
      const fullNameCreated = `${first_name_created || ''} ${last_name_created || ''}`.trim() || null;
      const usernameCreated = username_created_toplevel || unsafe_metadata_created?.username || null;
      const userStateCreated = unsafe_metadata_created?.inspectionState || null;
      const imageUrlCreated = image_url_created || null;

      if (!clerk_id_created || !primaryEmailCreated) {
        console.error('[Webhook] user.created: Missing required user data (Clerk ID or Primary Email) in event payload:', JSON.stringify(evt.data));
        return res.status(400).json({ error: 'Missing required user data in user.created webhook event.' });
      }

      console.log(`[Webhook] user.created: Extracted data - ID=${clerk_id_created}, Email=${primaryEmailCreated}, Name=${fullNameCreated}, Username=${usernameCreated}, State=${userStateCreated}`);

      try {
        const insertQuery = `
          INSERT INTO users (clerk_id, email, name, username, profile_photo_url, state, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0), TO_TIMESTAMP($8 / 1000.0));
        `;
        const insertValues = [
          clerk_id_created,
          primaryEmailCreated,
          fullNameCreated,
          usernameCreated,
          imageUrlCreated,
          userStateCreated,
          created_at_created,
          updated_at_created 
        ];
        await pool.query(insertQuery, insertValues);
        console.log(`[Webhook] user.created: Successfully INSERTED new user ${clerk_id_created}`);
        
        // Create user_profiles entry
        const organizationCreated = unsafe_metadata_created?.organization || null;
        const companyNameCreated = unsafe_metadata_created?.companyName || null;
        
        await pool.query(`
          INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (clerk_id) DO NOTHING
        `, [clerk_id_created, userStateCreated || 'NC', [], organizationCreated, companyNameCreated]);
        console.log(`[Webhook] user.created: Created user_profiles for ${clerk_id_created}`);
        
        // Check for active sign-up promotions
        let bonusStatements = 0;
        let promoId = null;
        try {
          const promoResult = await pool.query(`
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
            console.log(`[Webhook] user.created: Active promotion found - "${promoResult.rows[0].promo_name}" grants ${bonusStatements} bonus statements`);
          }
        } catch (promoErr) {
          console.warn(`[Webhook] user.created: Error checking promotions:`, promoErr.message);
        }

        // Create user_subscriptions entry with promotion bonus
        const baseLimit = 5;
        const totalLimit = baseLimit + bonusStatements;
        
        await pool.query(`
          INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, subscription_status)
          VALUES ($1, $2, $3, $4, NOW(), $5)
          ON CONFLICT (clerk_id) DO NOTHING
        `, [clerk_id_created, 'free', 0, totalLimit, 'active']);
        console.log(`[Webhook] user.created: Created user_subscriptions for ${clerk_id_created} (limit: ${totalLimit}${bonusStatements > 0 ? ` including ${bonusStatements} promo bonus` : ''})`);
        
        // Update user record with promo info if applicable
        if (promoId) {
          await pool.query(`
            UPDATE users SET signup_promo_id = $1, promo_statements_granted = $2
            WHERE clerk_id = $3
          `, [promoId, bonusStatements, clerk_id_created]);
          console.log(`[Webhook] user.created: Linked user ${clerk_id_created} to promotion ${promoId}`);
        }
        
        // Create default user_security_flags entry
        await pool.query(`
          INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag)
          VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE)
          ON CONFLICT (user_clerk_id) DO NOTHING
        `, [clerk_id_created]);
        console.log(`[Webhook] user.created: Created user_security_flags for ${clerk_id_created}`);
        
        // Log user creation to audit log
        await pool.query(`
          INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, action_details)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, ['system', 'user_created', 'user_management', 'user', clerk_id_created, JSON.stringify({
          email: primaryEmailCreated,
          name: fullNameCreated,
          state: userStateCreated,
          promotion_applied: promoId ? true : false,
          bonus_statements: bonusStatements
        })]);
        console.log(`[Webhook] user.created: Logged creation event for ${clerk_id_created}`);
      } catch (insertErr) {
        if (insertErr.code === '23505') { // Unique constraint violation (e.g., clerk_id or email already exists)
          console.warn(`[Webhook] user.created: INSERT failed for ${clerk_id_created} due to unique constraint (likely already exists). Attempting UPDATE as a fallback.`);
          try {
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
            // For created_at, we generally don't update it after initial creation.
            // updated_at from the event is the most current.
            const updateValues = [
              primaryEmailCreated,
              fullNameCreated,
              usernameCreated,
              imageUrlCreated,
              userStateCreated,
              updated_at_created, // Use the event's updated_at timestamp
              clerk_id_created
            ];
            const updateResult = await pool.query(updateQuery, updateValues);
            if (updateResult.rowCount > 0) {
              console.log(`[Webhook] user.created: Successfully UPDATED user ${clerk_id_created} after INSERT conflict.`);
            } else {
              // This case (INSERT fails for unique, then UPDATE finds 0 rows) should be rare.
              // It might mean the unique conflict was on a different column than clerk_id (e.g. email)
              // and the clerk_id in the event doesn't match an existing record.
              console.error(`[Webhook] user.created: UPDATE for ${clerk_id_created} affected 0 rows after INSERT conflict. This might indicate inconsistent data or a race condition. Clerk Data:`, evt.data);
            }
          } catch (updateErrOnConflict) {
            console.error(`[Webhook] user.created: Database error during fallback UPDATE for user ${clerk_id_created} after INSERT conflict:`, updateErrOnConflict);
            // Don't return 500 here to prevent Clerk from retrying endlessly if it's a persistent issue with THIS specific data.
            // The webhook was acknowledged, but processing this specific part failed.
          }
        } else {
          console.error(`[Webhook] user.created: Database error INSERTING new user ${clerk_id_created}:`, insertErr);
          // For a general insert error, it's okay to return 500 to signal Clerk to retry.
          return res.status(500).json({ error: 'Database insert operation failed for user.created.' });
        }
      }
      break;

    case 'user.updated':
      const {
        id: clerk_id_updated, // This is the clerk_id
        email_addresses: email_addresses_updated,
        primary_email_address_id: primary_email_address_id_updated,
        first_name: first_name_updated,
        last_name: last_name_updated,
        image_url: image_url_updated,
        unsafe_metadata: unsafe_metadata_updated,
        // created_at is generally not in the 'data' part of user.updated, but 'updated_at' is.
        updated_at: updated_at_updated, 
        username: username_updated_toplevel
      } = evt.data;

      let primaryEmailUpdated = email_addresses_updated?.find(e => e.id === primary_email_address_id_updated)?.email_address;
       if (!primaryEmailUpdated && email_addresses_updated?.length > 0) {
         primaryEmailUpdated = email_addresses_updated.find(e => e.verification?.status === 'verified')?.email_address;
         if (!primaryEmailUpdated) primaryEmailUpdated = email_addresses_updated[0].email_address; // Fallback to the first email
      }
      
      const fullNameUpdated = `${first_name_updated || ''} ${last_name_updated || ''}`.trim() || null;
      const usernameUpdated = username_updated_toplevel || unsafe_metadata_updated?.username || null;
      const userStateUpdated = unsafe_metadata_updated?.inspectionState || null;
      const imageUrlUpdated = image_url_updated || null;

      if (!clerk_id_updated) { // clerk_id is essential for update
        console.error('[Webhook] user.updated: Missing Clerk ID (id) in event payload:', JSON.stringify(evt.data));
        return res.status(400).json({ error: 'Missing Clerk ID in user.updated webhook event.' });
      }
       if (!primaryEmailUpdated) { 
        console.warn(`[Webhook] user.updated: Primary email not found for user ${clerk_id_updated}. Proceeding with update for other fields.`);
        // Allow update to proceed if email is missing, but log it. User might have no email or primary not set.
        // Depending on your schema, `email` column might be NOT NULL. If so, this needs careful handling.
        // Assuming 'email' can be null or you handle it. If it's NOT NULL and primaryEmailUpdated is null, DB will error.
      }

      console.log(`[Webhook] user.updated: Extracted data - ID=${clerk_id_updated}, Email=${primaryEmailUpdated}, Name=${fullNameUpdated}, Username=${usernameUpdated}, State=${userStateUpdated}`);
      
      try {
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
          primaryEmailUpdated, // This could be null if not found and DB allows it
          fullNameUpdated,
          usernameUpdated,
          imageUrlUpdated,
          userStateUpdated,
          updated_at_updated,
          clerk_id_updated
        ];

        const updateResult = await pool.query(updateQuery, updateValues);

        if (updateResult.rowCount === 0) {
          console.warn(`[Webhook] user.updated: User ${clerk_id_updated} not found in DB for update. RowCount: 0. Attempting to INSERT as a fallback.`);
          
          // Attempt to INSERT the user if UPDATE found no rows
          try {
            // created_at might not be in user.updated evt.data top-level directly from webhook
            // Prefer evt.data.created_at if present, otherwise use updated_at as a fallback for created_at for this healing insert
            const createdAtForInsert = evt.data.created_at || updated_at_updated; 

            const healingInsertQuery = `
              INSERT INTO users (clerk_id, email, name, username, profile_photo_url, state, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0), TO_TIMESTAMP($8 / 1000.0))
              ON CONFLICT (clerk_id) DO NOTHING; // If it was created by another process in the meantime, do nothing
            `;
            const healingInsertValues = [
              clerk_id_updated,
              primaryEmailUpdated, // This could be null if not found and DB allows it
              fullNameUpdated,
              usernameUpdated,
              imageUrlUpdated,
              userStateUpdated,
              createdAtForInsert, // Use determined created_at timestamp
              updated_at_updated  // Current updated_at
            ];
            await pool.query(healingInsertQuery, healingInsertValues);
            console.log(`[Webhook] user.updated: Successfully performed healing INSERT for user ${clerk_id_updated}.`);
          } catch (healingInsertErr) {
            console.error(`[Webhook] user.updated: Database error during healing INSERT for user ${clerk_id_updated}:`, healingInsertErr);
            // Don't return 500 here for the healing attempt to avoid retry loops if this specific data causes persistent insert issues.
          }
        } else {
          console.log(`[Webhook] user.updated: Successfully UPDATED user ${clerk_id_updated}.`);
        }
      } catch (dbErr) {
        console.error(`[Webhook] user.updated: Database error during UPDATE for user ${clerk_id_updated}:`, dbErr);
        if (dbErr.code === '23505') { 
             console.warn(`[Webhook] user.updated: UPDATE failed for ${clerk_id_updated} due to unique constraint violation (e.g., trying to change email to one that already exists for another user, or username conflict).`);
             // Acknowledge webhook (200), as it's a data conflict, not a system error.
        } else {
            // For other DB errors during update, signal Clerk to retry.
            return res.status(500).json({ error: 'Database update operation failed for user.updated.' });
        }
      }
      break;

    // TODO: Handle user.deleted event if necessary
    // case 'user.deleted':
    //    const { id: deleted_clerk_id, delete_memberships } = evt.data; // `delete_memberships` might also be relevant
    //    if (deleted_clerk_id) {
    //      try {
    //        const deleteQuery = `DELETE FROM users WHERE clerk_id = $1;`;
    //        const deleteResult = await pool.query(deleteQuery, [deleted_clerk_id]);
    //        if (deleteResult.rowCount > 0) {
    //          console.log(`[Webhook] user.deleted: Successfully DELETED user ${deleted_clerk_id}`);
    //        } else {
    //          console.warn(`[Webhook] user.deleted: User ${deleted_clerk_id} not found in DB for deletion.`);
    //        }
    //      } catch (deleteErr) {
    //        console.error(`[Webhook] user.deleted: Database error DELETING user ${deleted_clerk_id}:`, deleteErr);
    //        return res.status(500).json({ error: 'Database delete operation failed for user.deleted.' });
    //      }
    //    } else {
    //      console.warn('[Webhook] user.deleted: Event received without an ID. Data:', evt.data);
    //    }
    //    break;

    default:
      console.log(`[Webhook] Received unhandled event type: ${eventType}. ID (if available): ${id || 'N/A'}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};

module.exports = { handleClerkWebhook }; 