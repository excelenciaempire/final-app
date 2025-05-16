const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const { handleClerkWebhook } = require('./controllers/webhookController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS
const allowedOrigins = [
  'https://app-spediak.vercel.app', // Add this domain
  'https://spediak-approved.vercel.app', // Dominio de producción en Vercel
  'http://localhost:8081', // Para desarrollo local con Expo Web
  'http://localhost:19006', // Alternativa para desarrollo local con Expo
  'http://localhost:3000', // Otra posible alternativa para desarrollo local
  'https://www.spediak.com', // Added origin
  'https://app.spediak.com' // New subdomain
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como aplicaciones móviles)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origen bloqueado por CORS:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true // Permitir credenciales (cookies, headers de autenticación)
}));

// Webhook Route
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

// Standard Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Spediak backend running!');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  console.log('Orígenes CORS permitidos:', allowedOrigins);
});
