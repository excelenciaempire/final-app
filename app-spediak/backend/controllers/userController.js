const pool = require('../db');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Get user profile and subscription data
 * Creates all necessary records if they don't exist (for users who bypassed webhook)
 */
const getUserProfile = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user profile
    let profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE clerk_id = $1',
      [clerkId]
    );

    // Get user subscription
    let subscriptionResult = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    // Auto-create profile if it doesn't exist
    if (profileResult.rows.length === 0) {
      console.log(`[UserController] Creating missing profile for user ${clerkId}`);
      await pool.query(`
        INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (clerk_id) DO NOTHING
      `, [clerkId, 'NC', [], null, null]);

      profileResult = await pool.query(
        'SELECT * FROM user_profiles WHERE clerk_id = $1',
        [clerkId]
      );
    }

    // Auto-create subscription if it doesn't exist
    if (subscriptionResult.rows.length === 0) {
      console.log(`[UserController] Creating missing subscription for user ${clerkId}`);
      
      // Check for active promotions
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
          console.log(`[UserController] Active promotion: ${promoResult.rows[0].promo_name} (+${bonusStatements})`);
        }
      } catch (promoErr) {
        console.warn(`[UserController] Error checking promotions:`, promoErr.message);
      }
      
      const baseLimit = 5;
      const totalLimit = baseLimit + bonusStatements;
      
      await pool.query(`
        INSERT INTO user_subscriptions (clerk_id, plan_type, statements_used, statements_limit, last_reset_date, subscription_status)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (clerk_id) DO NOTHING
      `, [clerkId, 'free', 0, totalLimit, 'active']);
      
      // Link promo if applicable
      if (promoId) {
        await pool.query(`
          UPDATE users SET signup_promo_id = $1, promo_statements_granted = $2
          WHERE clerk_id = $3
        `, [promoId, bonusStatements, clerkId]);
      }

      subscriptionResult = await pool.query(
        'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      );
    }

    // Auto-create security flags if they don't exist
    await pool.query(`
      INSERT INTO user_security_flags (user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, fraud_flag)
      VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE)
      ON CONFLICT (user_clerk_id) DO NOTHING
    `, [clerkId]);

    // Get security flags
    const securityResult = await pool.query(
      'SELECT * FROM user_security_flags WHERE user_clerk_id = $1',
      [clerkId]
    );

    res.json({
      profile: profileResult.rows[0],
      subscription: subscriptionResult.rows[0] || null,
      securityFlags: securityResult.rows[0] || null
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile', error: error.message });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { 
      profilePhotoUrl, 
      primaryState, 
      secondaryStates, 
      organization,
      organizations, // Array of organizations
      companyName,
      phoneNumber
    } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Handle organizations - prefer array, fallback to single
    const orgsArray = organizations || (organization && organization !== 'None' ? [organization] : []);
    const primaryOrg = orgsArray.length > 0 ? orgsArray[0] : (organization || null);

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM user_profiles WHERE clerk_id = $1',
      [clerkId]
    );

    if (existingProfile.rows.length === 0) {
      // Create new profile - use simpler query without organizations column if it doesn't exist
      try {
        const result = await pool.query(`
          INSERT INTO user_profiles (
            clerk_id, 
            profile_photo_url, 
            primary_state, 
            secondary_states, 
            organization,
            organizations,
            company_name,
            phone_number,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
        `, [clerkId, profilePhotoUrl, primaryState, secondaryStates || [], primaryOrg, JSON.stringify(orgsArray), companyName, phoneNumber]);

        return res.json({ 
          message: 'Profile created successfully', 
          profile: result.rows[0] 
        });
      } catch (insertErr) {
        // If organizations column doesn't exist, try without it
        if (insertErr.message.includes('organizations')) {
          console.log('[UserController] organizations column not found, using fallback');
          const result = await pool.query(`
            INSERT INTO user_profiles (
              clerk_id, 
              profile_photo_url, 
              primary_state, 
              secondary_states, 
              organization,
              company_name,
              phone_number,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
          `, [clerkId, profilePhotoUrl, primaryState, secondaryStates || [], primaryOrg, companyName, phoneNumber]);

          return res.json({ 
            message: 'Profile created successfully', 
            profile: result.rows[0] 
          });
        }
        throw insertErr;
      }
    }

    // Update existing profile - try with organizations column first
    try {
      const result = await pool.query(`
        UPDATE user_profiles 
        SET 
          profile_photo_url = COALESCE($2, profile_photo_url),
          primary_state = COALESCE($3, primary_state),
          secondary_states = COALESCE($4, secondary_states),
          organization = COALESCE($5, organization),
          organizations = COALESCE($6, organizations),
          company_name = COALESCE($7, company_name),
          phone_number = COALESCE($8, phone_number),
          updated_at = NOW()
        WHERE clerk_id = $1
        RETURNING *
      `, [clerkId, profilePhotoUrl, primaryState, secondaryStates, primaryOrg, JSON.stringify(orgsArray), companyName, phoneNumber]);

      res.json({ 
        message: 'Profile updated successfully', 
        profile: result.rows[0] 
      });
    } catch (updateErr) {
      // If organizations column doesn't exist, try without it
      if (updateErr.message.includes('organizations')) {
        console.log('[UserController] organizations column not found, using fallback for update');
        const result = await pool.query(`
          UPDATE user_profiles 
          SET 
            profile_photo_url = COALESCE($2, profile_photo_url),
            primary_state = COALESCE($3, primary_state),
            secondary_states = COALESCE($4, secondary_states),
            organization = COALESCE($5, organization),
            company_name = COALESCE($6, company_name),
            phone_number = COALESCE($7, phone_number),
            updated_at = NOW()
          WHERE clerk_id = $1
          RETURNING *
        `, [clerkId, profilePhotoUrl, primaryState, secondaryStates, primaryOrg, companyName, phoneNumber]);

        return res.json({ 
          message: 'Profile updated successfully', 
          profile: result.rows[0] 
        });
      }
      throw updateErr;
    }

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

