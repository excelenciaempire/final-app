const express = require('express');
const router = express.Router();
const { getPrompts, updatePrompts, lockPrompt, unlockPrompt, getPromptHistory, restorePromptVersion } = require('../controllers/promptController');
const { requireAdmin } = require('../middleware/adminAuth');

// Apply admin middleware to all prompt routes
router.use(requireAdmin);

// Routes for prompts
router.get('/', getPrompts);
router.post('/update', updatePrompts); // Changed to POST for clarity
router.post('/:id/lock', lockPrompt);
router.post('/:id/unlock', unlockPrompt);
router.get('/:id/history', getPromptHistory);
router.post('/restore', restorePromptVersion);

module.exports = router; 