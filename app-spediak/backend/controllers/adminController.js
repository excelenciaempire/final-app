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
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, target_type, target_id, target_user_id, action_details)
      VALUES ($1, $2, $3, $4, $4, $5)
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
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, target_type, target_id, target_user_id, action_details)
      VALUES ($1, $2, $3, $4, $4, $5)
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
  const { note, noteType = 'admin' } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!note || note.trim().length === 0) {
    return res.status(400).json({ message: 'Note content is required' });
  }

  if (note.length > 2000) {
    return res.status(400).json({ message: 'Note must be less than 2000 characters' });
  }

  try {
    // Always insert a new note (notes are now a list, not a single entry)
    const result = await pool.query(`
      INSERT INTO admin_user_notes (user_clerk_id, admin_clerk_id, note, note_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, adminClerkId, note.trim(), noteType]);

    // Log to admin_audit_log
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'add_note', 'user_management', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      note_type: noteType,
      note_preview: note.substring(0, 100) 
    })]);

    console.log(`[Admin] Added ${noteType} note for user ${userId} by admin ${adminClerkId}`);

    res.json({
      message: 'Note added successfully',
      note: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error saving user note:', error);
    res.status(500).json({ message: 'Failed to save user note', error: error.message });
  }
};

/**
 * Delete a specific note
 */
const deleteUserNote = async (req, res) => {
  const { userId, noteId } = req.params;
  const adminClerkId = req.auth?.userId;

  if (!userId || !noteId) {
    return res.status(400).json({ message: 'User ID and Note ID are required' });
  }

  try {
    // Verify the note exists and belongs to this user
    const noteCheck = await pool.query(
      'SELECT * FROM admin_user_notes WHERE id = $1 AND user_clerk_id = $2',
      [noteId, userId]
    );

    if (noteCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const deletedNote = noteCheck.rows[0];

    // Delete the note
    await pool.query('DELETE FROM admin_user_notes WHERE id = $1', [noteId]);

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'delete_note', 'user_management', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      note_id: noteId,
      note_type: deletedNote.note_type,
      note_preview: (deletedNote.note || '').substring(0, 100)
    })]);

    console.log(`[Admin] Deleted note ${noteId} for user ${userId} by admin ${adminClerkId}`);

    res.json({ message: 'Note deleted successfully' });

  } catch (error) {
    console.error('[Admin] Error deleting note:', error);
    res.status(500).json({ message: 'Failed to delete note', error: error.message });
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

// ============================================
// USER STATEMENT OVERRIDES
// ============================================

/**
 * Get user override by email
 */
const getUserOverride = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admin_user_overrides WHERE user_email = $1 AND is_active = TRUE',
      [email]
    );

    res.json({
      override: result.rows.length > 0 ? result.rows[0] : null
    });

  } catch (error) {
    console.error('[Admin] Error fetching user override:', error);
    res.status(500).json({ message: 'Failed to fetch user override', error: error.message });
  }
};

/**
 * Save or update user statement override
 */
const saveUserOverride = async (req, res) => {
  const { email, statementAllowance, reason } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!email || statementAllowance === undefined) {
    return res.status(400).json({ message: 'Email and statement allowance are required' });
  }

  try {
    // Find user by email
    const userResult = await pool.query(
      'SELECT clerk_id FROM users WHERE email = $1',
      [email]
    );

    const userClerkId = userResult.rows.length > 0 ? userResult.rows[0].clerk_id : null;

    // Upsert the override
    const result = await pool.query(`
      INSERT INTO admin_user_overrides (user_clerk_id, user_email, statement_allowance, override_reason, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_email) 
      DO UPDATE SET 
        statement_allowance = $3,
        override_reason = $4,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `, [userClerkId, email, statementAllowance, reason || null, adminClerkId]);

    // If user exists, also update their subscription limit
    if (userClerkId) {
      await pool.query(`
        UPDATE user_subscriptions 
        SET statements_limit = $1, updated_at = NOW()
        WHERE clerk_id = $2
      `, [statementAllowance, userClerkId]);
    }

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, $2, $3, $4, $5, $5, $6)
    `, [adminClerkId, 'save_override', 'user_management', 'user', userClerkId || email, JSON.stringify({ email, statementAllowance, reason })]);

    res.json({
      message: 'Override saved successfully',
      override: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error saving user override:', error);
    res.status(500).json({ message: 'Failed to save user override', error: error.message });
  }
};

/**
 * Clear user statement override
 */
const clearUserOverride = async (req, res) => {
  const { email } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await pool.query(`
      UPDATE admin_user_overrides 
      SET is_active = FALSE, updated_at = NOW()
      WHERE user_email = $1
      RETURNING *
    `, [email]);

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, action_details)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminClerkId, 'clear_override', 'user_management', 'user', JSON.stringify({ email })]);

    res.json({
      message: 'Override cleared successfully',
      cleared: result.rowCount > 0
    });

  } catch (error) {
    console.error('[Admin] Error clearing user override:', error);
    res.status(500).json({ message: 'Failed to clear user override', error: error.message });
  }
};

