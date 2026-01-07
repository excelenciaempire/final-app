const { Pool } = require('pg');
const { clerkClient } = require('@clerk/clerk-sdk-node');
// const archiver = require('archiver'); // No longer needed
const { Parser } = require('json2csv');

// Pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function to build WHERE clauses for search
const buildSearchWhereClause = (searchFields, searchTerm) => {
  if (!searchTerm || searchFields.length === 0) {
    return { clause: '', params: [] };
  }
  const lowerSearchTerm = `%${searchTerm.toLowerCase()}%`;
  const clauses = searchFields.map((field, index) => `LOWER(${field}) LIKE $${index + 1}`);
  return {
    clause: `WHERE (${clauses.join(' OR ')})`,
    params: Array(searchFields.length).fill(lowerSearchTerm)
  };
};

// GET All Inspections (Admin - Paginated, Searchable, Sortable)
const getAllInspectionsWithUserDetails = async (req, res) => {
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15; // Default limit 15
  const offset = (page - 1) * limit;

  // Search
  const searchQuery = req.query.search || '';
  const inspectionSearchFields = ['i.description', 'i.ddid', 'u.name', 'u.email'];
  const { clause: searchClause, params: searchParams } = buildSearchWhereClause(inspectionSearchFields, searchQuery);

  // Sorting
  const sortBy = req.query.sortBy || 'created_at'; // Default sort by creation date
  const sortOrder = (req.query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'; // Default DESC
  // Whitelist valid sort columns to prevent SQL injection
  const validSortColumns = { created_at: 'i.created_at', userName: 'u.name', userEmail: 'u.email' };
  const orderByColumn = validSortColumns[sortBy] || 'i.created_at'; // Fallback to default

  try {
    // Base query joining inspections and users
    const baseQuery = `
      FROM inspections i
      LEFT JOIN users u ON i.user_id = u.clerk_id
      ${searchClause}
    `;

    // Query to get total count for pagination
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    console.log("[AdminInspections Count Query]:", countQuery, searchParams);
    const totalResult = await pool.query(countQuery, searchParams);
    const totalCount = parseInt(totalResult.rows[0].count, 10);

    // Query to get paginated data
    const dataQuery = `
      SELECT 
        i.id, i.user_id, i.image_url, i.description, i.ddid, i.state, i.created_at,
        u.name AS "userName", u.email AS "userEmail", u.state AS "userState", u.profile_photo_url AS "userProfilePhoto"
      ${baseQuery}
      ORDER BY ${orderByColumn} ${sortOrder}
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    const dataParams = [...searchParams, limit, offset];
    console.log("[AdminInspections Data Query]:", dataQuery, dataParams);
    const dataResult = await pool.query(dataQuery, dataParams);

    res.json({
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      inspections: dataResult.rows
    });

  } catch (err) {
    console.error('Error fetching all inspections (Admin):', err);
    res.status(500).json({ message: 'Error fetching inspection data' });
  }
};

// GET All Users (Admin - Paginated, Searchable)
const getAllUsers = async (req, res) => {
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15; // Default limit 15
  const offset = (page - 1) * limit;

  // Search
  const searchQuery = req.query.search || '';
  const userSearchFields = ['name', 'email']; // Fields in the users table
  const { clause: searchClause, params: searchParams } = buildSearchWhereClause(userSearchFields, searchQuery);

  // Sorting (Example: by name or join date)
  const sortBy = req.query.sortBy || 'created_at'; // Default sort by creation date
  const sortOrder = (req.query.sortOrder || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default ASC for names
  const validSortColumns = { name: 'u.name', email: 'u.email', created_at: 'u.created_at' };
  const orderByColumn = validSortColumns[sortBy] || 'u.created_at';

  try {
    // Base query for users
    // We also join inspections to get the count
    const baseQuery = `
      FROM users u
      ${searchClause}
    `;

    // Query for total count
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    console.log("[AdminUsers Count Query]:", countQuery, searchParams);
    const totalResult = await pool.query(countQuery, searchParams);
    const totalCount = parseInt(totalResult.rows[0].count, 10);

    // Query for paginated user data WITH inspection count
    const dataQuery = `
      SELECT 
        u.clerk_id AS id, u.name, u.email, u.username, u.created_at AS "createdAt",
        u.state, u.profile_photo_url AS "profilePhoto",
        (SELECT COUNT(*) FROM inspections WHERE user_id = u.clerk_id) AS "inspectionCount"
      ${baseQuery}
      ORDER BY ${orderByColumn} ${sortOrder}
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    const dataParams = [...searchParams, limit, offset];
    console.log("[AdminUsers Data Query]:", dataQuery, dataParams);
    const dataResult = await pool.query(dataQuery, dataParams);

    res.json({
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        users: dataResult.rows
    });

  } catch (err) {
    console.error('Error fetching all users (Admin):', err);
    res.status(500).json({ message: 'Error fetching user data' });
  }
};

// NEW: Export Users as CSV
const exportUsersCsv = async (req, res) => {
  console.log('[Admin] Request to export users as CSV received.');
  try {
    // Fetch all users - consider performance for very large datasets
    // For this example, fetching all. Add specific columns to select.
    const usersResult = await pool.query(
      'SELECT clerk_id, name, email, username, state, created_at, updated_at, profile_photo_url FROM users ORDER BY name ASC'
    );

    if (usersResult.rows.length === 0) {
      // If no users, send a 404 or an empty CSV with a message
      // For simplicity, sending a 200 with an empty CSV content is also an option.
      // Or a message in the CSV file itself.
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      return res.status(200).send('No user data found.'); // Send message in CSV
    }

    const fields = [
        { label: 'User ID', value: 'clerk_id'},
        { label: 'Name', value: 'name'},
        { label: 'Email', value: 'email'},
        { label: 'Username', value: 'username'},
        { label: 'State', value: 'state'},
        { label: 'Created At', value: 'created_at'},
        { label: 'Updated At', value: 'updated_at'},
        { label: 'Profile Photo URL', value: 'profile_photo_url'}
    ];
    const json2csvParser = new Parser({ fields });
    const usersCsv = json2csvParser.parse(usersResult.rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.status(200).send(usersCsv);
    console.log('[Admin] Users CSV generated and sent.');

  } catch (err) {
    console.error('Error generating users CSV:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating users CSV export' });
    } else {
      console.error('[Admin] Headers already sent for CSV export, could not send error status.');
    }
  }
};

