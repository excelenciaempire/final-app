const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// This middleware will verify the JWT, populate req.auth, and throw a 401 error if the token is invalid or missing.
const requireAuth = ClerkExpressRequireAuth();

module.exports = { requireAuth }; 