// ============================================
// SIGN-UP PROMOTIONS
// ============================================

/**
 * Get active sign-up promotion
 */
const getActivePromotion = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM signup_promotions 
      WHERE is_active = TRUE 
      AND start_date <= CURRENT_DATE 
      AND end_date >= CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `);

    res.json({
      promotion: result.rows.length > 0 ? result.rows[0] : null
    });

  } catch (error) {
    console.error('[Admin] Error fetching active promotion:', error);
    res.status(500).json({ message: 'Failed to fetch active promotion', error: error.message });
  }
};

/**
 * Get all promotions
 */
const getAllPromotions = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        u.email as created_by_email,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM users WHERE signup_promo_id = p.id) as users_enrolled
      FROM signup_promotions p
      LEFT JOIN users u ON p.created_by = u.clerk_id
      ORDER BY p.created_at DESC
    `);

    res.json({
      promotions: result.rows
    });

  } catch (error) {
    console.error('[Admin] Error fetching promotions:', error);
    res.status(500).json({ message: 'Failed to fetch promotions', error: error.message });
  }
};

/**
 * Save sign-up promotion
 */
const savePromotion = async (req, res) => {
  const { promoName, startDate, endDate, freeStatements } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!startDate || !endDate || !freeStatements) {
    return res.status(400).json({ message: 'Start date, end date, and free statements are required' });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO signup_promotions (promo_name, start_date, end_date, free_statements, created_by, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING *
    `, [promoName || `Promo ${new Date().toISOString().split('T')[0]}`, startDate, endDate, freeStatements, adminClerkId]);

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, action_details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [adminClerkId, 'create_promotion', 'promotions', 'promotion', result.rows[0].id, JSON.stringify({ promoName, startDate, endDate, freeStatements })]);

    res.json({
      message: 'Promotion saved successfully',
      promotion: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error saving promotion:', error);
    res.status(500).json({ message: 'Failed to save promotion', error: error.message });
  }
};

/**
 * Clear/deactivate promotion
 */
const clearPromotion = async (req, res) => {
  const { promoId } = req.body;
  const adminClerkId = req.auth?.userId;

  try {
    let result;
    if (promoId) {
      // Clear specific promotion
      result = await pool.query(`
        UPDATE signup_promotions 
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [promoId]);
    } else {
      // Clear all active promotions
      result = await pool.query(`
        UPDATE signup_promotions 
        SET is_active = FALSE, updated_at = NOW()
        WHERE is_active = TRUE
        RETURNING *
      `);
    }

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, action_details)
      VALUES ($1, $2, $3, $4, $5)
    `, [adminClerkId, 'clear_promotion', 'promotions', 'promotion', JSON.stringify({ promoId: promoId || 'all', cleared_count: result.rowCount })]);

    res.json({
      message: 'Promotion(s) cleared successfully',
      clearedCount: result.rowCount
    });

  } catch (error) {
    console.error('[Admin] Error clearing promotion:', error);
    res.status(500).json({ message: 'Failed to clear promotion', error: error.message });
  }
};

// ============================================
// USER SECURITY FLAGS & ROLES
// ============================================

/**
 * Get user security flags
 */
const getUserSecurityFlags = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM user_security_flags WHERE user_clerk_id = $1',
      [userId]
    );

    const defaultFlags = {
      is_admin: false,
      is_beta_user: false,
      is_vip: false,
      is_suspended: false,
      fraud_flag: false,
      two_fa_required: false
    };

    const flags = result.rows.length > 0 ? { ...defaultFlags, ...result.rows[0] } : defaultFlags;

    // Add role field for frontend convenience
    flags.role = flags.is_admin ? 'admin' : 'standard';
    // Ensure two_fa_required exists even if column doesn't exist in DB
    flags.two_fa_required = flags.two_fa_required || false;

    res.json({ flags });

  } catch (error) {
    console.error('[Admin] Error fetching security flags:', error);
    res.status(500).json({ message: 'Failed to fetch security flags', error: error.message });
  }
};

/**
 * Update user security flags and role
 * When a user is made admin, they get unlimited (platinum) access
 * When a user is demoted from admin, they get free tier access
 */
const updateUserSecurityFlags = async (req, res) => {
  const { userId } = req.params;
  const { role, isAdmin, isBetaUser, isVip, isSuspended, suspensionReason, fraudFlag, fraudNotes, two_fa_required } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Determine admin status from role if provided
    const isAdminValue = role === 'admin' || isAdmin || false;
    const twoFaValue = two_fa_required || false;
    
    // Full query with two_fa_required support
    const result = await pool.query(`
      INSERT INTO user_security_flags (
        user_clerk_id, is_admin, is_beta_user, is_vip, is_suspended, 
        suspension_reason, suspended_at, suspended_by, fraud_flag, fraud_notes, two_fa_required
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_clerk_id) 
      DO UPDATE SET 
        is_admin = $2,
        is_beta_user = $3,
        is_vip = $4,
        is_suspended = $5,
        suspension_reason = $6,
        suspended_at = CASE WHEN $5 = TRUE AND user_security_flags.is_suspended = FALSE THEN NOW() ELSE user_security_flags.suspended_at END,
        suspended_by = CASE WHEN $5 = TRUE THEN $8 ELSE user_security_flags.suspended_by END,
        fraud_flag = $9,
        fraud_notes = $10,
        two_fa_required = $11,
        updated_at = NOW()
      RETURNING *
    `, [
      userId, 
      isAdminValue, 
      isBetaUser || false, 
      isVip || false, 
      isSuspended || false, 
      suspensionReason || null,
      isSuspended ? new Date() : null,
      adminClerkId,
      fraudFlag || false,
      fraudNotes || null,
      twoFaValue
    ]);

    // If user is made admin, update their subscription to platinum (unlimited)
    // If user is demoted from admin, set them back to free tier
    if (isAdminValue) {
      // Admin gets unlimited access (platinum)
      await pool.query(`
        UPDATE user_subscriptions 
        SET 
          plan_type = 'platinum',
          statements_limit = -1,
          subscription_status = 'active',
          updated_at = NOW()
        WHERE clerk_id = $1
      `, [userId]);
      console.log(`[Admin] User ${userId} promoted to admin - granted platinum (unlimited) access`);
    } else {
      // Check current plan - only demote if they were on platinum
      const currentSub = await pool.query(
        'SELECT plan_type FROM user_subscriptions WHERE clerk_id = $1',
        [userId]
      );
      
      if (currentSub.rows.length > 0 && currentSub.rows[0].plan_type === 'platinum') {
        // Demoted from admin, set back to free tier
        await pool.query(`
          UPDATE user_subscriptions 
          SET 
            plan_type = 'free',
            statements_limit = 5,
            subscription_status = 'active',
            updated_at = NOW()
          WHERE clerk_id = $1
        `, [userId]);
        console.log(`[Admin] User ${userId} demoted from admin - set to free tier`);
      }
    }

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, $2, $3, $4, $5, $5, $6)
    `, [adminClerkId, 'update_security_flags', 'security', 'user', userId, JSON.stringify({ 
      role: isAdminValue ? 'admin' : 'standard',
      isAdmin: isAdminValue, 
      isBetaUser, 
      isVip, 
      isSuspended, 
      fraudFlag,
      two_fa_required 
    })]);

    res.json({
      message: 'Security flags updated successfully',
      flags: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error updating security flags:', error);
    res.status(500).json({ message: 'Failed to update security flags', error: error.message });
  }
};

