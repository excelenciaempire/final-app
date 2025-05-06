const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Este middleware verificará el token JWT de la solicitud.
// Si el token es válido, añadirá `req.auth` con información del usuario (incluyendo `userId`).
// Si el token no es válido o falta, devolverá un error 401 automáticamente.
const requireAuth = ClerkExpressRequireAuth({
  // Aquí podrías añadir opciones si necesitas personalizar el comportamiento,
  // pero las opciones por defecto suelen funcionar bien si las variables
  // de entorno (CLERK_SECRET_KEY) están configuradas.
});

module.exports = { requireAuth }; 