// Delete User (Admin)
const deleteUser = async (req, res) => {
  const { userId } = req.params; // This is the Clerk User ID
  console.log(`[Admin] Request to delete user ID: ${userId}`);

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // First, delete inspections associated with the user
    console.log(`[Admin] Deleting inspections for user ${userId}...`);
    const deleteInspectionsQuery = 'DELETE FROM inspections WHERE user_id = $1';
    await client.query(deleteInspectionsQuery, [userId]);
    console.log(`[Admin] Inspections for user ${userId} deleted.`);

    // Then, delete the user from Clerk
    console.log(`[Admin] Deleting user ${userId} from Clerk...`);
    await clerkClient.users.deleteUser(userId);
    console.log(`[Admin] User ${userId} deleted from Clerk successfully.`);

    console.log(`[Admin] Deleting user ${userId} from local database...`);
    const deleteDbUserQuery = 'DELETE FROM users WHERE clerk_id = $1 RETURNING *';
    const dbResult = await client.query(deleteDbUserQuery, [userId]);

    if (dbResult.rowCount === 0) {
      // This case might happen if the user was in Clerk but not in the local DB (e.g., sync issue)
      // Or if they were already deleted from the DB but not Clerk.
      // We'll still consider the Clerk deletion a success for the overall operation if it passed.
      console.warn(`[Admin] User ${userId} not found in the local database, but was deleted from Clerk.`);
      // Optionally, you could choose to throw an error here if strict consistency is required immediately.
    } else {
      console.log(`[Admin] User ${userId} (DB record: ${dbResult.rows[0].id}) deleted from local database.`);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'User deleted successfully from Clerk and database.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Admin] Error deleting user ${userId}:`, error);
    let errorMessage = 'Failed to delete user.';
    let statusCode = 500;

    if (error.isClerkAPIError) { // Check if it's a Clerk API error
        errorMessage = error.errors?.[0]?.longMessage || error.errors?.[0]?.message || 'Clerk API error during user deletion.';
        // Clerk API might return specific status codes, e.g., 404 if user not found
        if (error.status) statusCode = error.status;
        console.error('[Admin] Clerk API Error details:', JSON.stringify(error.errors));
    } else if (error.code) { // Check for pg error codes
        // Handle specific pg errors if needed, e.g., foreign key constraints
        errorMessage = `Database error: ${error.message}`;
    }

    res.status(statusCode).json({ message: errorMessage, error: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// NEW ADMIN FEATURES
// ============================================

/**
 * Gift credits to a user
 */
const giftCredits = async (req, res) => {
  const { userId } = req.params;
  const { credits, reason } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId || !credits) {
    return res.status(400).json({ message: 'User ID and credits amount are required' });
  }

  if (credits <= 0 || credits > 100) {
    return res.status(400).json({ message: 'Credits must be between 1 and 100' });
  }

  try {
    // Check if user exists
    const userResult = await pool.query(
      'SELECT clerk_id, email FROM users WHERE clerk_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user's subscription - add credits to their limit
    const updateResult = await pool.query(`
      UPDATE user_subscriptions 
      SET statements_limit = statements_limit + $1, updated_at = NOW()
      WHERE clerk_id = $2
      RETURNING *
    `, [credits, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: 'User subscription not found' });
    }

    // Log the gift to admin_gifted_credits
    await pool.query(`
      INSERT INTO admin_gifted_credits (user_clerk_id, admin_clerk_id, credits_amount, reason)
      VALUES ($1, $2, $3, $4)
    `, [userId, adminClerkId, credits, reason || null]);

    // Log to admin_audit_log
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, target_type, target_id, action_details)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminClerkId, 'gift_credits', 'user', userId, JSON.stringify({ credits, reason, new_limit: updateResult.rows[0].statements_limit })]);

    console.log(`[Admin] Gifted ${credits} credits to user ${userId} by admin ${adminClerkId}`);

    res.json({
      message: `Successfully gifted ${credits} credits to user`,
      subscription: updateResult.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error gifting credits:', error);
    res.status(500).json({ message: 'Failed to gift credits', error: error.message });
  }
};

/**
 * Reset user's trial (reset statements_used to 0)
 */
const resetTrial = async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Get current usage before reset
    const currentResult = await pool.query(
      'SELECT statements_used FROM user_subscriptions WHERE clerk_id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ message: 'User subscription not found' });
    }

    const previousUsage = currentResult.rows[0].statements_used;

    // Reset usage to 0
    const updateResult = await pool.query(`
      UPDATE user_subscriptions 
      SET statements_used = 0, last_reset_date = NOW(), updated_at = NOW()
      WHERE clerk_id = $1
      RETURNING *
    `, [userId]);

    // Log the reset to admin_trial_resets
    await pool.query(`
      INSERT INTO admin_trial_resets (user_clerk_id, admin_clerk_id, previous_usage, reason)
      VALUES ($1, $2, $3, $4)
    `, [userId, adminClerkId, previousUsage, reason || null]);

    // Log to admin_audit_log
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, target_type, target_id, action_details)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminClerkId, 'reset_trial', 'user', userId, JSON.stringify({ previous_usage: previousUsage, reason })]);

    console.log(`[Admin] Reset trial for user ${userId} by admin ${adminClerkId} (previous usage: ${previousUsage})`);

    res.json({
      message: 'Successfully reset user trial',
      previousUsage,
      subscription: updateResult.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error resetting trial:', error);
    res.status(500).json({ message: 'Failed to reset trial', error: error.message });
  }
};

