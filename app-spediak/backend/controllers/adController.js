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
    const { title, subtitle, destinationUrl, imageUrl } = req.body;

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
    const { status } = req.body;

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
      SELECT *
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

module.exports = {
  getActiveAds,
  createAd,
  updateAdStatus,
  deleteAd,
  trackAdClick,
  getAllAds
};

