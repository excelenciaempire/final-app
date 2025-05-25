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

module.exports = {
  getAllInspectionsWithUserDetails,
  getAllUsers,
  exportUsersCsv, // Replaced downloadDatabaseBackup
  deleteUser, 
}; 