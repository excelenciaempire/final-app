const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const { getAllInspectionsWithUserDetails, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');
const promptRoutes = require('./promptRoutes');

// Apply admin middleware to all routes in this file
router.use(requireAdmin);

// --- Admin-specific routes for inspections and users ---
router.get('/all-inspections', getAllInspectionsWithUserDetails);
router.get('/all-users', getAllUsers);
router.get('/export-users-csv', exportUsersCsv);
router.delete('/users/:userId', deleteUser);

// --- Mount prompt routes under the admin section ---
router.use('/prompts', promptRoutes);

module.exports = router; 