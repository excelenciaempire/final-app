const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { createCheckoutSession, handleWebhook, handleRevenueCatWebhook, getSubscriptionStatus } = require('../controllers/paymentController');

// Stripe webhook — must use raw body (registered BEFORE json middleware in server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// RevenueCat webhook — uses regular JSON body
router.post('/revenuecat-webhook', handleRevenueCatWebhook);

// Authenticated routes
router.post('/create-checkout-session', ClerkExpressRequireAuth(), createCheckoutSession);
router.get('/subscription-status', ClerkExpressRequireAuth(), getSubscriptionStatus);

module.exports = router;
