const { Pool } = require('pg');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Pool configuration (assuming it's defined elsewhere or here like in inspectionController)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const getAllInspectionsWithUserDetails = async (req, res) => {
  // IMPORTANT: Add admin authorization check here in a real application!
  // For now, we proceed without checking if the caller is an admin.

  try {
    // 1. Fetch all inspections
    console.log('[AdminInspections] Fetching all inspections...');
    const inspectionResult = await pool.query('SELECT * FROM inspections ORDER BY created_at DESC');
    const inspections = inspectionResult.rows;
    console.log(`[AdminInspections] Found ${inspections.length} inspections.`);

    if (inspections.length === 0) {
      return res.json([]); // Return empty if no inspections
    }

    // 2. Get unique User IDs
    const userIds = [...new Set(inspections.map(insp => insp.user_id).filter(id => id != null))];
    console.log(`[AdminInspections] Found ${userIds.length} unique user IDs.`);

    // 3. Fetch user details from Clerk for these IDs
    let usersMap = new Map();
    if (userIds.length > 0) {
      console.log('[AdminInspections] Fetching user details from Clerk...');
      try {
        const users = await clerkClient.users.getUserList({ userId: userIds, limit: userIds.length });
        console.log(`[AdminInspections] Fetched details for ${users.length} users from Clerk.`);
        users.forEach(user => {
          usersMap.set(user.id, {
            name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
            email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || 'N/A',
            profilePhoto: user.imageUrl,
            state: user.unsafeMetadata?.inspectionState || null
          });
        });
      } catch (clerkError) {
        console.error("[AdminInspections] Error fetching users from Clerk:", clerkError);
        // Decide how to handle Clerk errors - return partial data or fail?
        // For now, we'll continue and users might be missing details.
      }
    }

    // 4. Combine data
    const combinedData = inspections.map(insp => {
      const userData = usersMap.get(insp.user_id);
      return {
        ...insp,
        userName: userData?.name || 'Unknown',
        userEmail: userData?.email || 'Unknown',
        userProfilePhoto: userData?.profilePhoto || null, // Added user profile photo
        userState: userData?.state || null // Added user state
      };
    });

    return res.json(combinedData);

  } catch (err) {
    console.error('[AdminInspections] Error fetching all inspections:', err);
    return res.status(500).json({ message: 'Error fetching all inspection data' });
  }
};

const getAllUsers = async (req, res) => {
  // Assumes requireAdmin middleware has already run
  console.log('[AdminUsers] Attempting to fetch all users from Clerk...');
  try {
    // 1. Fetch all users from Clerk
    const userList = await clerkClient.users.getUserList({ limit: 500 });
    console.log(`[AdminUsers] Fetched ${userList.length} users from Clerk.`);

    // 2. Fetch inspection counts from database
    let inspectionCountsMap = new Map(); // Initialize the map here, outside the inner try/catch
    try {
      console.log('[AdminUsers] Fetching inspection counts...');
      const countResult = await pool.query('SELECT user_id, COUNT(*) AS inspection_count FROM inspections WHERE user_id IS NOT NULL GROUP BY user_id');
      countResult.rows.forEach(row => {
        inspectionCountsMap.set(row.user_id, parseInt(row.inspection_count, 10));
      });
      console.log(`[AdminUsers] Fetched counts for ${inspectionCountsMap.size} users.`);
    } catch (dbError) {
      console.error('[AdminUsers] Error fetching inspection counts:', dbError);
      // inspectionCountsMap will remain empty if DB query fails, which is handled below
    }

    // 3. Format user data, including counts, state, and photo
    const formattedUsers = userList.map(user => ({
      id: user.id,
      name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
      email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || 'N/A',
      createdAt: user.createdAt,
      profilePhoto: user.imageUrl || null, 
      state: user.unsafeMetadata?.inspectionState || null,
      inspectionCount: inspectionCountsMap.get(user.id) || 0
    }));

    return res.json(formattedUsers);

  } catch (error) {
    console.error('[AdminUsers] Error fetching users from Clerk:', error);
    return res.status(500).json({ message: 'Failed to fetch users', details: error.message });
  }
};

module.exports = { getAllInspectionsWithUserDetails, getAllUsers }; 