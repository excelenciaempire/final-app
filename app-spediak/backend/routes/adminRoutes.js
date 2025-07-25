const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const { getPrompts, updatePrompts, lockPrompt, unlockPrompt, getPromptHistory, restorePromptVersion } = require('../controllers/promptController');
const { getAllInspections, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');

// All routes in this file will be protected by the requireAdmin middleware
router.use(requireAdmin);

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