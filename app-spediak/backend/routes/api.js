const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/clerkAuth');
const { requireAdmin } = require('../middleware/adminAuth');
const { clerkClient, ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const { transcribeAudioController } = require('../controllers/transcriptionController');
const { getInspections, createInspection, deleteInspection } = require('../controllers/inspectionController');
const { generateDdidController } = require('../controllers/ddidController');
const { uploadImageController } = require('../controllers/uploadController');
const { getAllInspectionsWithUserDetails, getAllUsers, exportUsersCsv, deleteUser } = require('../controllers/adminController');
const { generatePreDescriptionController } = require('../controllers/preDescriptionController');

// Assuming your Neon DB pool is exported from a 'db.js' or similar in the parent or a config directory
// Adjust the path as necessary, e.g., '../config/db' or '../db'
let pool;
try {
    pool = require('../db'); // Common location
} catch (e) {
    try {
        pool = require('../config/db'); // Another common location
    } catch (e2) {
        console.error("Failed to require database pool. Please check path in api.js");
        // Fallback or throw error if pool is critical for all routes in this file
        // For now, we'll let it be undefined and the route will fail if it's used without it.
    }
}

// --- Webhook Route (REMOVED - Handled directly in server.js) ---
// router.post('/webhooks/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

// --- Auth Middleware (Applied to all routes BELOW this line) ---
router.use(requireAuth);

// --- Admin Routes ---
router.get('/admin/all-inspections', requireAdmin, getAllInspectionsWithUserDetails);
router.get('/admin/all-users', requireAdmin, getAllUsers);
router.get('/admin/export-users-csv', requireAdmin, exportUsersCsv);
router.delete('/admin/users/:userId', requireAdmin, deleteUser);

// --- Regular User Routes ---
router.post('/upload-image', uploadImageController);
router.post('/transcribe', transcribeAudioController);
router.get('/inspections', getInspections);
router.post('/inspections', createInspection);
router.delete('/inspections/:id', deleteInspection);
router.post('/generate-ddid', generateDdidController);
router.post('/generate-pre-description', generatePreDescriptionController);

// --- BEGIN: Add this new route for setting primary email ---
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
        // 1. Use Clerk Backend SDK to set the new email as primary
        const updatedUser = await clerkClient.users.updateUser(userId, {
            primaryEmailAddressId: newEmailAddressId,
        });

        // 2. Get the actual new primary email string from the updatedUser object
        const primaryEmailObject = updatedUser.emailAddresses.find(email => email.id === updatedUser.primaryEmailAddressId);

        if (!primaryEmailObject || !primaryEmailObject.emailAddress) {
            console.error(`Primary email string not found for user ${userId} after update with Clerk.`);
            return res.status(500).json({ message: 'Failed to retrieve primary email string after update with Clerk.' });
        }
        const newPrimaryEmailString = primaryEmailObject.emailAddress;

        // 3. Update the email in your Neon (PostgreSQL) database
        // IMPORTANT: Replace 'users' with your actual table name and 'clerk_id' with your Clerk user ID column name.
        const dbResult = await pool.query(
            'UPDATE users SET email = $1 WHERE clerk_id = $2 RETURNING *' 
            [newPrimaryEmailString, userId]
        );

        if (dbResult.rowCount === 0) {
            console.warn(`User with clerk_id ${userId} not found in local database for email update. Email was updated in Clerk.`);
            // Depending on your logic, you might still return success as Clerk is updated.
        }

        console.log(`Successfully updated primary email for user ${userId} to ${newPrimaryEmailString} in Clerk and (if found) local DB.`);
        res.status(200).json({
            message: 'Primary email address updated successfully.',
            user: {
                clerkId: updatedUser.id,
                newPrimaryEmail: newPrimaryEmailString,
            }
        });

    } catch (error) {
        console.error('Error setting primary email:', JSON.stringify(error, null, 2));
        let errorMessage = 'An internal server error occurred while updating the email address.';
        if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors[0].longMessage || error.errors[0].message || errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        const statusCode = error.status || 500; // Clerk errors often have a status
        return res.status(statusCode).json({ message: errorMessage, details: error.errors });
    }
});
// --- END: Add this new route ---

module.exports = router;
