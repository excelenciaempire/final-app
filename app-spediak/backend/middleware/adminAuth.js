const { clerkClient } = require('@clerk/clerk-sdk-node');

const requireAdmin = async (req, res, next) => {
  // First, ensure the user is authenticated (this should run after requireAuth)
  if (!req.auth || !req.auth.userId) {
    // This case shouldn't be reached if requireAuth runs first, but good practice
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const userId = req.auth.userId;

  try {
    console.log(`[AdminAuth] Checking role for user: ${userId}`);
    const user = await clerkClient.users.getUser(userId);

    // Check for the role in private metadata
    if (user.privateMetadata?.role === 'admin') {
      console.log(`[AdminAuth] User ${userId} is an admin. Proceeding...`);
      next(); // User is admin, allow request to proceed
    } else {
      console.warn(`[AdminAuth] User ${userId} is not an admin. Access denied.`);
      return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
  } catch (error) {
    console.error(`[AdminAuth] Error checking admin role for user ${userId}:`, error);
    // Handle potential errors from Clerk API (e.g., user not found, though unlikely here)
    if (error.status === 404) {
         return res.status(401).json({ message: 'User not found during authorization check.'});
    }
    return res.status(500).json({ message: 'Error verifying admin privileges.' });
  }
};

module.exports = { requireAdmin }; 