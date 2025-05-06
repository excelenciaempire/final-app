const { Pool } = require('pg');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Pool configuration (assuming it's defined elsewhere or here like in inspectionController)
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
  const clauses = searchFields.map((field, index) => `LOWER(${field}) LIKE $${index + 1}`); // Start param index from 1
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

module.exports = {
  getAllInspectionsWithUserDetails,
  getAllUsers,
}; 