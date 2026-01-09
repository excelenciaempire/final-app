const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { requireAdmin } = require('../middleware/adminAuth');
const { getPrompts, updatePrompts, lockPrompt, unlockPrompt, getPromptHistory, restorePromptVersion } = require('../controllers/promptController');
const { 
  getAllInspections,
  getUserInspections,
  getAllUsers, 
  exportUsersCsv, 
  deleteUser,
  giftCredits,
  resetTrial,
  getUserNotes,
  addUserNote,
  deleteUserNote,
  getGiftHistory,
  getTrialResetHistory,
  getUserDetails,
  searchUserByEmail,
  // User overrides
  getUserOverride,
  saveUserOverride,
  clearUserOverride,
  // Promotions
  getActivePromotion,
  getAllPromotions,
  savePromotion,
  clearPromotion,
  // Security flags
  getUserSecurityFlags,
  updateUserSecurityFlags,
  // Support tags
  getUserSupportTags,
  addUserSupportTag,
  removeUserSupportTag,
  // Audit trail
  getUserAuditTrail,
  // Extended user management
  suspendUser,
  reactivateUser,
  cancelSubscription,
  softDeleteUser,
  restoreSoftDeletedUser,
  forceLogout,
  forcePasswordReset,
  resetUsage,
  grantTrial,
  revokeTrial,
  updateUserPlan,
  recordStatementEvent,
  getStatementEvents,
  saveSupportInfo
} = require('../controllers/adminController');
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
router.get('/users/:userId/inspections', getUserInspections);
router.get('/all-users', getAllUsers);
router.get('/export-users-csv', exportUsersCsv);
router.delete('/delete-user/:userId', deleteUser);

// User management (gift credits, reset trial, notes)
router.get('/users/:userId/details', getUserDetails);
router.post('/users/:userId/gift-credits', giftCredits);
router.post('/users/:userId/reset-trial', resetTrial);
router.get('/users/:userId/notes', getUserNotes);
router.post('/users/:userId/notes', addUserNote);
router.delete('/users/:userId/notes/:noteId', deleteUserNote);

// Admin history logs
router.get('/gift-history', getGiftHistory);
router.get('/trial-reset-history', getTrialResetHistory);

// User search by email
router.get('/search-user', searchUserByEmail);

// User statement overrides
router.get('/user-override', getUserOverride);
router.post('/user-override', saveUserOverride);
router.post('/user-override/clear', clearUserOverride);

// Sign-up promotions
router.get('/promotions', getAllPromotions);
router.get('/promotions/active', getActivePromotion);
router.post('/promotions', savePromotion);
router.post('/promotions/clear', clearPromotion);

// User security flags
router.get('/users/:userId/security-flags', getUserSecurityFlags);
router.put('/users/:userId/security-flags', updateUserSecurityFlags);

// User support tags
router.get('/users/:userId/tags', getUserSupportTags);
router.post('/users/:userId/tags', addUserSupportTag);
router.delete('/users/:userId/tags/:tagId', removeUserSupportTag);

// User audit trail
router.get('/users/:userId/audit-trail', getUserAuditTrail);

// Extended user management actions
router.post('/users/:userId/suspend', suspendUser);
router.post('/users/:userId/reactivate', reactivateUser);
router.post('/users/:userId/cancel-subscription', cancelSubscription);
router.post('/users/:userId/soft-delete', softDeleteUser);
router.post('/users/:userId/restore', restoreSoftDeletedUser);
router.post('/users/:userId/force-logout', forceLogout);
router.post('/users/:userId/force-password-reset', forcePasswordReset);
router.post('/users/:userId/reset-usage', resetUsage);
router.post('/users/:userId/grant-trial', grantTrial);
router.post('/users/:userId/revoke-trial', revokeTrial);
router.put('/users/:userId/plan', updateUserPlan);
router.post('/users/:userId/record-statement', recordStatementEvent);
router.get('/users/:userId/statement-events', getStatementEvents);
router.post('/users/:userId/support-info', saveSupportInfo);

// Hard delete user (permanent - use with caution)
router.delete('/users/:userId', deleteUser);

// System maintenance
router.post('/fix-orphaned-platinum', require('../controllers/adminController').fixOrphanedPlatinumUsers);

// SOP Management Routes (Admin only)
router.post('/sop/upload', sopController.uploadSopDocument);
router.post('/sop/assign-state', sopController.assignStateSop);
router.post('/sop/assign-org', sopController.assignOrgSop);
router.get('/sop/assignments', sopController.getSopAssignments);
router.get('/sop/history', sopController.getSopHistory);
router.get('/sop/history/export-csv', sopController.exportSopHistoryCsv);
router.post('/sop/:documentId/retry-extraction', sopController.retryPdfExtraction);
router.delete('/sop/assignments/:assignmentId', sopController.removeSopAssignment);
router.delete('/sop/documents/:documentId', sopController.deleteSopDocument);

// SOP Organization Management
router.get('/sop/organizations', sopController.getOrganizations);
router.post('/sop/organizations', sopController.createOrganization);
router.delete('/sop/organizations/:id', sopController.deleteOrganization);

// Ad Management Routes (Admin only)
router.get('/ads', adController.getAllAds);
router.post('/ads', adController.createAd);
router.put('/ads/:id', adController.updateAdStatus);
router.delete('/ads/:id', adController.deleteAd);

module.exports = router; 