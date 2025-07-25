const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { requireAdmin } = require('../middleware/adminAuth');
const { getPrompts, updatePrompts, lockPrompt, unlockPrompt, getPromptHistory, restorePromptVersion } = require('../controllers/promptController');
const { getAllInspections, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');

// Protect all routes in this file with both authentication and admin authorization
router.use(requireAuth, requireAdmin);

// Prompt routes
router.get('/prompts', getPrompts);
router.post('/prompts/update', updatePrompts);
router.post('/prompts/:id/lock', lockPrompt);
router.post('/prompts/:id/unlock', unlockPrompt);
router.get('/prompts/:id/history', getPromptHistory);
router.post('/prompts/restore', restorePromptVersion);

// Admin-specific routes for inspections and user management
router.get('/all-inspections', getAllInspections);
router.get('/all-users', getAllUsers);
router.get('/export-users-csv', exportUsersCsv);
router.delete('/delete-user/:userId', deleteUser);

module.exports = router; 