// ============================================
// USER SUPPORT TAGS
// ============================================

/**
 * Get user support tags
 */
const getUserSupportTags = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const result = await pool.query(`
      SELECT t.*, u.email as added_by_email
      FROM user_support_tags t
      LEFT JOIN users u ON t.added_by = u.clerk_id
      WHERE t.user_clerk_id = $1
      ORDER BY t.created_at DESC
    `, [userId]);

    res.json({
      tags: result.rows
    });

  } catch (error) {
    console.error('[Admin] Error fetching support tags:', error);
    res.status(500).json({ message: 'Failed to fetch support tags', error: error.message });
  }
};

/**
 * Add support tag to user
 */
const addUserSupportTag = async (req, res) => {
  const { userId } = req.params;
  const { tagName, tagColor } = req.body;
  const adminClerkId = req.auth?.userId;

  if (!userId || !tagName) {
    return res.status(400).json({ message: 'User ID and tag name are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO user_support_tags (user_clerk_id, tag_name, tag_color, added_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_clerk_id, tag_name) DO NOTHING
      RETURNING *
    `, [userId, tagName, tagColor || '#6366f1', adminClerkId]);

    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Tag already exists for this user' });
    }

    res.json({
      message: 'Tag added successfully',
      tag: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin] Error adding support tag:', error);
    res.status(500).json({ message: 'Failed to add support tag', error: error.message });
  }
};

/**
 * Remove support tag from user
 */
const removeUserSupportTag = async (req, res) => {
  const { userId, tagId } = req.params;

  if (!userId || !tagId) {
    return res.status(400).json({ message: 'User ID and tag ID are required' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM user_support_tags WHERE id = $1 AND user_clerk_id = $2 RETURNING *',
      [tagId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.json({
      message: 'Tag removed successfully'
    });

  } catch (error) {
    console.error('[Admin] Error removing support tag:', error);
    res.status(500).json({ message: 'Failed to remove support tag', error: error.message });
  }
};

// ============================================
// AUDIT TRAIL
// ============================================

/**
 * Get user audit trail
 */
const getUserAuditTrail = async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        u.email as admin_email,
        u.name as admin_name
      FROM admin_audit_log a
      LEFT JOIN users u ON a.admin_clerk_id = u.clerk_id
      WHERE a.target_user_id = $1 OR a.target_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM admin_audit_log WHERE target_user_id = $1 OR target_id = $1',
      [userId]
    );

    res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });

  } catch (error) {
    console.error('[Admin] Error fetching audit trail:', error);
    res.status(500).json({ message: 'Failed to fetch audit trail', error: error.message });
  }
};

/**
 * Search user by email with full details
 */
const searchUserByEmail = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.*,
        up.primary_state,
        up.secondary_states,
        up.organization,
        up.company_name,
        us.plan_type,
        us.statements_used,
        us.statements_limit,
        us.last_reset_date,
        us.subscription_status,
        sf.is_admin,
        sf.is_beta_user,
        sf.is_vip,
        sf.is_suspended,
        sf.fraud_flag,
        COALESCE(sf.two_fa_required, FALSE) as two_fa_required,
        (SELECT COUNT(*) FROM inspections WHERE user_id = u.clerk_id) as inspection_count,
        (SELECT COUNT(*) FROM admin_user_notes WHERE user_clerk_id = u.clerk_id) as notes_count,
        (SELECT note FROM admin_user_notes WHERE user_clerk_id = u.clerk_id AND (note_type IS NULL OR note_type = 'admin') ORDER BY created_at DESC LIMIT 1) as admin_notes,
        (SELECT note FROM admin_user_notes WHERE user_clerk_id = u.clerk_id AND note_type = 'support' ORDER BY created_at DESC LIMIT 1) as support_notes
      FROM users u
      LEFT JOIN user_profiles up ON u.clerk_id = up.clerk_id
      LEFT JOIN user_subscriptions us ON u.clerk_id = us.clerk_id
      LEFT JOIN user_security_flags sf ON u.clerk_id = sf.user_clerk_id
      WHERE LOWER(u.email) = LOWER($1)
    `, [email]);

    if (result.rows.length === 0) {
      return res.json({ user: null });
    }

    // Add role field for convenience
    const user = result.rows[0];
    user.role = user.is_admin ? 'admin' : 'standard';

    res.json({ user });

  } catch (error) {
    console.error('[Admin] Error searching user:', error);
    res.status(500).json({ message: 'Failed to search user', error: error.message });
  }
};

// ============================================
// EXTENDED USER MANAGEMENT ACTIONS
// ============================================

/**
 * Suspend user
 */
const suspendUser = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      INSERT INTO user_security_flags (user_clerk_id, is_suspended, suspended_at, suspended_by)
      VALUES ($1, TRUE, NOW(), $2)
      ON CONFLICT (user_clerk_id) 
      DO UPDATE SET is_suspended = TRUE, suspended_at = NOW(), suspended_by = $2, updated_at = NOW()
    `, [userId, adminClerkId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'suspend_user', 'user_management', 'user', $2, $2, '{"action": "User suspended"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('[Admin] Error suspending user:', error);
    res.status(500).json({ message: 'Failed to suspend user' });
  }
};

/**
 * Reactivate user
 */
const reactivateUser = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      UPDATE user_security_flags 
      SET is_suspended = FALSE, updated_at = NOW()
      WHERE user_clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'reactivate_user', 'user_management', 'user', $2, $2, '{"action": "User reactivated"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    console.error('[Admin] Error reactivating user:', error);
    res.status(500).json({ message: 'Failed to reactivate user' });
  }
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      UPDATE user_subscriptions 
      SET plan_type = 'free', subscription_status = 'cancelled', updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'cancel_subscription', 'billing', 'user', $2, $2, '{"action": "Subscription cancelled"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('[Admin] Error cancelling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
};

/**
 * Soft delete user
 */
const softDeleteUser = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      UPDATE users 
      SET is_active = FALSE, updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'soft_delete_user', 'user_management', 'user', $2, $2, '{"action": "User soft deleted"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'User soft deleted successfully' });
  } catch (error) {
    console.error('[Admin] Error soft deleting user:', error);
    res.status(500).json({ message: 'Failed to soft delete user' });
  }
};

/**
 * Force logout (invalidate sessions via Clerk)
 */
const forceLogout = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    let sessionsRevoked = 0;
    
    // Get all active sessions for this user and revoke them
    try {
      // List all sessions for the user
      const sessionsResponse = await clerkClient.sessions.getSessionList({ userId });
      const sessions = sessionsResponse.data || sessionsResponse || [];
      
      // Revoke each active session
      for (const session of sessions) {
        if (session.status === 'active') {
          try {
            await clerkClient.sessions.revokeSession(session.id);
            sessionsRevoked++;
          } catch (revokeErr) {
            console.log(`[Admin] Could not revoke session ${session.id}:`, revokeErr.message);
          }
        }
      }
      
      console.log(`[Admin] Revoked ${sessionsRevoked} sessions for user ${userId}`);
    } catch (clerkError) {
      console.log('[Admin] Clerk session revocation error:', clerkError.message);
      // Even if Clerk fails, we mark the user's sessions as invalid in our DB
    }

    // Log audit with details
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'force_logout', 'security', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      action: 'Force logout executed',
      sessions_revoked: sessionsRevoked 
    })]);

    res.json({ 
      message: `User sessions invalidated (${sessionsRevoked} sessions revoked)`,
      sessions_revoked: sessionsRevoked
    });
  } catch (error) {
    console.error('[Admin] Error forcing logout:', error);
    res.status(500).json({ message: 'Failed to force logout' });
  }
};

/**
 * Force password reset
 */
const forcePasswordReset = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    let userEmail = null;
    let sessionsRevoked = 0;
    
    // Step 1: Get user info from Clerk to get their email
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      userEmail = clerkUser.emailAddresses?.[0]?.emailAddress || clerkUser.primaryEmailAddressId;
      
      // Step 2: Revoke all active sessions to force re-login
      const sessionsResponse = await clerkClient.sessions.getSessionList({ userId });
      const sessions = sessionsResponse.data || sessionsResponse || [];
      
      for (const session of sessions) {
        if (session.status === 'active') {
          try {
            await clerkClient.sessions.revokeSession(session.id);
            sessionsRevoked++;
          } catch (revokeErr) {
            console.log(`[Admin] Could not revoke session:`, revokeErr.message);
          }
        }
      }
      
      console.log(`[Admin] Password reset for ${userEmail}: revoked ${sessionsRevoked} sessions`);
    } catch (clerkError) {
      console.log('[Admin] Clerk API error:', clerkError.message);
      // Try to get email from our database as fallback
      const userResult = await pool.query('SELECT email FROM users WHERE clerk_id = $1', [userId]);
      userEmail = userResult.rows[0]?.email;
    }

    // Log audit with details
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'force_password_reset', 'security', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      action: 'Password reset requested',
      email: userEmail,
      sessions_revoked: sessionsRevoked
    })]);

    // Note: Clerk doesn't have a direct "send password reset email" API for admins
    // The user will need to use "Forgot Password" on login, or we could:
    // 1. Integrate with a custom email service to send a reset link
    // 2. Use Clerk's sign-in token to redirect user to reset flow
    // For now, we force logout so they must use Forgot Password on their next login attempt

    res.json({ 
      message: `Password reset initiated. User (${userEmail}) will need to reset their password on next login.`,
      email: userEmail,
      sessions_revoked: sessionsRevoked
    });
  } catch (error) {
    console.error('[Admin] Error forcing password reset:', error);
    res.status(500).json({ message: 'Failed to force password reset' });
  }
};

/**
 * Reset monthly usage
 */
const resetUsage = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      UPDATE user_subscriptions 
      SET statements_used = 0, last_reset_date = NOW(), updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'reset_usage', 'billing', 'user', $2, $2, '{"action": "Monthly usage reset"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'Usage reset successfully' });
  } catch (error) {
    console.error('[Admin] Error resetting usage:', error);
    res.status(500).json({ message: 'Failed to reset usage' });
  }
};

/**
 * Grant trial
 */
const grantTrial = async (req, res) => {
  const { userId } = req.params;
  const { days = 30 } = req.body;
  const adminClerkId = req.auth?.userId;

  try {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + days);

    // Grant platinum unlimited access for trial period
    await pool.query(`
      UPDATE user_subscriptions 
      SET 
        plan_type = 'platinum',
        trial_end_date = $2,
        statements_limit = -1,
        subscription_status = 'trial',
        updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId, trialEndDate]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'grant_trial', 'billing', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      days, 
      trialEndDate,
      plan: 'platinum',
      access: 'unlimited'
    })]);

    res.json({ message: `${days}-day platinum trial granted (unlimited access until ${trialEndDate.toLocaleDateString()})` });
  } catch (error) {
    console.error('[Admin] Error granting trial:', error);
    res.status(500).json({ message: 'Failed to grant trial' });
  }
};

