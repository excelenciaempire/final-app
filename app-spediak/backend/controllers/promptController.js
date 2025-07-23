const pool = require('../db');
const { requireAdmin } = require('../middleware/adminAuth'); // Assuming you have this middleware

const LOCK_TIMEOUT_MINUTES = 10;

// --- Helper function to release timed-out locks ---
const releaseTimedOutLocks = async () => {
    try {
        const timeout = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);
        await pool.query(
            'UPDATE prompts SET locked_by = NULL, locked_at = NULL WHERE locked_at < $1',
            [timeout]
        );
    } catch (error) {
        console.error("Error releasing timed-out locks:", error);
    }
};

// --- Get all prompts with their lock status ---
const getPrompts = async (req, res) => {
    await releaseTimedOutLocks(); // Periodically release stale locks
    try {
        const result = await pool.query(`
            SELECT 
                p.id, 
                p.prompt_name, 
                p.content, 
                p.locked_by, 
                p.locked_at,
                u.full_name as locked_by_user_name
            FROM prompts p
            LEFT JOIN users u ON p.locked_by = u.clerk_id
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching prompts:', error);
        res.status(500).json({ message: 'Failed to fetch prompts.' });
    }
};

// --- Lock a prompt for editing ---
const lockPrompt = [requireAdmin, async (req, res) => {
    await releaseTimedOutLocks();
    const { id } = req.params;
    const userId = req.auth.userId; // From Clerk middleware

    try {
        const promptResult = await pool.query('SELECT * FROM prompts WHERE id = $1', [id]);
        if (promptResult.rows.length === 0) {
            return res.status(404).json({ message: 'Prompt not found.' });
        }

        const prompt = promptResult.rows[0];
        if (prompt.locked_by && prompt.locked_by !== userId) {
            const userResult = await pool.query('SELECT full_name FROM users WHERE clerk_id = $1', [prompt.locked_by]);
            const lockerName = userResult.rows.length > 0 ? userResult.rows[0].full_name : 'another admin';
            return res.status(409).json({
                message: `${lockerName} is currently editing this prompt. Please try again later.`
            });
        }

        const result = await pool.query(
            'UPDATE prompts SET locked_by = $1, locked_at = NOW() WHERE id = $2 AND (locked_by IS NULL OR locked_by = $1) RETURNING *',
            [userId, id]
        );

        if (result.rowCount === 0) {
            return res.status(409).json({ message: 'Could not acquire lock. Another admin may have just locked it.' });
        }

        res.status(200).json({ message: 'Prompt locked successfully.', prompt: result.rows[0] });

    } catch (error) {
        console.error('Error locking prompt:', error);
        res.status(500).json({ message: 'Failed to lock prompt.' });
    }
}];

// --- Unlock a prompt ---
const unlockPrompt = [requireAdmin, async (req, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;

    try {
        const result = await pool.query(
            'UPDATE prompts SET locked_by = NULL, locked_at = NULL WHERE id = $1 AND locked_by = $2 RETURNING *',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ message: 'Cannot unlock a prompt locked by another user or already unlocked.' });
        }

        res.status(200).json({ message: 'Prompt unlocked successfully.' });
    } catch (error) {
        console.error('Error unlocking prompt:', error);
        res.status(500).json({ message: 'Failed to unlock prompt.' });
    }
}];


// --- Update a prompt and create a version history ---
const updatePrompts = [requireAdmin, async (req, res) => {
    const { id, content } = req.body;
    const userId = req.auth.userId;

    if (!id || !content) {
        return res.status(400).json({ message: 'Prompt ID and content are required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify the prompt exists and is locked by the current user
        const promptResult = await client.query('SELECT * FROM prompts WHERE id = $1', [id]);
        if (promptResult.rows.length === 0) {
            throw new Error('Prompt not found.');
        }
        const prompt = promptResult.rows[0];
        if (prompt.locked_by !== userId) {
            throw new Error('You must lock the prompt before updating.');
        }

        // 2. Get the latest version number
        const lastVersionResult = await client.query(
            'SELECT MAX(version) as max_version FROM prompt_versions WHERE prompt_id = $1',
            [id]
        );
        const newVersion = (lastVersionResult.rows[0].max_version || 0) + 1;

        // 3. Insert into version history
        await client.query(
            `INSERT INTO prompt_versions (prompt_id, version, content, updated_by_user_id)
             VALUES ($1, $2, $3, $4)`,
            [id, newVersion, prompt.content, userId] // Save the *old* content to history
        );

        // 4. Update the main prompt table with new content and unlock it
        await client.query(
            `UPDATE prompts 
             SET content = $1, locked_by = NULL, locked_at = NULL, updated_at = NOW() 
             WHERE id = $2`,
            [content, id]
        );

        await client.query('COMMIT');

        res.status(200).json({ message: 'Prompt updated successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating prompt:', error);
        res.status(500).json({ message: error.message || 'Failed to update prompt.' });
    } finally {
        client.release();
    }
}];


// --- Get history for a specific prompt ---
const getPromptHistory = [requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const historyResult = await pool.query(
            `SELECT pv.*, u.full_name as updated_by_user_name
             FROM prompt_versions pv
             LEFT JOIN users u ON pv.updated_by_user_id = u.clerk_id
             WHERE pv.prompt_id = $1
             ORDER BY pv.version DESC`,
            [id]
        );
        res.status(200).json(historyResult.rows);
    } catch (error) {
        console.error("Error fetching prompt history:", error);
        res.status(500).json({ message: "Failed to fetch prompt history." });
    }
}];

// --- Restore a specific version of a prompt ---
const restorePromptVersion = [requireAdmin, async (req, res) => {
    const { versionId } = req.body;
    const userId = req.auth.userId;

    if (!versionId) {
        return res.status(400).json({ message: "Version ID is required." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get the content from the specified version
        const versionResult = await client.query('SELECT * FROM prompt_versions WHERE id = $1', [versionId]);
        if (versionResult.rows.length === 0) {
            throw new Error('Version not found.');
        }
        const versionToRestore = versionResult.rows[0];
        const { prompt_id, content: historicalContent } = versionToRestore;

        // 2. Lock the main prompt to prevent simultaneous edits
        const lockResult = await client.query(
            'UPDATE prompts SET locked_by = $1, locked_at = NOW() WHERE id = $2 AND locked_by IS NULL RETURNING content',
            [userId, prompt_id]
        );
        if (lockResult.rowCount === 0) {
            throw new Error('Could not acquire lock. The prompt is currently being edited by another admin.');
        }
        const currentContent = lockResult.rows[0].content;

        // 3. Get the latest version number
        const lastVersionResult = await client.query(
            'SELECT MAX(version) as max_version FROM prompt_versions WHERE prompt_id = $1',
            [prompt_id]
        );
        const newVersion = (lastVersionResult.rows[0].max_version || 0) + 1;

        // 4. Save the *current* state to history before overwriting
        await client.query(
            'INSERT INTO prompt_versions (prompt_id, version, content, updated_by_user_id) VALUES ($1, $2, $3, $4)',
            [prompt_id, newVersion, currentContent, userId]
        );
        
        // 5. Update the main prompt with the historical content and unlock
        await client.query(
            'UPDATE prompts SET content = $1, locked_by = NULL, locked_at = NULL, updated_at = NOW() WHERE id = $2',
            [historicalContent, prompt_id]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Prompt version restored successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error restoring prompt version:", error);
        res.status(500).json({ message: error.message || 'Failed to restore prompt version.' });
    } finally {
        client.release();
    }
}];


module.exports = {
    getPrompts,
    updatePrompts,
    lockPrompt,
    unlockPrompt,
    getPromptHistory,
    restorePromptVersion,
}; 