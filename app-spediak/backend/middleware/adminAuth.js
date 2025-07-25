const { clerkClient } = require('@clerk/clerk-sdk-node');
const { requireAuth } = require('./clerkAuth'); // Use the base auth middleware

const requireAdmin = async (req, res, next) => {
    // First, ensure the user is authenticated
    requireAuth(req, res, async (err) => {
        if (err) {
            return next(err);
        }

        // If authenticated, req.auth should be populated
        if (!req.auth || !req.auth.userId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const { userId } = req.auth;

        try {
            // Fetch user details from Clerk to get metadata
            const user = await clerkClient.users.getUser(userId);

            // Add username and role to req.auth for downstream use
            req.auth.username = user.username || `${user.firstName} ${user.lastName}`;
            req.auth.role = user.publicMetadata.role;

            // Check if the user has the 'admin' role
            if (user.publicMetadata.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required.' });
            }

            // If the user is an admin, proceed to the next middleware/controller
            next();
        } catch (error) {
            console.error('Error in requireAdmin middleware:', error);
            if (error.status === 404) {
                return res.status(404).json({ message: 'User not found.' });
            }
            return res.status(500).json({ message: 'Failed to verify admin status.' });
        }
    });
};

module.exports = { requireAdmin }; 