/**
 * Revoke trial
 */
const revokeTrial = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    // Revert user back to free plan with standard limits
    await pool.query(`
      UPDATE user_subscriptions 
      SET 
        plan_type = 'free',
        trial_end_date = NULL,
        statements_limit = 5,
        statements_used = 0,
        subscription_status = 'active',
        updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'revoke_trial', 'billing', 'user', $2, $2, '{"action": "Trial revoked, reverted to free plan"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'Trial revoked - user reverted to free plan (5 statements/month)' });
  } catch (error) {
    console.error('[Admin] Error revoking trial:', error);
    res.status(500).json({ message: 'Failed to revoke trial' });
  }
};

/**
 * Update user plan type (independent of admin role)
 * Allows admin to set user's subscription plan to free, pro, or platinum
 */
const updateUserPlan = async (req, res) => {
  const { userId } = req.params;
  const { plan_type } = req.body;
  const adminClerkId = req.auth?.userId;

  // Validate plan type
  const validPlans = ['free', 'pro', 'platinum'];
  if (!validPlans.includes(plan_type)) {
    return res.status(400).json({ message: 'Invalid plan type. Must be free, pro, or platinum.' });
  }

  // Define plan limits
  const planLimits = {
    free: 5,
    pro: 100,
    platinum: -1 // Unlimited
  };

  try {
    // Update the subscription plan
    await pool.query(`
      UPDATE user_subscriptions 
      SET 
        plan_type = $1,
        statements_limit = $2,
        subscription_status = 'active',
        updated_at = NOW()
      WHERE clerk_id = $3
    `, [plan_type, planLimits[plan_type], userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'update_plan', 'billing', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ 
      plan_type, 
      statements_limit: planLimits[plan_type],
      action: `Plan changed to ${plan_type}`
    })]);

    console.log(`[Admin] User ${userId} plan changed to ${plan_type} by ${adminClerkId}`);
    res.json({ 
      message: `User plan updated to ${plan_type}`,
      plan_type,
      statements_limit: planLimits[plan_type]
    });
  } catch (error) {
    console.error('[Admin] Error updating user plan:', error);
    res.status(500).json({ message: 'Failed to update user plan', error: error.message });
  }
};

/**
 * Record manual statement event
 */
const recordStatementEvent = async (req, res) => {
  const { userId } = req.params;
  const adminClerkId = req.auth?.userId;

  try {
    await pool.query(`
      UPDATE user_subscriptions 
      SET statements_used = COALESCE(statements_used, 0) + 1, updated_at = NOW()
      WHERE clerk_id = $1
    `, [userId]);

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'record_statement_event', 'billing', 'user', $2, $2, '{"action": "Statement event recorded (+1)"}')
    `, [adminClerkId, userId]);

    res.json({ message: 'Statement event recorded' });
  } catch (error) {
    console.error('[Admin] Error recording statement event:', error);
    res.status(500).json({ message: 'Failed to record statement event' });
  }
};

