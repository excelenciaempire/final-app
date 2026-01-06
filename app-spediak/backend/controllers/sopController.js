const pool = require('../db');
const cloudinary = require('cloudinary').v2;

/**
 * Upload SOP document to Cloudinary and save metadata
 */
const uploadSopDocument = async (req, res) => {
  try {
    const { documentName, documentType, fileUrl } = req.body;
    const clerkId = req.auth.userId;

    if (!documentName || !documentType || !fileUrl) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO sop_documents (
        document_name,
        document_type,
        file_url,
        uploaded_by,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [documentName, documentType, fileUrl, clerkId]);

    res.json({
      message: 'SOP document uploaded successfully',
      document: result.rows[0]
    });

  } catch (error) {
    console.error('Error uploading SOP document:', error);
    res.status(500).json({ message: 'Failed to upload SOP document', error: error.message });
  }
};

/**
 * Assign SOP document to a state
 */
const assignStateSop = async (req, res) => {
  try {
    const { documentId, state } = req.body;
    const clerkId = req.auth.userId;

    if (!documentId || !state) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if document exists
    const docResult = await pool.query(
      'SELECT * FROM sop_documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const document = docResult.rows[0];

    // Check if assignment already exists
    const existingAssignment = await pool.query(
      'SELECT * FROM sop_assignments WHERE assignment_type = $1 AND assignment_value = $2',
      ['state', state]
    );

    let oldDocumentId = null;
    if (existingAssignment.rows.length > 0) {
      oldDocumentId = existingAssignment.rows[0].document_id;
      
      // Update existing assignment
      await pool.query(`
        UPDATE sop_assignments 
        SET document_id = $1, updated_at = NOW()
        WHERE assignment_type = $2 AND assignment_value = $3
      `, [documentId, 'state', state]);
    } else {
      // Create new assignment
      await pool.query(`
        INSERT INTO sop_assignments (
          document_id,
          assignment_type,
          assignment_value,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
      `, [documentId, 'state', state]);
    }

    // Log the change to sop_history
    const actionType = oldDocumentId ? 'replaced' : 'assigned';
    await pool.query(`
      INSERT INTO sop_history (
        action_type,
        sop_document_id,
        assignment_type,
        assignment_value,
        changed_by,
        change_details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      actionType,
      documentId,
      'state',
      state,
      clerkId,
      JSON.stringify({
        old_document_id: oldDocumentId,
        new_document_id: documentId,
        document_name: document.document_name
      })
    ]);

    res.json({
      message: `SOP ${actionType} to state ${state} successfully`,
      assignment: { documentId, state, actionType }
    });

  } catch (error) {
    console.error('Error assigning state SOP:', error);
    res.status(500).json({ message: 'Failed to assign state SOP', error: error.message });
  }
};

/**
 * Assign SOP document to an organization
 */
const assignOrgSop = async (req, res) => {
  try {
    const { documentId, organization } = req.body;
    const clerkId = req.auth.userId;

    if (!documentId || !organization) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if document exists
    const docResult = await pool.query(
      'SELECT * FROM sop_documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const document = docResult.rows[0];

    // Check if assignment already exists
    const existingAssignment = await pool.query(
      'SELECT * FROM sop_assignments WHERE assignment_type = $1 AND assignment_value = $2',
      ['organization', organization]
    );

    let oldDocumentId = null;
    if (existingAssignment.rows.length > 0) {
      oldDocumentId = existingAssignment.rows[0].document_id;
      
      // Update existing assignment
      await pool.query(`
        UPDATE sop_assignments 
        SET document_id = $1, updated_at = NOW()
        WHERE assignment_type = $2 AND assignment_value = $3
      `, [documentId, 'organization', organization]);
    } else {
      // Create new assignment
      await pool.query(`
        INSERT INTO sop_assignments (
          document_id,
          assignment_type,
          assignment_value,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
      `, [documentId, 'organization', organization]);
    }

    // Log the change to sop_history
    const actionType = oldDocumentId ? 'replaced' : 'assigned';
    await pool.query(`
      INSERT INTO sop_history (
        action_type,
        sop_document_id,
        assignment_type,
        assignment_value,
        changed_by,
        change_details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      actionType,
      documentId,
      'organization',
      organization,
      clerkId,
      JSON.stringify({
        old_document_id: oldDocumentId,
        new_document_id: documentId,
        document_name: document.document_name
      })
    ]);

    res.json({
      message: `SOP ${actionType} to organization ${organization} successfully`,
      assignment: { documentId, organization, actionType }
    });

  } catch (error) {
    console.error('Error assigning org SOP:', error);
    res.status(500).json({ message: 'Failed to assign org SOP', error: error.message });
  }
};

/**
 * Get active SOPs for a given state and organization
 */
const getActiveSops = async (req, res) => {
  try {
    const { state, organization } = req.query;

    if (!state) {
      return res.status(400).json({ message: 'State parameter is required' });
    }

    let stateSop = null;
    let orgSop = null;

    // Get state SOP
    const stateResult = await pool.query(`
      SELECT sa.*, sd.document_name, sd.document_type, sd.file_url, sd.created_at as doc_created_at
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
    `, [state]);

    if (stateResult.rows.length > 0) {
      stateSop = stateResult.rows[0];
    }

    // Get organization SOP if provided
    if (organization && organization !== 'None') {
      const orgResult = await pool.query(`
        SELECT sa.*, sd.document_name, sd.document_type, sd.file_url, sd.created_at as doc_created_at
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
      `, [organization]);

      if (orgResult.rows.length > 0) {
        orgSop = orgResult.rows[0];
      }
    }

    res.json({
      state,
      organization: organization || null,
      stateSop: stateSop ? {
        id: stateSop.id,
        documentId: stateSop.document_id,
        documentName: stateSop.document_name,
        documentType: stateSop.document_type,
        fileUrl: stateSop.file_url,
        assignedAt: stateSop.created_at
      } : null,
      orgSop: orgSop ? {
        id: orgSop.id,
        documentId: orgSop.document_id,
        documentName: orgSop.document_name,
        documentType: orgSop.document_type,
        fileUrl: orgSop.file_url,
        assignedAt: orgSop.created_at
      } : null
    });

  } catch (error) {
    console.error('Error fetching active SOPs:', error);
    res.status(500).json({ message: 'Failed to fetch active SOPs', error: error.message });
  }
};

/**
 * Get all SOP assignments (for admin dashboard)
 */
const getSopAssignments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.*, sd.document_name, sd.document_type, sd.file_url
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.document_id = sd.id
      ORDER BY sa.updated_at DESC
    `);

    res.json({
      assignments: result.rows
    });

  } catch (error) {
    console.error('Error fetching SOP assignments:', error);
    res.status(500).json({ message: 'Failed to fetch SOP assignments', error: error.message });
  }
};

/**
 * Get SOP change history with filters
 */
const getSopHistory = async (req, res) => {
  try {
    const { 
      scope, 
      actionType, 
      state, 
      organization, 
      search, 
      limit = 20, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        sh.*,
        sd.document_name as sop_document_name,
        u.email as changed_by_email
      FROM sop_history sh
      LEFT JOIN sop_documents sd ON sh.sop_document_id = sd.id
      LEFT JOIN users u ON sh.changed_by = u.clerk_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Apply filters
    if (scope && scope !== 'all') {
      query += ` AND sh.assignment_type = $${paramCount}`;
      params.push(scope);
      paramCount++;
    }

    if (actionType && actionType !== 'all') {
      query += ` AND sh.action_type = $${paramCount}`;
      params.push(actionType);
      paramCount++;
    }

    if (state) {
      query += ` AND sh.assignment_type = 'state' AND sh.assignment_value = $${paramCount}`;
      params.push(state);
      paramCount++;
    }

    if (organization) {
      query += ` AND sh.assignment_type = 'organization' AND sh.assignment_value = $${paramCount}`;
      params.push(organization);
      paramCount++;
    }

    if (search) {
      query += ` AND sd.document_name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY sh.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM sop_history sh
      LEFT JOIN sop_documents sd ON sh.sop_document_id = sd.id
      WHERE 1=1
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset

    if (scope && scope !== 'all') countQuery += ` AND sh.assignment_type = $1`;
    if (actionType && actionType !== 'all') {
      const idx = countParams.length + 1;
      countQuery += ` AND sh.action_type = $${idx}`;
    }
    if (state) {
      const idx = countParams.length + 1;
      countQuery += ` AND sh.assignment_type = 'state' AND sh.assignment_value = $${idx}`;
    }
    if (organization) {
      const idx = countParams.length + 1;
      countQuery += ` AND sh.assignment_type = 'organization' AND sh.assignment_value = $${idx}`;
    }
    if (search) {
      const idx = countParams.length + 1;
      countQuery += ` AND sd.document_name ILIKE $${idx}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      history: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching SOP history:', error);
    res.status(500).json({ message: 'Failed to fetch SOP history', error: error.message });
  }
};

/**
 * Get all SOP documents
 */
const getSopDocuments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM sop_documents 
      ORDER BY created_at DESC
    `);

    res.json({
      documents: result.rows
    });

  } catch (error) {
    console.error('Error fetching SOP documents:', error);
    res.status(500).json({ message: 'Failed to fetch SOP documents', error: error.message });
  }
};

module.exports = {
  uploadSopDocument,
  assignStateSop,
  assignOrgSop,
  getActiveSops,
  getSopAssignments,
  getSopHistory,
  getSopDocuments
};

