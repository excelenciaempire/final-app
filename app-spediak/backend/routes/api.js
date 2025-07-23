const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const { transcribeAudioController } = require('../controllers/transcriptionController');
const { getInspections, createInspection, deleteInspection } = require('../controllers/inspectionController');
const { generateDdidController } = require('../controllers/ddidController');
const { uploadImageController } = require('../controllers/uploadController');
const { generatePreDescriptionController } = require('../controllers/preDescriptionController');

// This file no longer needs a direct DB connection, but other controllers might.
// Keeping it here for now as other parts of the app might rely on it.
let pool;
try {
    pool = require('../db');
} catch (e) {
    console.error("Failed to require database pool in api.js. This might be okay if no routes here use it directly.");
}

// All routes in this file require standard user authentication
router.use(requireAuth);

// --- Regular User Routes (Admin routes are now in /adminRoutes.js) ---
router.post('/upload-image', uploadImageController);
router.post('/transcribe', transcribeAudioController);
router.get('/inspections', getInspections);
router.post('/inspections', createInspection);
router.delete('/inspections/:id', deleteInspection);
router.post('/generate-ddid', generateDdidController);
router.post('/generate-pre-description', generatePreDescriptionController);

// --- User-specific actions ---
router.post('/user/set-primary-email', ClerkExpressRequireAuth(), async (req, res) => {
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ message: "Unauthorized. No user ID found in request." });
    }
    if (!clerkClient) {
        console.error("Clerk client not initialized");
        return res.status(500).json({ message: "Internal server error: Clerk client not available." });
    }
    if (!pool) {
        console.error("Database pool not initialized");
        return res.status(500).json({ message: "Internal server error: Database connection not available." });
    }

    const userId = req.auth.userId;
    const { newEmailAddressId } = req.body;

    if (!newEmailAddressId) {
        return res.status(400).json({ message: 'New email address ID is required.' });
    }

    try {
        const updatedUser = await clerkClient.users.updateUser(userId, {
            primaryEmailAddressId: newEmailAddressId,
        });

        const primaryEmailObject = updatedUser.emailAddresses.find(email => email.id === updatedUser.primaryEmailAddressId);
        if (!primaryEmailObject || !primaryEmailObject.emailAddress) {
            throw new Error('Failed to retrieve primary email string after update with Clerk.');
        }
        const newPrimaryEmailString = primaryEmailObject.emailAddress;

        const dbResult = await pool.query(
            'UPDATE users SET email = $1 WHERE clerk_id = $2 RETURNING *', 
            [newPrimaryEmailString, userId]
        );

        if (dbResult.rowCount === 0) {
            console.warn(`User with clerk_id ${userId} not found in local DB for email update.`);
        }

        res.status(200).json({
            message: 'Primary email address updated successfully.',
            user: {
                clerkId: updatedUser.id,
                newPrimaryEmail: newPrimaryEmailString,
            }
        });

    } catch (error) {
        console.error('Error setting primary email:', JSON.stringify(error, null, 2));
        const errorMessage = error.errors?.[0]?.longMessage || error.message || 'An internal server error occurred.';
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: errorMessage, details: error.errors });
    }
});

module.exports = router;