/**
 * Get admin notes for a user
 */
const getUserNotes = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        n.*,
        u.email as admin_email,
        u.name as admin_name
      FROM admin_user_notes n
      LEFT JOIN users u ON n.admin_clerk_id = u.clerk_id
      WHERE n.user_clerk_id = $1
      ORDER BY n.created_at DESC
    `, [userId]);

    res.json({
      notes: result.rows
    });

  } catch (error) {
    console.error('[Admin] Error fetching user notes:', error);
    res.status(500).json({ message: 'Failed to fetch user notes', error: error.message });
  }
};

/**
 * Add admin note for a user
 */
const addUserNote = async (req, res) => {
  const { userId } = req.params;
  const { note } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId || !note) {
    return res.status(400).json({ message: 'User ID and note are required' });
  }

  if (note.length > 2000) {
    return res.status(400).json({ message: 'Note must be less than 2000 characters' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO admin_user_notes (user_clerk_id, admin_clerk_id, note)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, adminClerkId, note]);

    // Log to admin_audit_log
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, target_type, target_id, action_details)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminClerkId, 'add_note', 'user', userId, JSON.stringify({ note_id: result.rows[0].id, note_preview: note.substring(0, 100) })]);

    console.log(`[Admin] Added note for user ${userId} by admin ${adminClerkId}`);

    res.json({
      message: 'Note added successfully',
      note: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error adding user note:', error);
    res.status(500).json({ message: 'Failed to add user note', error: error.message });
  }
};

/**
 * Get gift credits history (all or for specific user)
 */
const getGiftHistory = async (req, res) => {
  const { userId } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let query = `
      SELECT 
        g.*,
        u.email as user_email,
        u.name as user_name,
        a.email as admin_email,
        a.name as admin_name
      FROM admin_gifted_credits g
      LEFT JOIN users u ON g.user_clerk_id = u.clerk_id
      LEFT JOIN users a ON g.admin_clerk_id = a.clerk_id
    `;
    const params = [];

    if (userId) {
      query += ' WHERE g.user_clerk_id = $1';
      params.push(userId);
    }

    query += ` ORDER BY g.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_gifted_credits';
    if (userId) {
      countQuery += ' WHERE user_clerk_id = $1';
    }
    const countResult = await pool.query(countQuery, userId ? [userId] : []);

    res.json({
      history: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });

  } catch (error) {
    console.error('[Admin] Error fetching gift history:', error);
    res.status(500).json({ message: 'Failed to fetch gift history', error: error.message });
  }
};