/**
 * Get statement events for user
 */
const getStatementEvents = async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await pool.query(`
      SELECT id, created_at, state_used, ddid_text
      FROM inspections
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('[Admin] Error fetching statement events:', error);
    res.status(500).json({ message: 'Failed to fetch statement events' });
  }
};

/**
 * Save support info (tags and notes)
 */
const saveSupportInfo = async (req, res) => {
  const { userId } = req.params;
  const { tags, notes } = req.body;
  const adminClerkId = req.auth?.userId;

  try {
    // Update or insert support notes
    if (notes !== undefined) {
      // First try to update existing support note
      const updateResult = await pool.query(`
        UPDATE admin_user_notes 
        SET note = $2, admin_clerk_id = $3, updated_at = NOW()
        WHERE user_clerk_id = $1 AND note_type = 'support'
        RETURNING id
      `, [userId, notes, adminClerkId]);
      
      // If no existing support note, insert new one
      if (updateResult.rowCount === 0) {
        await pool.query(`
          INSERT INTO admin_user_notes (user_clerk_id, admin_clerk_id, note, note_type)
          VALUES ($1, $2, $3, 'support')
        `, [userId, adminClerkId, notes]);
      }
    }

    // Update tags
    if (tags) {
      // Clear existing tags
      await pool.query('DELETE FROM user_support_tags WHERE user_clerk_id = $1', [userId]);
      
      // Insert new tags
      for (const [tagKey, isActive] of Object.entries(tags)) {
        if (isActive) {
          const tagName = tagKey.replace(/_/g, ' ');
          await pool.query(`
            INSERT INTO user_support_tags (user_clerk_id, tag_name, tag_color, added_by, admin_clerk_id)
            VALUES ($1, $2, '#6366f1', $3, $3)
            ON CONFLICT (user_clerk_id, tag_name) DO NOTHING
          `, [userId, tagName, adminClerkId]);
        }
      }
    }

    // Log audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, target_id, target_user_id, action_details)
      VALUES ($1, 'update_support_info', 'support', 'user', $2, $2, $3)
    `, [adminClerkId, userId, JSON.stringify({ tags, hasNotes: !!notes })]);

    res.json({ message: 'Support info saved successfully' });
  } catch (error) {
    console.error('[Admin] Error saving support info:', error);
    res.status(500).json({ message: 'Failed to save support info' });
  }
};

