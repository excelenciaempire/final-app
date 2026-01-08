const express = require('express');
const router = express.Router();
const { uploadImageController, uploadAdImage } = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/clerkAuth');
const { generatePreDescription } = require('../controllers/preDescriptionController');
const { generateDdid, generateStatementDirect } = require('../controllers/ddidController');
const { transcribeAudio } = require('../controllers/transcriptionController');
const { getInspectionHistory, createInspection, updateInspection, deleteInspection, getPrimaryEmail, updatePrimaryEmail, getPresignedUrl } = require('../controllers/inspectionController');
const userController = require('../controllers/userController');
const sopController = require('../controllers/sopController');
const adController = require('../controllers/adController');
const discordController = require('../controllers/discordController');

// All routes in this file are protected
router.use(requireAuth);

// Route to handle image uploads
router.post('/upload-image', uploadImageController);

// Route to handle ad image uploads with cropping
router.post('/upload/ad-image', uploadAdImage);

// Route to handle audio uploads and transcription
router.post('/transcribe', transcribeAudio);


// Route to generate preliminary description
router.post('/generate-pre-description', generatePreDescription);

// Route to generate DDID (legacy - two-step flow)
router.post('/generate-ddid', generateDdid);

// Route to generate statement directly (new streamlined flow)
router.post('/generate-statement', generateStatementDirect);

// Route to get inspection history for the logged-in user
router.get('/inspections', getInspectionHistory);

// Route to create a new inspection
router.post('/inspections', createInspection);

// Route to update an inspection (for edited statements)
router.patch('/inspections/:id', updateInspection);

// Route to delete an inspection
router.delete('/inspections/:id', deleteInspection);

// Route to get the primary email of the logged-in user
router.get('/user-email', getPrimaryEmail);

// Route to update the primary email of the logged-in user
router.put('/update-email', updatePrimaryEmail);

// Route to get a presigned URL for a private image
router.get('/image-url', getPresignedUrl);

// User Profile Routes
router.get('/user/profile', userController.getUserProfile);
router.put('/user/profile', userController.updateProfile);
router.get('/user/subscription', userController.getSubscriptionStatus);
router.post('/user/subscription/increment', userController.incrementStatementUsage);

// SOP Routes
router.get('/sop/active', sopController.getActiveSops);
router.get('/sop/documents', sopController.getSopDocuments);
router.get('/sop/text-context', sopController.getSopTextForContext);
router.get('/sop/extraction-status', sopController.getExtractionStatus);

// Ad Routes
router.get('/ads/active', adController.getActiveAds);
router.post('/ads/:id/click', adController.trackAdClick);

// Discord Routes
router.get('/discord/auth-url', discordController.getAuthUrl);
router.get('/discord/callback', discordController.handleCallback);
router.get('/discord/status', discordController.getConnectionStatus);
router.delete('/discord/disconnect', discordController.disconnectDiscord);

module.exports = router;
