const pool = require('../db');
const axios = require('axios');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';
const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

/**
 * Generate Discord OAuth URL
 */
const getAuthUrl = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
      return res.status(500).json({ 
        message: 'Discord OAuth not configured', 
        error: 'Missing DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI' 
      });
    }

    // Generate state parameter for CSRF protection (use clerkId)
    const state = Buffer.from(JSON.stringify({ clerkId })).toString('base64');

    const authUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${state}`;

    res.json({
      authUrl,
      state
    });

  } catch (error) {
    console.error('Error generating Discord auth URL:', error);
    res.status(500).json({ message: 'Failed to generate auth URL', error: error.message });
  }
};

/**
 * Handle Discord OAuth callback
 */
const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ message: 'Missing code or state parameter' });
    }

    // Decode state to get clerkId
    let clerkId;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      clerkId = decoded.clerkId;
    } catch (err) {
      return res.status(400).json({ message: 'Invalid state parameter' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      `${DISCORD_API_ENDPOINT}/oauth2/token`,
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info from Discord
    const userResponse = await axios.get(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const discordUser = userResponse.data;

    // Check if connection already exists
    const existingConnection = await pool.query(
      'SELECT * FROM discord_connections WHERE clerk_id = $1',
      [clerkId]
    );

    if (existingConnection.rows.length > 0) {
      // Update existing connection
      await pool.query(`
        UPDATE discord_connections
        SET 
          discord_id = $1,
          discord_username = $2,
          discord_discriminator = $3,
          discord_email = $4,
          access_token = $5,
          refresh_token = $6,
          token_expires_at = $7,
          connected_at = NOW(),
          updated_at = NOW()
        WHERE clerk_id = $8
      `, [
        discordUser.id,
        discordUser.username,
        discordUser.discriminator || '0',
        discordUser.email,
        access_token,
        refresh_token,
        new Date(Date.now() + expires_in * 1000),
        clerkId
      ]);
    } else {
      // Create new connection
      await pool.query(`
        INSERT INTO discord_connections (
          clerk_id,
          discord_id,
          discord_username,
          discord_discriminator,
          discord_email,
          access_token,
          refresh_token,
          token_expires_at,
          connected_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
      `, [
        clerkId,
        discordUser.id,
        discordUser.username,
        discordUser.discriminator || '0',
        discordUser.email,
        access_token,
        refresh_token,
        new Date(Date.now() + expires_in * 1000)
      ]);
    }

    // Redirect to success page or send JSON response
    res.json({
      message: 'Discord account connected successfully',
      discordUser: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        email: discordUser.email
      }
    });

  } catch (error) {
    console.error('Error handling Discord callback:', error);
    res.status(500).json({ 
      message: 'Failed to connect Discord account', 
      error: error.response?.data || error.message 
    });
  }
};

/**
 * Get Discord connection status for current user
 */
const getConnectionStatus = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT discord_id, discord_username, discord_discriminator, discord_email, connected_at FROM discord_connections WHERE clerk_id = $1',
      [clerkId]
    );

    if (result.rows.length === 0) {
      return res.json({
        connected: false,
        connection: null
      });
    }

    const connection = result.rows[0];

    res.json({
      connected: true,
      connection: {
        discordId: connection.discord_id,
        discordUsername: connection.discord_username,
        discordDiscriminator: connection.discord_discriminator,
        discordEmail: connection.discord_email,
        connectedAt: connection.connected_at
      }
    });

  } catch (error) {
    console.error('Error fetching Discord connection status:', error);
    res.status(500).json({ message: 'Failed to fetch connection status', error: error.message });
  }
};

/**
 * Disconnect Discord account
 */
const disconnectDiscord = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await pool.query(
      'DELETE FROM discord_connections WHERE clerk_id = $1 RETURNING *',
      [clerkId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No Discord connection found' });
    }

    res.json({
      message: 'Discord account disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Discord:', error);
    res.status(500).json({ message: 'Failed to disconnect Discord', error: error.message });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  disconnectDiscord
};

