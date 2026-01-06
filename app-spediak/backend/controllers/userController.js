const pool = require('../db');

/**
 * Get user profile and subscription data
 */
const getUserProfile = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user profile
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE clerk_id = $1',
      [clerkId]
    );

    // Get user subscription
    const subscriptionResult = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    if (profileResult.rows.length === 0) {
      // Create default profile if it doesn't exist
      await pool.query(`
        INSERT INTO user_profiles (clerk_id, primary_state, secondary_states, organization, company_name)
        VALUES ($1, $2, $3, $4, $5)
      `, [clerkId, 'NC', [], null, null]);

      const newProfile = await pool.query(
        'SELECT * FROM user_profiles WHERE clerk_id = $1',
        [clerkId]
      );

      return res.json({
        profile: newProfile.rows[0],
        subscription: subscriptionResult.rows[0] || null
      });
    }

    res.json({
      profile: profileResult.rows[0],
      subscription: subscriptionResult.rows[0] || null
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
      companyName 
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
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [clerkId, profilePhotoUrl, primaryState, secondaryStates || [], organization, companyName]);

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
        updated_at = NOW()
      WHERE clerk_id = $1
      RETURNING *
    `, [clerkId, profilePhotoUrl, primaryState, secondaryStates, organization, companyName]);

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
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT * FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    if (result.rows.length === 0) {
      // Create default free subscription
      const newSub = await pool.query(`
        INSERT INTO user_subscriptions (
          clerk_id, 
          plan_type, 
          statements_used, 
          statements_limit, 
          last_reset_date
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [clerkId, 'free', 0, 5]);

      const subscription = newSub.rows[0];
      return res.json({
        ...subscription,
        statements_remaining: subscription.statements_limit - subscription.statements_used,
        is_unlimited: false,
        can_generate: subscription.statements_used < subscription.statements_limit
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

    const isUnlimited = subscription.plan_type !== 'free';
    const statementsRemaining = isUnlimited 
      ? -1 
      : subscription.statements_limit - subscription.statements_used;

    res.json({
      ...subscription,
      statements_remaining: statementsRemaining,
      is_unlimited: isUnlimited,
      can_generate: isUnlimited || subscription.statements_used < subscription.statements_limit
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

