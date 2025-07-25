const pool = require('../db');

// Controller to get the current prompts, including their lock status
const getPrompts = async (req, res) => {
    console.log('[getPrompts] Function triggered.');
    try {
        const query = `
            SELECT 
                p.id, 
                p.prompt_name, 
                p.prompt_content, 
                p.is_locked, 
                p.locked_by, 
                p.username, 
                p.locked_at 
            FROM prompts p
            ORDER BY p.id
        `;
        console.log('[getPrompts] Executing query:', query);
        const result = await pool.query(query);
        console.log(`[getPrompts] Query successful. Found ${result.rowCount} prompts.`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('--- DETAILED ERROR IN getPrompts ---');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Full Error Object:', error);
        console.error('--- END DETAILED ERROR ---');
        res.status(500).json({ message: 'Failed to fetch prompts.' });
    }
};

// Controller to update a prompt and create a version history
const updatePrompts = async (req, res) => {
    const { id, prompt_content } = req.body;
    const { userId } = req.auth; // Only need userId from auth

    if (!id || prompt_content === undefined) {
        return res.status(400).json({ message: 'Prompt ID and content are required.' });
    }

    const client = await pool.connect();

    try {
        // Ensure the versions table exists before proceeding
        await client.query(`
            CREATE TABLE IF NOT EXISTS prompt_versions (
                id SERIAL PRIMARY KEY,
                prompt_id INTEGER REFERENCES prompts(id) ON DELETE CASCADE,
                version INTEGER NOT NULL,
                prompt_content TEXT NOT NULL,
                updated_by_clerk_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_prompt_version UNIQUE (prompt_id, version)
            );
        `);
        
        await client.query('BEGIN');

        // Step 1: Check if the prompt is locked by another user
        const lockResult = await client.query('SELECT is_locked, locked_by FROM prompts WHERE id = $1', [id]);
        if (lockResult.rows.length === 0) {
            return res.status(404).json({ message: 'Prompt not found.' });
        }
        if (lockResult.rows[0].is_locked && lockResult.rows[0].locked_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'This prompt is currently locked by another admin.' });
        }

        // Step 2: Get the old prompt content to save in history
        const oldPromptResult = await client.query('SELECT prompt_content FROM prompts WHERE id = $1', [id]);
        const oldPromptContent = oldPromptResult.rows[0].prompt_content;
        
        // Prevent creating a history entry if content hasn't changed
        if (oldPromptContent === prompt_content) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'No changes detected.' });
        }

        // Step 3: Get the next version number
        const versionResult = await client.query('SELECT COUNT(*) as version FROM prompt_versions WHERE prompt_id = $1', [id]);
        const newVersion = parseInt(versionResult.rows[0].version, 10) + 1;

        // Step 4: Insert the old version into the history table
        await client.query(
            'INSERT INTO prompt_versions (prompt_id, version, prompt_content, updated_by_clerk_id) VALUES ($1, $2, $3, $4)',
            [id, newVersion, oldPromptContent, userId]
        );

        // Step 5: Update the prompt with the new content
        await client.query(
            'UPDATE prompts SET prompt_content = $1, updated_at = NOW() WHERE id = $2',
            [prompt_content, id]
        );

        await client.query('COMMIT');

        res.status(200).json({ message: 'Prompt updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating prompt:', error);
        res.status(500).json({ message: 'Failed to update prompt.' });
    } finally {
        client.release();
    }
};

// Controller to lock a prompt for editing
const lockPrompt = async (req, res) => {
    const { id } = req.params;
    const { userId, username } = req.auth;

    try {
        const result = await pool.query(
            'UPDATE prompts SET is_locked = TRUE, locked_by = $1, username = $2, locked_at = NOW() WHERE id = $3 AND (is_locked = FALSE OR locked_at < NOW() - INTERVAL \'10 minutes\') RETURNING *',
            [userId, username, id]
        );

        if (result.rowCount === 0) {
            const currentLock = await pool.query('SELECT username, locked_at FROM prompts WHERE id = $1', [id]);
            return res.status(409).json({ 
                message: `This prompt is currently locked by ${currentLock.rows[0].username}.`,
                lockedBy: currentLock.rows[0].username,
                lockedAt: currentLock.rows[0].locked_at
            });
        }

        res.status(200).json({ message: 'Prompt locked successfully.', prompt: result.rows[0] });
    } catch (error) {
        console.error('Error locking prompt:', error);
        res.status(500).json({ message: 'Failed to lock prompt.' });
    }
};

// Controller to unlock a prompt
const unlockPrompt = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth;

    try {
        const result = await pool.query(
            'UPDATE prompts SET is_locked = FALSE, locked_by = NULL, username = NULL, locked_at = NULL WHERE id = $1 AND locked_by = $2 RETURNING *',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ message: 'You do not have the permission to unlock this prompt.' });
        }

        res.status(200).json({ message: 'Prompt unlocked successfully.' });
    } catch (error) {
        console.error('Error unlocking prompt:', error);
        res.status(500).json({ message: 'Failed to unlock prompt.' });
    }
};

// Controller to get the version history for a specific prompt
const getPromptHistory = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                pv.id, 
                pv.version, 
                pv.prompt_content, 
                COALESCE(u.username, 'Unknown User') as updated_by_username, 
                pv.created_at 
            FROM prompt_versions pv
            LEFT JOIN users u ON pv.updated_by_clerk_id = u.clerk_id
            WHERE pv.prompt_id = $1 
            ORDER BY pv.version DESC
        `;
        const result = await pool.query(query, [id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching prompt history:', error);
        // Check for a specific error type, e.g., table not found
        if (error.code === '42P01') { // 'undefined_table' error code in PostgreSQL
             return res.status(200).json([]); // Return empty history if table doesn't exist yet
        }
        res.status(500).json({ message: 'Failed to fetch prompt history.' });
    }
};

// Controller to restore a specific version of a prompt
const restorePromptVersion = async (req, res) => {
    const { prompt_id, version_id } = req.body;
    const { userId } = req.auth;

    if (!prompt_id || !version_id) {
        return res.status(400).json({ message: 'Prompt ID and Version ID are required.' });
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get the content from the selected version
        const versionContentResult = await client.query('SELECT prompt_content FROM prompt_versions WHERE id = $1', [version_id]);
        if (versionContentResult.rowCount === 0) {
            return res.status(404).json({ message: 'The selected version was not found.' });
        }
        const newContent = versionContentResult.rows[0].prompt_content;

        // Get the current content and details to save to history before overwriting
        const currentPromptResult = await client.query('SELECT prompt_content FROM prompts WHERE id = $1', [prompt_id]);
        const currentContent = currentPromptResult.rows[0].prompt_content;

        const versionResult = await client.query('SELECT COUNT(*) as version FROM prompt_versions WHERE prompt_id = $1', [prompt_id]);
        const newVersion = parseInt(versionResult.rows[0].version, 10) + 1;

        // Add the current state to history before restoring the old one
        await client.query(
            'INSERT INTO prompt_versions (prompt_id, version, prompt_content, updated_by_clerk_id) VALUES ($1, $2, $3, $4)',
            [prompt_id, newVersion, currentContent, userId]
        );

        // Update the main prompt with the restored content
        await client.query('UPDATE prompts SET prompt_content = $1 WHERE id = $2', [newContent, prompt_id]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Prompt restored successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error restoring prompt version:', error);
        res.status(500).json({ message: 'Failed to restore prompt.' });
    } finally {
        client.release();
    }
};


module.exports = {
    getPrompts,
    updatePrompts,
    lockPrompt,
    unlockPrompt,
    getPromptHistory,
    restorePromptVersion,
}; 