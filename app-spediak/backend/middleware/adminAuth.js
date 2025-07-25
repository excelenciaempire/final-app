const { clerkClient } = require('@clerk/clerk-sdk-node');

const requireAdmin = async (req, res, next) => {
    // This middleware assumes that `requireAuth` has already run and populated `req.auth`.
    // The route setup in `adminRoutes.js` should be `router.use(requireAuth, requireAdmin);`
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ message: 'Authentication required, but user session is missing.' });
    }

    const { userId } = req.auth;

    try {
        const user = await clerkClient.users.getUser(userId);

        if (user.publicMetadata.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }

        // Add user details to req.auth for downstream use in controllers
        req.auth.username = user.username || `${user.firstName} ${user.lastName}`;
        req.auth.role = user.publicMetadata.role;

        next();
    } catch (error) {
        console.error('Error in requireAdmin middleware:', error);
        if (error.status === 404) {
            return res.status(404).json({ message: 'User not found during admin check.' });
        }
        return res.status(500).json({ message: 'Failed to verify admin status.' });
    }
};

module.exports = { requireAdmin }; 