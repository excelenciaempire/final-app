const { clerkClient } = require('@clerk/clerk-sdk-node');

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
            if (cached.user.publicMetadata.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required.' });
            }
            req.auth.username = cached.user.username || `${cached.user.firstName} ${cached.user.lastName}`;
            req.auth.role = cached.user.publicMetadata.role;
            return next(); // Serve from cache
        }
    }

    // If not in cache or expired, fetch from Clerk API
    try {
        const user = await clerkClient.users.getUser(userId);

        if (user.publicMetadata.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }
        
        // Store user data in cache with a 60-second TTL
        const expiry = now + 60 * 1000;
        userCache.set(userId, { user, expiry });

        // Attach user details to the request object
        req.auth.username = user.username || `${user.firstName} ${user.lastName}`;
        req.auth.role = user.publicMetadata.role;
        
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