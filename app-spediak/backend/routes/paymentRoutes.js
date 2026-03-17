const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { createCheckoutSession, handleWebhook, getSubscriptionStatus } = require('../controllers/paymentController');

// Webhook must use raw body — registered BEFORE json middleware in server.js
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Authenticated routes
router.post('/create-checkout-session', ClerkExpressRequireAuth(), createCheckoutSession);
router.get('/subscription-status', ClerkExpressRequireAuth(), getSubscriptionStatus);

module.exports = router;
