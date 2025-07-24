const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const promptRoutes = require('./promptRoutes');
const { getAllInspections, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');

// All routes in this file will be protected by the requireAdmin middleware
router.use(requireAdmin);

// Mount the prompt routes
router.use('/prompts', promptRoutes);

// Admin-specific routes for inspections and user management
router.get('/all-inspections', getAllInspections);
router.get('/all-users', getAllUsers);
router.get('/export-users-csv', exportUsersCsv);
router.delete('/delete-user/:userId', deleteUser);

module.exports = router; 