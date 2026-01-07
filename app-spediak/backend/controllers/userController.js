const pool = require('../db');

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
      companyName,
      phoneNumber
    } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM user_profiles WHERE clerk_id = $1',
      [clerkId]
    );

    if (existingProfile.rows.length === 0) {
      // Create new profile
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
      `, [clerkId, profilePhotoUrl, primaryState, secondaryStates || [], organization, companyName, phoneNumber]);

      return res.json({ 
        message: 'Profile created successfully', 
        profile: result.rows[0] 
      });
    }

    // Update existing profile
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
    `, [clerkId, profilePhotoUrl, primaryState, secondaryStates, organization, companyName, phoneNumber]);

    res.json({ 
      message: 'Profile updated successfully', 
      profile: result.rows[0] 
    });

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

    // Check if user is suspended
    const securityResult = await pool.query(
      'SELECT is_suspended FROM user_security_flags WHERE user_clerk_id = $1',
      [clerkId]
    );
    
    const isSuspended = securityResult.rows.length > 0 && securityResult.rows[0].is_suspended;

    const isUnlimited = subscription.plan_type !== 'free' && subscription.plan_type !== 'trial';
    const statementsRemaining = isUnlimited 
      ? -1 
      : subscription.statements_limit - subscription.statements_used;

    res.json({
      ...subscription,
      statements_remaining: statementsRemaining,
      is_unlimited: isUnlimited,
      can_generate: !isSuspended && (isUnlimited || subscription.statements_used < subscription.statements_limit),
      is_suspended: isSuspended
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

module.exports = {
  getUserProfile,
  updateProfile,
  getSubscriptionStatus,
  incrementStatementUsage
};