/**
 * Get trial reset history (all or for specific user)
 */
const getTrialResetHistory = async (req, res) => {
  const { userId } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let query = `
      SELECT 
        r.*,
        u.email as user_email,
        u.name as user_name,
        a.email as admin_email,
        a.name as admin_name
      FROM admin_trial_resets r
      LEFT JOIN users u ON r.user_clerk_id = u.clerk_id
      LEFT JOIN users a ON r.admin_clerk_id = a.clerk_id
    `;
    const params = [];

    if (userId) {
      query += ' WHERE r.user_clerk_id = $1';
      params.push(userId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_trial_resets';
    if (userId) {
      countQuery += ' WHERE user_clerk_id = $1';
    }
    const countResult = await pool.query(countQuery, userId ? [userId] : []);

    res.json({
      history: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });

  } catch (error) {
    console.error('[Admin] Error fetching trial reset history:', error);
    res.status(500).json({ message: 'Failed to fetch trial reset history', error: error.message });
  }
};

/**
 * Get user details with subscription and admin info
 */
const getUserDetails = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Get user info
    const userResult = await pool.query(`
      SELECT 
        u.*,
        up.primary_state,
        up.secondary_states,
        up.organization,
        up.company_name,
        up.phone_number,
        us.plan_type,
        us.statements_used,
        us.statements_limit,
        us.last_reset_date,
        (SELECT COUNT(*) FROM inspections WHERE user_id = u.clerk_id) as inspection_count
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      WHERE u.clerk_id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get notes count
    const notesResult = await pool.query(
      'SELECT COUNT(*) FROM admin_user_notes WHERE user_clerk_id = $1',
      [userId]
    );

    // Get total gifted credits
    const giftsResult = await pool.query(
      'SELECT COALESCE(SUM(credits_amount), 0) as total_gifted FROM admin_gifted_credits WHERE user_clerk_id = $1',
      [userId]
    );

    // Get trial reset count
    const resetsResult = await pool.query(
      'SELECT COUNT(*) FROM admin_trial_resets WHERE user_clerk_id = $1',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      adminInfo: {
        notesCount: parseInt(notesResult.rows[0].count),
        totalGiftedCredits: parseInt(giftsResult.rows[0].total_gifted),
        trialResetCount: parseInt(resetsResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('[Admin] Error fetching user details:', error);
    res.status(500).json({ message: 'Failed to fetch user details', error: error.message });
  }
};

module.exports = {
  getAllInspections: getAllInspectionsWithUserDetails,
  getAllUsers,
  exportUsersCsv,
  deleteUser,
  // New admin features
  giftCredits,
  resetTrial,
  getUserNotes,
  addUserNote,
  getGiftHistory,
  getTrialResetHistory,
  getUserDetails
}; 