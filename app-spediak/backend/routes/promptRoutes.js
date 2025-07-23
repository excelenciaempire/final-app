const express = require('express');
const router = express.Router();
const { 
    getPrompts, 
    updatePrompts,
    lockPrompt,
    unlockPrompt,
    getPromptHistory,
    restorePromptVersion,
} = require('../controllers/promptController');
const { requireAdmin } = require('../middleware/adminAuth'); // Ensure you're using admin middleware

// --- All routes in this file are for admins ---
router.use(requireAdmin);

// --- Prompt Data and History ---
router.get('/prompts', getPrompts);
router.get('/prompts/:id/history', getPromptHistory);

// --- Prompt Actions ---
router.put('/prompts/update', updatePrompts);
router.post('/prompts/restore', restorePromptVersion);

// --- Locking Mechanism ---
router.post('/prompts/:id/lock', lockPrompt);
router.post('/prompts/:id/unlock', unlockPrompt);


module.exports = router; 