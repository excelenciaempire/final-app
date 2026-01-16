const pool = require('../db');

/**
 * Get all active ads for display
 */
const getActiveAds = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, subtitle, destination_url, image_url, created_at
      FROM ad_inventory
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);

    res.json({
      ads: result.rows
    });

  } catch (error) {
    console.error('Error fetching active ads:', error);
    res.status(500).json({ message: 'Failed to fetch ads', error: error.message });
  }
};

/**
 * Create a new ad (Admin only)
 */
const createAd = async (req, res) => {
  try {
    // Support both camelCase and snake_case
    const title = req.body.title;
    const subtitle = req.body.subtitle;
    const destinationUrl = req.body.destinationUrl || req.body.destination_url;
    const imageUrl = req.body.imageUrl || req.body.image_url;

    if (!title || !destinationUrl) {
      return res.status(400).json({ message: 'Title and destination URL are required' });
    }

    const result = await pool.query(`
      INSERT INTO ad_inventory (
        title,
        subtitle,
        destination_url,
        image_url,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [title, subtitle, destinationUrl, imageUrl, 'active']);

    res.json({
      message: 'Ad created successfully',
      ad: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ message: 'Failed to create ad', error: error.message });
  }
};

/**
 * Update ad status (Admin only)
 */
const updateAdStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // Support both 'status' and 'is_active' from frontend
    let status = req.body.status;
    
    // Convert is_active boolean to status string
    if (req.body.is_active !== undefined) {
      status = req.body.is_active ? 'active' : 'inactive';
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "active" or "inactive"' });
    }

    const result = await pool.query(`
      UPDATE ad_inventory
      SET status = $1
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json({
      message: 'Ad status updated successfully',
      ad: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating ad status:', error);
    res.status(500).json({ message: 'Failed to update ad status', error: error.message });
  }
};

/**
 * Delete an ad (Admin only)
 */
const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM ad_inventory
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json({
      message: 'Ad deleted successfully',
      ad: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ message: 'Failed to delete ad', error: error.message });
  }
};

/**
 * Track ad click for analytics
 */
const trackAdClick = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE ad_inventory
      SET click_count = COALESCE(click_count, 0) + 1
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json({
      message: 'Click tracked successfully',
      clickCount: result.rows[0].click_count
    });

  } catch (error) {
    console.error('Error tracking ad click:', error);
    res.status(500).json({ message: 'Failed to track click', error: error.message });
  }
};

/**
 * Get all ads (Admin only)
 */
const getAllAds = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        subtitle, 
        destination_url, 
        image_url, 
        status,
        (status = 'active') as is_active,
        click_count,
        created_at
      FROM ad_inventory
      ORDER BY created_at DESC
    `);

    res.json({
      ads: result.rows
    });

  } catch (error) {
    console.error('Error fetching all ads:', error);
    res.status(500).json({ message: 'Failed to fetch ads', error: error.message });
  }
};

/**
 * Get ad settings (public - used by AdBanner)
 */
const getAdSettings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM ad_settings
      ORDER BY id DESC LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        settings: {
          rotation_interval: 10
        }
      });
    }

    res.json({
      settings: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching ad settings:', error);
    // Return default settings on error
    res.json({
      settings: {
        rotation_interval: 10
      }
    });
  }
};

/**
 * Update ad settings (Admin only)
 */
const updateAdSettings = async (req, res) => {
  try {
    const { rotation_interval } = req.body;

    // Validate rotation interval
    const interval = parseInt(rotation_interval, 10);
    if (isNaN(interval) || interval < 3 || interval > 120) {
      return res.status(400).json({ 
        message: 'Rotation interval must be between 3 and 120 seconds' 
      });
    }

    // Check if settings exist
    const existing = await pool.query('SELECT id FROM ad_settings LIMIT 1');

    if (existing.rows.length > 0) {
      // Update existing settings
      await pool.query(`
        UPDATE ad_settings
        SET rotation_interval = $1, updated_at = NOW()
        WHERE id = $2
      `, [interval, existing.rows[0].id]);
    } else {
      // Create new settings
      await pool.query(`
        INSERT INTO ad_settings (rotation_interval, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
      `, [interval]);
    }

    res.json({
      message: 'Ad settings updated successfully',
      settings: {
        rotation_interval: interval
      }
    });

  } catch (error) {
    console.error('Error updating ad settings:', error);
    res.status(500).json({ message: 'Failed to update ad settings', error: error.message });
  }
};

module.exports = {
  getActiveAds,
  createAd,
  updateAdStatus,
  deleteAd,
  trackAdClick,
  getAllAds,
  getAdSettings,
  updateAdSettings
};