/**
 * Fix orphaned platinum subscriptions
 * Users with platinum plan who are NOT admins should be reverted to free
 */
const fixOrphanedPlatinumUsers = async (req, res) => {
  const adminClerkId = req.auth?.userId;

  try {
    // Find users with platinum subscription who are NOT admins
    const orphanedUsers = await pool.query(`
      SELECT 
        us.clerk_id,
        u.email,
        us.plan_type,
        sf.is_admin
      FROM user_subscriptions us
      LEFT JOIN users u ON us.clerk_id = u.clerk_id
      LEFT JOIN user_security_flags sf ON us.clerk_id = sf.user_clerk_id
      WHERE us.plan_type = 'platinum'
      AND (sf.is_admin IS NULL OR sf.is_admin = FALSE)
    `);

    if (orphanedUsers.rows.length === 0) {
      return res.json({ 
        message: 'No orphaned platinum users found',
        fixed: 0 
      });
    }

    console.log(`[Admin] Found ${orphanedUsers.rows.length} orphaned platinum users:`, 
      orphanedUsers.rows.map(u => u.email).join(', '));

    // Fix each orphaned user
    const result = await pool.query(`
      UPDATE user_subscriptions us
      SET 
        plan_type = 'free',
        statements_limit = 5,
        subscription_status = 'active',
        updated_at = NOW()
      FROM user_security_flags sf
      WHERE us.clerk_id = sf.user_clerk_id
      AND us.plan_type = 'platinum'
      AND (sf.is_admin IS NULL OR sf.is_admin = FALSE)
      RETURNING us.clerk_id
    `);

    // Also fix users without security flags
    const result2 = await pool.query(`
      UPDATE user_subscriptions us
      SET 
        plan_type = 'free',
        statements_limit = 5,
        subscription_status = 'active',
        updated_at = NOW()
      WHERE us.plan_type = 'platinum'
      AND NOT EXISTS (
        SELECT 1 FROM user_security_flags sf 
        WHERE sf.user_clerk_id = us.clerk_id AND sf.is_admin = TRUE
      )
      RETURNING us.clerk_id
    `);

    const totalFixed = result.rowCount + result2.rowCount;

    // Log to audit
    await pool.query(`
      INSERT INTO admin_audit_log (admin_clerk_id, action_type, action_category, target_type, action_details)
      VALUES ($1, 'fix_orphaned_platinum', 'system', 'subscription', $2)
    `, [adminClerkId, JSON.stringify({ 
      fixed_count: totalFixed,
      users: orphanedUsers.rows.map(u => u.email)
    })]);

    console.log(`[Admin] Fixed ${totalFixed} orphaned platinum subscriptions`);

    res.json({ 
      message: `Fixed ${totalFixed} orphaned platinum subscriptions`,
      fixed: totalFixed,
      users: orphanedUsers.rows.map(u => ({ email: u.email, clerk_id: u.clerk_id }))
    });

  } catch (error) {
    console.error('[Admin] Error fixing orphaned platinum users:', error);
    res.status(500).json({ message: 'Failed to fix orphaned platinum users', error: error.message });
  }
};

/**
 * Get inspections for a specific user (admin impersonation)
 */
const getUserInspections = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Get paginated inspections for this user
    const itemsResult = await pool.query(
      'SELECT * FROM inspections WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    // Get total count
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM inspections WHERE user_id = $1',
      [userId]
    );

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      items: itemsResult.rows,
      currentPage: page,
      totalPages,
      totalItems
    });

  } catch (error) {
    console.error('[Admin] Error fetching user inspections:', error);
    res.status(500).json({ message: 'Failed to fetch inspections', error: error.message });
  }
};

module.exports = {
  getAllInspections: getAllInspectionsWithUserDetails,
  getUserInspections,
  getAllUsers,
  exportUsersCsv,
  deleteUser,
  // User management
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
  // System maintenance
  fixOrphanedPlatinumUsers,
  // Audit trail
  getUserAuditTrail,
  // Extended user management
  suspendUser,
  reactivateUser,
  cancelSubscription,
  softDeleteUser,
  forceLogout,
  forcePasswordReset,
  resetUsage,
  grantTrial,
  revokeTrial,
  updateUserPlan,
  recordStatementEvent,
  getStatementEvents,
  saveSupportInfo
}; 