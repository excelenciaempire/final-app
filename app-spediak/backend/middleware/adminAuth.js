const { clerkClient } = require('@clerk/clerk-sdk-node');

const requireAdmin = async (req, res, next) => {
    console.log('[requireAdmin] Middleware triggered.');
    // This middleware assumes that `requireAuth` has already run and populated `req.auth`.
    // The route setup in `adminRoutes.js` should be `router.use(requireAuth, requireAdmin);`
    if (!req.auth || !req.auth.userId) {
        console.error('[requireAdmin] FAILED: req.auth or req.auth.userId is missing.');
        return res.status(401).json({ message: 'Authentication required, but user session is missing.' });
    }

    const { userId } = req.auth;
    console.log(`[requireAdmin] Checking admin status for userId: ${userId}`);

    try {
        const user = await clerkClient.users.getUser(userId);
        console.log(`[requireAdmin] Fetched user from Clerk. Role: ${user.publicMetadata.role}`);

        if (user.publicMetadata.role !== 'admin') {
            console.warn(`[requireAdmin] FAILED: User ${userId} is not an admin.`);
            return res.status(403).json({ message: 'Admin access required.' });
        }

        // Add user details to req.auth for downstream use in controllers
        req.auth.username = user.username || `${user.firstName} ${user.lastName}`;
        req.auth.role = user.publicMetadata.role;
        console.log(`[requireAdmin] SUCCESS: User ${userId} is an admin. Proceeding...`);

        next();
    } catch (error) {
        console.error('--- DETAILED ERROR IN requireAdmin ---');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Status:', error.status);
        console.error('Error Message:', error.message);
        console.error('Full Error Object:', error);
        console.error('--- END DETAILED ERROR ---');
        
        if (error.status === 404) {
            return res.status(404).json({ message: 'User not found during admin check.' });
        }
        return res.status(500).json({ message: 'Failed to verify admin status.' });
    }
};

module.exports = { requireAdmin }; 