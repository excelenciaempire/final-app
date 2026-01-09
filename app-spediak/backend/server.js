const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/adminRoutes'); // Import admin routes
const { handleClerkWebhook } = require('./controllers/webhookController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS - Allow ALL origins for now to debug
const allowedOrigins = [
  'https://app-spediak.vercel.app',
  'https://spediak-approved.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'https://www.spediak.com',
  'https://app.spediak.com',
  'https://spediak.com'
];

// CORS middleware - permissive configuration
app.use(cors({
  origin: true, // Allow all origins temporarily
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));

// Explicit OPTIONS handling for preflight requests
app.options('*', cors({ origin: true, credentials: true }));

// Webhook Route
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

// Standard Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes); // Mount admin routes

// Root route
app.get('/', (req, res) => {
  res.send('Spediak backend running!');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  console.log('Orígenes CORS permitidos:', allowedOrigins);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.message);
  
  // Handle CORS errors
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ message: 'CORS not allowed' });
  }
  
  // Handle other errors
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
