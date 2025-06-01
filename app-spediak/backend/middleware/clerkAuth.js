const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Este middleware verificará el token JWT de la solicitud.
// Si el token es válido, añadirá `req.auth` con información del usuario (incluyendo `userId`).
// Si el token no es válido o falta, devolverá un error 401 automáticamente.
const baseRequireAuth = ClerkExpressRequireAuth({});

const requireAuth = (req, res, next) => {
  console.log(`[clerkAuth.js] requireAuth invoked for URL: ${req.originalUrl}`);
  baseRequireAuth(req, res, (err) => {
    if (err) {
      console.error('[clerkAuth.js] Error in baseRequireAuth:', err);
      return next(err); // Forward error to Express error handler
    }
    console.log('[clerkAuth.js] req.auth after baseRequireAuth:', req.auth ? { userId: req.auth.userId, sessionId: req.auth.sessionId, orgId: req.auth.orgId } : 'null or undefined');
    next();
  });
};

module.exports = { requireAuth }; 