/**
 * Get user subscription status with usage limits
 * Includes promo checking and auto-creation for users who bypassed webhook
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let result = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    if (result.rows.length === 0) {
      console.log(`[UserController] Creating missing subscription for user ${clerkId}`);
      
      // Check for active promotions
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
          console.log(`[UserController] Active promotion: ${promoResult.rows[0].promo_name} (+${bonusStatements})`);
        }
      } catch (promoErr) {
        console.warn(`[UserController] Error checking promotions:`, promoErr.message);
      }
      
      const baseLimit = 5;
      const totalLimit = baseLimit + bonusStatements;

      // Create subscription with promo if applicable
      const newSub = await pool.query(`
        INSERT INTO user_subscriptions (
          clerk_id, 
          plan_type, 
          statements_used, 
          statements_limit, 
          last_reset_date,
          subscription_status
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING *
      `, [clerkId, 'free', 0, totalLimit, 'active']);
      
      // Link promo if applicable
      if (promoId) {
        await pool.query(`
          UPDATE users SET signup_promo_id = $1, promo_statements_granted = $2
          WHERE clerk_id = $3
        `, [promoId, bonusStatements, clerkId]);
      }

      const subscription = newSub.rows[0];
      return res.json({
        ...subscription,
        statements_remaining: subscription.statements_limit - subscription.statements_used,
        is_unlimited: false,
        can_generate: subscription.statements_used < subscription.statements_limit,
        promo_applied: promoId ? true : false,
        bonus_statements: bonusStatements
      });
    }

    const subscription = result.rows[0];

    // Check if we need to reset the counter (30 days for free tier)
    if (subscription.plan_type === 'free') {
      const now = new Date();
      const lastReset = new Date(subscription.last_reset_date);
      const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

      if (daysSinceReset >= 30) {
        // Reset the counter
        await pool.query(`
          UPDATE user_subscriptions 
          SET statements_used = 0, last_reset_date = NOW()
          WHERE clerk_id = $1
        `, [clerkId]);

        subscription.statements_used = 0;
        subscription.last_reset_date = now;
      }
    }

    // Check if user is admin or suspended
    const securityResult = await pool.query(
      'SELECT is_suspended, is_admin FROM user_security_flags WHERE user_clerk_id = $1',
      [clerkId]
    );
    
    const isSuspended = securityResult.rows.length > 0 && securityResult.rows[0].is_suspended;
    const isAdmin = securityResult.rows.length > 0 && securityResult.rows[0].is_admin;

    // Update last_login timestamp (non-blocking)
    pool.query('UPDATE users SET last_login = NOW() WHERE clerk_id = $1', [clerkId])
      .catch(err => console.warn('[UserController] Error updating last_login:', err.message));

    // Admins always have unlimited access
    const isUnlimited = isAdmin || subscription.plan_type !== 'free' && subscription.plan_type !== 'trial';
    const statementsRemaining = isUnlimited 
      ? -1 
      : subscription.statements_limit - subscription.statements_used;

    res.json({
      ...subscription,
      statements_remaining: statementsRemaining,
      is_unlimited: isUnlimited,
      is_admin: isAdmin,
      can_generate: !isSuspended && (isUnlimited || subscription.statements_used < subscription.statements_limit),
      is_suspended: isSuspended,
      plan_display: isAdmin ? 'Admin (Unlimited)' : subscription.plan_type
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ message: 'Failed to fetch subscription status', error: error.message });
  }
};

/**
 * Increment statement usage counter
 */
