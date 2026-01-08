const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/adminRoutes'); // Import admin routes
const { handleClerkWebhook } = require('./controllers/webhookController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS
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

// CORS middleware with proper preflight handling
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Also allow any subdomain of spediak.com
    if (origin.endsWith('.spediak.com') || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    
    console.log('Origen bloqueado por CORS:', origin);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Explicit OPTIONS handling for preflight requests
app.options('*', cors());

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

// Global error handler (optional but good practice)
app.use((err, req, res, next) => {
  // ... existing code ...
});
