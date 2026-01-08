const { clerkClient } = require('@clerk/clerk-sdk-node');
const pool = require('../db');

// Simple in-memory cache to reduce Clerk API calls during polling.
// Caches user data for 60 seconds.
const userCache = new Map();

const requireAdmin = async (req, res, next) => {
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ message: 'Authentication required, but user session is missing.' });
    }

    const { userId } = req.auth;
    const now = Date.now();

    // Check cache first
    if (userCache.has(userId)) {
        const cached = userCache.get(userId);
        if (now < cached.expiry) {
            if (!cached.isAdmin) {
                return res.status(403).json({ message: 'Admin access required.' });
            }
            req.auth.username = cached.username;
            req.auth.role = 'admin';
            return next(); // Serve from cache
        }
    }

    // If not in cache or expired, check BOTH Clerk metadata AND database
    try {
        let isAdmin = false;
        let username = 'Unknown User';

        // First, check database (our source of truth for admin status)
        try {
            const dbResult = await pool.query(
                'SELECT is_admin FROM user_security_flags WHERE user_clerk_id = $1',
                [userId]
            );
            if (dbResult.rows.length > 0 && dbResult.rows[0].is_admin === true) {
                isAdmin = true;
            }
        } catch (dbError) {
            console.warn('Error checking admin status in database:', dbError.message);
        }

        // Also check Clerk publicMetadata as fallback
        if (!isAdmin) {
            try {
                const user = await clerkClient.users.getUser(userId);
                if (user.publicMetadata?.role === 'admin') {
                    isAdmin = true;
                }
                username = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
            } catch (clerkError) {
                console.warn('Error fetching user from Clerk:', clerkError.message);
            }
        } else {
            // If admin from DB, still get username from Clerk if possible
            try {
                const user = await clerkClient.users.getUser(userId);
                username = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin User';
            } catch (e) {
                // Ignore, use default username
            }
        }

        if (!isAdmin) {
            return res.status(403).json({ message: 'Admin access required.' });
        }
        
        // Store in cache with a 60-second TTL
        const expiry = now + 60 * 1000;
        userCache.set(userId, { isAdmin: true, username, expiry });

        // Attach user details to the request object
        req.auth.username = username;
        req.auth.role = 'admin';
        
        next();
    } catch (error) {
        console.error('Error in requireAdmin middleware:', error);
        // Pass through Clerk API errors (like 429 Too Many Requests)
        if (error.status) {
             return res.status(error.status).json({
                message: error.message,
                errors: error.errors
            });
        }
        return res.status(500).json({ message: 'Failed to verify admin status.' });
    }
};

module.exports = { requireAdmin }; 