const incrementStatementUsage = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const subscription = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    if (subscription.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const sub = subscription.rows[0];

    // Check if free tier and at limit
    if (sub.plan_type === 'free' && sub.statements_used >= sub.statements_limit) {
      return res.status(403).json({ 
        message: 'Free plan limit reached. Please upgrade to Pro for unlimited statements.',
        statements_used: sub.statements_used,
        statements_limit: sub.statements_limit
      });
    }

    // Increment usage
    const updated = await pool.query(`
      UPDATE user_subscriptions 
      SET statements_used = statements_used + 1, updated_at = NOW()
      WHERE clerk_id = $1
      RETURNING *
    `, [clerkId]);

    res.json({
      message: 'Usage incremented successfully',
      subscription: updated.rows[0]
    });

  } catch (error) {
    console.error('Error incrementing usage:', error);
    res.status(500).json({ message: 'Failed to increment usage', error: error.message });
  }
};

/**
 * Sync user email after change in Clerk
 * Updates email across all relevant tables
 */
const syncUserEmail = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { newEmail, oldEmail } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!newEmail) {
      return res.status(400).json({ message: 'New email is required' });
    }

    console.log(`[UserController] Syncing email for user ${clerkId}: ${oldEmail} -> ${newEmail}`);

    // Update users table
    await pool.query(`
      UPDATE users 
      SET email = $1, updated_at = NOW()
      WHERE clerk_id = $2
    `, [newEmail, clerkId]);

    // Update admin_user_overrides if exists (match by old email or clerk_id)
    if (oldEmail) {
      await pool.query(`
        UPDATE admin_user_overrides 
        SET user_email = $1
        WHERE user_clerk_id = $2 OR user_email = $3
      `, [newEmail, clerkId, oldEmail]);
    }

    // Update any other tables that might reference email
    // (Most tables use clerk_id, so email sync in users table is the main concern)

    console.log(`[UserController] Email synced successfully for user ${clerkId}`);
    
    res.json({ 
      success: true, 
      message: 'Email synced successfully',
      email: newEmail 
    });

  } catch (error) {
    console.error('Error syncing email:', error);
    res.status(500).json({ message: 'Failed to sync email', error: error.message });
  }
};

/**
 * Change user email using Clerk Admin API (bypasses 2FA requirement)
 * This is the easiest way for users to change their email
 */
const changeEmail = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { newEmail } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!newEmail || !newEmail.trim()) {
      return res.status(400).json({ message: 'New email is required' });
    }

    const trimmedEmail = newEmail.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    console.log(`[UserController] Changing email for user ${clerkId} to ${trimmedEmail}`);

    // Get the current user from Clerk to get old email
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const oldEmail = clerkUser.emailAddresses?.[0]?.emailAddress;

    // Check if the email is the same
    if (oldEmail === trimmedEmail) {
      return res.status(400).json({ message: 'New email is the same as the current email' });
    }

    // Create new email address in Clerk using Admin API
    const newEmailAddress = await clerkClient.emailAddresses.createEmailAddress({
      userId: clerkId,
      emailAddress: trimmedEmail,
      verified: true, // Mark as verified since we're using admin API
      primary: true // Set as primary immediately
    });

    console.log(`[UserController] New email address created in Clerk: ${newEmailAddress.id}`);

    // Update in our database
    await pool.query('UPDATE users SET email = $1, updated_at = NOW() WHERE clerk_id = $2', [trimmedEmail, clerkId]);

    // Update admin_user_overrides if exists
    await pool.query('UPDATE admin_user_overrides SET user_email = $1 WHERE user_clerk_id = $2', [trimmedEmail, clerkId]);

    // Remove old email addresses (optional - keep only the new primary)
    try {
      for (const emailAddr of clerkUser.emailAddresses) {
        if (emailAddr.id !== newEmailAddress.id) {
          await clerkClient.emailAddresses.deleteEmailAddress(emailAddr.id);
          console.log(`[UserController] Removed old email: ${emailAddr.emailAddress}`);
        }
      }
    } catch (deleteErr) {
      console.warn('[UserController] Could not delete old email addresses:', deleteErr.message);
      // Continue anyway - the new email is set as primary
    }

    console.log(`[UserController] Email changed successfully for user ${clerkId}`);
    
    res.json({ 
      message: 'Email changed successfully', 
      newEmail: trimmedEmail,
      oldEmail: oldEmail
    });

  } catch (error) {
    console.error('[UserController] Error changing email:', error);
    
    // Handle specific Clerk errors
    if (error.errors) {
      const clerkError = error.errors[0];
      if (clerkError?.code === 'form_identifier_exists') {
        return res.status(400).json({ message: 'This email address is already registered to another account' });
      }
      return res.status(400).json({ message: clerkError?.longMessage || clerkError?.message || 'Error changing email' });
    }
    
    res.status(500).json({ message: 'Failed to change email', error: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  getSubscriptionStatus,
  incrementStatementUsage,
  syncUserEmail,
  changeEmail
};

