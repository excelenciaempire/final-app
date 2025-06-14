const express = require('express');
const router = express.Router();
const { getPrompts, updatePrompts } = require('../controllers/promptController');
const { requireAuth } = require('../middleware/clerkAuth');

// Define the routes
router.get('/prompts', requireAuth, getPrompts);
router.put('/prompts', requireAuth, updatePrompts);

module.exports = router; 