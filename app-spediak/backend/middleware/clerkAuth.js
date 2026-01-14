const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { Pool } = require('pg');

// Database pool for suspension checks
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Base Clerk authentication middleware
const clerkAuth = ClerkExpressRequireAuth();

/**
 * Enhanced authentication middleware that:
 * 1. Verifies the JWT using Clerk
 * 2. Checks if the user account is suspended
 * 3. Blocks suspended users from accessing the API
 */
const requireAuth = (req, res, next) => {
  // First, verify the JWT with Clerk
  clerkAuth(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    // JWT is valid, now check if user is suspended
    const userId = req.auth?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check suspension status in database
      const result = await pool.query(
        'SELECT is_suspended, is_active FROM user_security_flags sf LEFT JOIN users u ON sf.user_clerk_id = u.clerk_id WHERE sf.user_clerk_id = $1',
        [userId]
      );

      const flags = result.rows[0];
      
      // Check if user is suspended
      if (flags?.is_suspended === true) {
        console.log(`[Auth] Blocked suspended user: ${userId}`);
        return res.status(403).json({ 
          message: 'Your account has been suspended. Please contact support at support@spediak.com',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Check if user is soft-deleted (is_active = false)
      // Note: is_active comes from users table, need separate query
      const userResult = await pool.query(
        'SELECT is_active FROM users WHERE clerk_id = $1',
        [userId]
      );
      
      if (userResult.rows[0]?.is_active === false) {
        console.log(`[Auth] Blocked deactivated user: ${userId}`);
        return res.status(403).json({ 
          message: 'Your account has been deactivated. Please contact support at support@spediak.com',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // User is authenticated and not suspended/deactivated
      next();
    } catch (dbError) {
      // If database check fails, log but allow request to proceed
      // This prevents auth from breaking if security_flags table has issues
      console.warn('[Auth] Could not verify suspension status:', dbError.message);
      next();
    }
  });
};

/**
 * Lightweight auth middleware that skips suspension check
 * Use for routes where suspension check is not needed (e.g., logout)
 */
const requireAuthLight = ClerkExpressRequireAuth();

module.exports = { requireAuth, requireAuthLight }; 