const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { requireAdmin } = require('../middleware/adminAuth');

const { transcribeAudioController } = require('../controllers/transcriptionController');
const { getInspections, createInspection, deleteInspection } = require('../controllers/inspectionController');
const { generateDdidController } = require('../controllers/ddidController');
const { uploadImageController } = require('../controllers/uploadController');
const { getAllInspectionsWithUserDetails, getAllUsers } = require('../controllers/adminController');
const { generatePreDescriptionController } = require('../controllers/preDescriptionController');

router.use(requireAuth);

// --- Admin Routes ---
router.get('/admin/all-inspections', requireAdmin, getAllInspectionsWithUserDetails);
router.get('/admin/all-users', requireAdmin, getAllUsers);

// --- Regular User Routes ---
router.post('/upload-image', uploadImageController);
router.post('/transcribe', transcribeAudioController);
router.get('/inspections', getInspections);
router.post('/inspections', createInspection);
router.delete('/inspections/:id', deleteInspection);
router.post('/generate-ddid', generateDdidController);
router.post('/generate-pre-description', generatePreDescriptionController);

module.exports = router;
