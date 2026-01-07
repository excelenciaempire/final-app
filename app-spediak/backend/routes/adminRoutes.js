const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { requireAdmin } = require('../middleware/adminAuth');
const { getPrompts, updatePrompts, lockPrompt, unlockPrompt, getPromptHistory, restorePromptVersion } = require('../controllers/promptController');
const { getAllInspections, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');
const knowledgeRoutes = require('./knowledgeRoutes'); // Import knowledge base routes
const sopController = require('../controllers/sopController');
const adController = require('../controllers/adController');

// Protect all routes in this file with both authentication and admin authorization
router.use(requireAuth, requireAdmin);

// Mount knowledge base routes
router.use('/knowledge', knowledgeRoutes);

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

// SOP Management Routes (Admin only)
router.post('/sop/upload', sopController.uploadSopDocument);
router.post('/sop/assign-state', sopController.assignStateSop);
router.post('/sop/assign-org', sopController.assignOrgSop);
router.get('/sop/assignments', sopController.getSopAssignments);
router.get('/sop/history', sopController.getSopHistory);
router.get('/sop/history/export-csv', sopController.exportSopHistoryCsv);

// Ad Management Routes (Admin only)
router.get('/ads', adController.getAllAds);
router.post('/ads', adController.createAd);
router.put('/ads/:id', adController.updateAdStatus);
router.delete('/ads/:id', adController.deleteAd);

module.exports = router; 