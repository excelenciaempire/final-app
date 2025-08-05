const express = require('express');
const router = express.Router();
const { uploadImageController, uploadAudio } = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/clerkAuth');
const { generatePreDescription } = require('../controllers/preDescriptionController');
const { generateDdid } = require('../controllers/ddidController');
const { transcribeAudio } = require('../controllers/transcriptionController');
const { getInspectionHistory, createInspection, getPrimaryEmail, updatePrimaryEmail, getPresignedUrl } = require('../controllers/inspectionController');

// All routes in this file are protected
router.use(requireAuth);

// Route to handle image uploads
router.post('/upload-image', uploadImageController);

// Route to handle audio uploads and transcription
router.post('/transcribe', transcribeAudio);


// Route to generate preliminary description
router.post('/generate-pre-description', generatePreDescription);

// Route to generate DDID
router.post('/generate-ddid', generateDdid);

// Route to get inspection history for the logged-in user
router.get('/inspections', getInspectionHistory);

// Route to create a new inspection
router.post('/inspections', createInspection);

// Route to get the primary email of the logged-in user
router.get('/user-email', getPrimaryEmail);

// Route to update the primary email of the logged-in user
router.put('/update-email', updatePrimaryEmail);

// Route to get a presigned URL for a private image
router.get('/image-url', getPresignedUrl);

module.exports = router;
