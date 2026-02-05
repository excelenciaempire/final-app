const pool = require('../db');
const cloudinary = require('cloudinary').v2;
const { extractTextFromPdf, cleanExtractedText, truncateText } = require('../utils/pdfExtractor');

/**
 * Extract text from a PDF document asynchronously (non-blocking)
 * @param {string} documentId - The document ID
 * @param {string} fileUrl - The PDF file URL
 */
async function extractAndStorePdfText(documentId, fileUrl) {
  try {
    console.log(`[SOP] Starting PDF extraction for document ${documentId}`);
    
    // Update status to 'processing'
    await pool.query(
      'UPDATE sop_documents SET extraction_status = $1 WHERE id = $2',
      ['processing', documentId]
    );
    
    // Extract text from PDF
    const { text, numPages } = await extractTextFromPdf(fileUrl);
    
    // Clean and truncate text
    const cleanedText = cleanExtractedText(text);
    const finalText = truncateText(cleanedText, 100000); // Max 100k characters
    
    // Store extracted text
    await pool.query(
      'UPDATE sop_documents SET extracted_text = $1, extraction_status = $2 WHERE id = $3',
      [finalText, 'completed', documentId]
    );
    
    console.log(`[SOP] PDF extraction completed for document ${documentId}: ${numPages} pages, ${finalText.length} characters`);
  } catch (error) {
    console.error(`[SOP] PDF extraction failed for document ${documentId}:`, error.message);
    
    // Update status to 'failed'
    await pool.query(
      'UPDATE sop_documents SET extraction_status = $1 WHERE id = $2',
      ['failed', documentId]
    );
  }
}

/**
 * Upload SOP document to Cloudinary and save metadata
 */
const uploadSopDocument = async (req, res) => {
  try {
    const { documentName, documentType, fileBase64 } = req.body;
    const clerkId = req.auth.userId;

    if (!documentName || !documentType || !fileBase64) {
      return res.status(400).json({ message: 'Missing required fields: documentName, documentType, fileBase64' });
    }

    // Calculate file size from base64
    const fileSize = Math.round((fileBase64.length * 3) / 4);

    // Upload base64 PDF to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(`data:application/pdf;base64,${fileBase64}`, {
      resource_type: "raw",
      folder: "sop_documents",
      public_id: `${documentName.replace(/\s/g, '_')}_${Date.now()}`,
    });

    const fileUrl = uploadResult.secure_url;

    // Save to database with file_size and extraction_status
    const result = await pool.query(`
      INSERT INTO sop_documents (
        document_name,
        document_type,
        file_url,
        file_size,
        extraction_status,
        uploaded_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [documentName, documentType, fileUrl, fileSize, 'pending', clerkId]);

    const document = result.rows[0];

    // Log to sop_history
    await pool.query(`
      INSERT INTO sop_history (
        action_type,
        sop_document_id,
        changed_by,
        created_at
      ) VALUES ($1, $2, $3, NOW())
    `, ['uploaded', document.id, clerkId]);

    // Start PDF text extraction asynchronously (don't await)
    extractAndStorePdfText(document.id, fileUrl).catch(err => {
      console.error('[SOP] Background PDF extraction error:', err);
    });

    res.json({
      message: 'SOP document uploaded successfully. Text extraction in progress.',
      document: document
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
      oldDocumentId = existingAssignment.rows[0].sop_document_id;
      
      // Update existing assignment
      await pool.query(`
        UPDATE sop_assignments 
        SET sop_document_id = $1, updated_at = NOW()
        WHERE assignment_type = $2 AND assignment_value = $3
      `, [documentId, 'state', state]);
    } else {
      // Create new assignment
      await pool.query(`
        INSERT INTO sop_assignments (
          sop_document_id,
          assignment_type,
          assignment_value,
          assigned_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [documentId, 'state', state, clerkId]);
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
      oldDocumentId = existingAssignment.rows[0].sop_document_id;
      
      // Update existing assignment
      await pool.query(`
        UPDATE sop_assignments 
        SET sop_document_id = $1, updated_at = NOW()
        WHERE assignment_type = $2 AND assignment_value = $3
      `, [documentId, 'organization', organization]);
    } else {
      // Create new assignment
      await pool.query(`
        INSERT INTO sop_assignments (
          sop_document_id,
          assignment_type,
          assignment_value,
          assigned_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [documentId, 'organization', organization, clerkId]);
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

    try {
      // Get state SOP - using LEFT JOIN to be more resilient
      const stateResult = await pool.query(`
        SELECT sa.id, sa.sop_document_id, sa.assignment_type, sa.assignment_value, sa.created_at,
               sd.document_name, sd.document_type, sd.file_url
        FROM sop_assignments sa
        LEFT JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
        LIMIT 1
      `, [state]);

      if (stateResult.rows.length > 0) {
        stateSop = stateResult.rows[0];
        stateSop.isDefault = false;
      }
    } catch (stateErr) {
      console.log('Note: State SOP query failed (table may be empty or structure differs):', stateErr.message);
    }

    // If no state-specific SOP, check for default SOP
    let defaultSop = null;
    if (!stateSop) {
      try {
        const defaultResult = await pool.query(`
          SELECT dss.default_document_id, dss.excluded_states, 
                 sd.document_name, sd.document_type, sd.file_url
          FROM default_sop_settings dss
          LEFT JOIN sop_documents sd ON dss.default_document_id = sd.id
          WHERE dss.default_document_id IS NOT NULL
          LIMIT 1
        `);

        if (defaultResult.rows.length > 0) {
          const defaultRow = defaultResult.rows[0];
          const excludedStates = defaultRow.excluded_states || [];
          
          // Only use default if state is not excluded
          if (!excludedStates.includes(state)) {
            defaultSop = {
              document_name: defaultRow.document_name,
              document_type: defaultRow.document_type,
              file_url: defaultRow.file_url,
              sop_document_id: defaultRow.default_document_id,
              isDefault: true
            };
          }
        }
      } catch (defaultErr) {
        console.log('Note: Default SOP query failed:', defaultErr.message);
      }
    }

    // Get organization SOP if provided
    if (organization && organization !== 'None') {
      try {
        const orgResult = await pool.query(`
          SELECT sa.id, sa.sop_document_id, sa.assignment_type, sa.assignment_value, sa.created_at,
                 sd.document_name, sd.document_type, sd.file_url
          FROM sop_assignments sa
          LEFT JOIN sop_documents sd ON sa.sop_document_id = sd.id
          WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
          LIMIT 1
        `, [organization]);

        if (orgResult.rows.length > 0) {
          orgSop = orgResult.rows[0];
        }
      } catch (orgErr) {
        console.log('Note: Org SOP query failed (table may be empty or structure differs):', orgErr.message);
      }
    }

    // Use state SOP or default SOP
    const effectiveStateSop = stateSop || defaultSop;

    // Check if the state is excluded from the default SOP
    // A state is excluded if: no specific state SOP exists AND no default SOP applies (because it's excluded)
    let isStateExcluded = false;
    if (!stateSop && !defaultSop) {
      // Check if the state is actually in the excluded list
      try {
        const excludedCheckResult = await pool.query(`
          SELECT excluded_states FROM default_sop_settings
          WHERE default_document_id IS NOT NULL
          LIMIT 1
        `);
        if (excludedCheckResult.rows.length > 0) {
          const excludedStates = excludedCheckResult.rows[0].excluded_states || [];
          isStateExcluded = excludedStates.includes(state);
        }
      } catch (err) {
        console.log('Note: Could not check excluded states:', err.message);
      }
    }

    res.json({
      state,
      organization: organization || null,
      stateSop: effectiveStateSop ? {
        id: effectiveStateSop.id || null,
        documentId: effectiveStateSop.sop_document_id,
        documentName: effectiveStateSop.document_name || 'Unknown Document',
        documentType: effectiveStateSop.document_type,
        fileUrl: effectiveStateSop.file_url,
        assignedAt: effectiveStateSop.created_at || null,
        isDefault: effectiveStateSop.isDefault || false
      } : null,
      orgSop: orgSop ? {
        id: orgSop.id,
        documentId: orgSop.sop_document_id,
        documentName: orgSop.document_name || 'Unknown Document',
        documentType: orgSop.document_type,
        fileUrl: orgSop.file_url,
        assignedAt: orgSop.created_at
      } : null,
      isStateExcluded
    });

  } catch (error) {
    console.error('Error fetching active SOPs:', error);
    // Return empty result instead of 500 error so frontend can handle gracefully
    res.json({
      state: req.query.state,
      organization: req.query.organization || null,
      stateSop: null,
      orgSop: null,
      warning: 'Could not load SOP data'
    });
  }
};

/**
 * Get all SOP assignments (for admin dashboard)
 */
const getSopAssignments = async (req, res) => {
  try {
    // Use LEFT JOIN to be more resilient if documents are missing
    const result = await pool.query(`
      SELECT sa.*, 
             COALESCE(sd.document_name, 'Unknown Document') as document_name, 
             sd.document_type, 
             sd.file_url
      FROM sop_assignments sa
      LEFT JOIN sop_documents sd ON sa.sop_document_id = sd.id
      ORDER BY sa.updated_at DESC NULLS LAST, sa.created_at DESC
    `);

    res.json({
      assignments: result.rows || []
    });

  } catch (error) {
    console.error('Error fetching SOP assignments:', error);
    // Return empty array instead of 500 so frontend can handle gracefully
    res.json({
      assignments: [],
      warning: 'Could not load SOP assignments: ' + error.message
    });
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
      timeframe,
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

    // Apply scope filter (state or organization)
    if (scope && scope !== 'all') {
      query += ` AND sh.assignment_type = $${paramCount}`;
      params.push(scope);
      paramCount++;
    }

    // Apply action type filter
    if (actionType && actionType !== 'all') {
      query += ` AND LOWER(sh.action_type) = LOWER($${paramCount})`;
      params.push(actionType);
      paramCount++;
    }

    // Apply timeframe filter
    if (timeframe && timeframe !== 'all') {
      if (timeframe === 'last7') {
        query += ` AND sh.created_at >= NOW() - INTERVAL '7 days'`;
      } else if (timeframe === 'last30') {
        query += ` AND sh.created_at >= NOW() - INTERVAL '30 days'`;
      }
    }

    // Apply state filter
    if (state && state !== 'All') {
      query += ` AND sh.assignment_type = 'state' AND sh.assignment_value = $${paramCount}`;
      params.push(state);
      paramCount++;
    }

    // Apply organization filter
    if (organization && organization !== 'All') {
      query += ` AND sh.assignment_type = 'organization' AND sh.assignment_value = $${paramCount}`;
      params.push(organization);
      paramCount++;
    }

    // Apply search filter
    if (search) {
      query += ` AND (
        sd.document_name ILIKE $${paramCount} OR 
        sh.assignment_value ILIKE $${paramCount} OR
        u.email ILIKE $${paramCount} OR
        sh.action_type ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY sh.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count with same filters
    let countQuery = `
      SELECT COUNT(*) 
      FROM sop_history sh
      LEFT JOIN sop_documents sd ON sh.sop_document_id = sd.id
      LEFT JOIN users u ON sh.changed_by = u.clerk_id
      WHERE 1=1
    `;
    
    // Rebuild params for count query (without limit/offset)
    const countParams = [];
    let countParamIndex = 1;

    if (scope && scope !== 'all') {
      countQuery += ` AND sh.assignment_type = $${countParamIndex}`;
      countParams.push(scope);
      countParamIndex++;
    }

    if (actionType && actionType !== 'all') {
      countQuery += ` AND LOWER(sh.action_type) = LOWER($${countParamIndex})`;
      countParams.push(actionType);
      countParamIndex++;
    }

    if (timeframe && timeframe !== 'all') {
      if (timeframe === 'last7') {
        countQuery += ` AND sh.created_at >= NOW() - INTERVAL '7 days'`;
      } else if (timeframe === 'last30') {
        countQuery += ` AND sh.created_at >= NOW() - INTERVAL '30 days'`;
      }
    }

    if (state && state !== 'All') {
      countQuery += ` AND sh.assignment_type = 'state' AND sh.assignment_value = $${countParamIndex}`;
      countParams.push(state);
      countParamIndex++;
    }

    if (organization && organization !== 'All') {
      countQuery += ` AND sh.assignment_type = 'organization' AND sh.assignment_value = $${countParamIndex}`;
      countParams.push(organization);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (
        sd.document_name ILIKE $${countParamIndex} OR 
        sh.assignment_value ILIKE $${countParamIndex} OR
        u.email ILIKE $${countParamIndex} OR
        sh.action_type ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
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
    // Return empty data instead of 500 error to prevent frontend from getting stuck
    res.json({
      history: [],
      total: 0,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      warning: 'Could not load SOP history: ' + error.message
    });
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

/**
 * Export SOP history as CSV with current filters
 */
const exportSopHistoryCsv = async (req, res) => {
  try {
    const { scope, actionType, state, organization, timeframe, search } = req.query;

    // Build the same query as getSopHistory but without pagination
    let query = `
      SELECT 
        sh.id,
        sh.action_type,
        sh.sop_document_id,
        sd.document_name as sop_document_name,
        sh.assignment_type,
        sh.assignment_value,
        sh.changed_by,
        u.email as changed_by_email,
        sh.change_details,
        sh.created_at
      FROM sop_history sh
      LEFT JOIN sop_documents sd ON sh.sop_document_id = sd.id
      LEFT JOIN users u ON sh.changed_by = u.clerk_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply same filters as getSopHistory
    if (scope && scope !== 'all') {
      if (scope === 'document') {
        query += ` AND sh.assignment_type IS NULL`;
      } else if (scope === 'assignment') {
        query += ` AND sh.assignment_type IS NOT NULL`;
      }
    }

    if (actionType && actionType !== 'all') {
      query += ` AND sh.action_type = $${paramIndex}`;
      params.push(actionType);
      paramIndex++;
    }

    if (state && state !== 'all') {
      query += ` AND sh.assignment_type = 'state' AND sh.assignment_value = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    if (organization && organization !== 'all') {
      query += ` AND sh.assignment_type = 'organization' AND sh.assignment_value = $${paramIndex}`;
      params.push(organization);
      paramIndex++;
    }

    if (timeframe && timeframe !== 'all') {
      const now = new Date();
      let dateFilter;
      if (timeframe === '24h') dateFilter = new Date(now.setDate(now.getDate() - 1));
      else if (timeframe === '7d') dateFilter = new Date(now.setDate(now.getDate() - 7));
      else if (timeframe === '30d') dateFilter = new Date(now.setDate(now.getDate() - 30));
      else if (timeframe === '1y') dateFilter = new Date(now.setFullYear(now.getFullYear() - 1));

      if (dateFilter) {
        query += ` AND sh.created_at >= $${paramIndex}`;
        params.push(dateFilter.toISOString());
        paramIndex++;
      }
    }

    if (search) {
      query += ` AND (sd.document_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY sh.created_at DESC`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sop_history.csv"');
      return res.status(200).send('No SOP history found matching filters.');
    }

    // Format data for CSV
    const csvData = result.rows.map(row => ({
      'History ID': row.id,
      'Action Type': row.action_type,
      'Document Name': row.sop_document_name || 'N/A',
      'Assignment Type': row.assignment_type || 'N/A',
      'Assignment Value': row.assignment_value || 'N/A',
      'Changed By Email': row.changed_by_email || 'Unknown',
      'Date': new Date(row.created_at).toLocaleString(),
      'Change Details': row.change_details ? JSON.stringify(row.change_details) : 'N/A'
    }));

    const { Parser } = require('json2csv');
    const fields = ['History ID', 'Action Type', 'Document Name', 'Assignment Type', 'Assignment Value', 'Changed By Email', 'Date', 'Change Details'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sop_history_${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csv);

  } catch (error) {
    console.error('Error exporting SOP history CSV:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to export SOP history CSV', error: error.message });
    }
  }
};

/**
 * Retry PDF text extraction for a document
 */
const retryPdfExtraction = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Get document
    const result = await pool.query(
      'SELECT * FROM sop_documents WHERE id = $1',
      [documentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    const document = result.rows[0];
    
    // Start extraction asynchronously
    extractAndStorePdfText(document.id, document.file_url).catch(err => {
      console.error('[SOP] Retry PDF extraction error:', err);
    });
    
    res.json({
      message: 'PDF extraction retry started',
      documentId: document.id
    });
    
  } catch (error) {
    console.error('Error retrying PDF extraction:', error);
    res.status(500).json({ message: 'Failed to retry PDF extraction', error: error.message });
  }
};

/**
 * Get SOP text content for AI context (used by generate-statement endpoint)
 * Returns the extracted text from SOPs matching user's state and organization
 * Now includes default SOP if the state is not excluded
 */
const getSopTextForContext = async (req, res) => {
  try {
    const { state, organization } = req.query;
    
    if (!state) {
      return res.status(400).json({ message: 'State parameter is required' });
    }
    
    let sopTexts = [];
    let documentIds = new Set(); // Track document IDs to avoid duplicates
    
    // 1. Get manually assigned state SOP text
    const stateResult = await pool.query(`
      SELECT sd.id, sd.document_name, sd.extracted_text, sd.extraction_status
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.sop_document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
      AND sd.extracted_text IS NOT NULL
    `, [state]);
    
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      documentIds.add(stateResult.rows[0].id);
      sopTexts.push({
        type: 'state',
        name: stateResult.rows[0].document_name,
        text: stateResult.rows[0].extracted_text
      });
    }
    
    // 2. Get default SOP text if state is not excluded
    const defaultResult = await pool.query(`
      SELECT sd.id, sd.document_name, sd.extracted_text, dss.excluded_states
      FROM default_sop_settings dss
      JOIN sop_documents sd ON dss.default_document_id = sd.id
      WHERE dss.default_document_id IS NOT NULL
      AND sd.extracted_text IS NOT NULL
      LIMIT 1
    `);
    
    if (defaultResult.rows.length > 0) {
      const defaultDoc = defaultResult.rows[0];
      const excludedStates = defaultDoc.excluded_states || [];
      
      // Add default SOP if state is not excluded and not already included
      if (!excludedStates.includes(state) && !documentIds.has(defaultDoc.id)) {
        documentIds.add(defaultDoc.id);
        sopTexts.push({
          type: 'default',
          name: defaultDoc.document_name,
          text: defaultDoc.extracted_text
        });
      }
    }
    
    // 3. Get organization SOP text if provided
    if (organization && organization !== 'None') {
      const orgResult = await pool.query(`
        SELECT sd.id, sd.document_name, sd.extracted_text, sd.extraction_status
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL
      `, [organization]);
      
      if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
        // Only add if not already included
        if (!documentIds.has(orgResult.rows[0].id)) {
          documentIds.add(orgResult.rows[0].id);
          sopTexts.push({
            type: 'organization',
            name: orgResult.rows[0].document_name,
            text: orgResult.rows[0].extracted_text
          });
        }
      }
    }
    
    // Combine SOP texts into a single context string
    let combinedContext = '';
    
    if (sopTexts.length > 0) {
      combinedContext = sopTexts.map(sop => 
        `=== ${sop.type.toUpperCase()} SOP: ${sop.name} ===\n${sop.text}`
      ).join('\n\n');
    }
    
    res.json({
      state,
      organization: organization || null,
      hasSopContent: sopTexts.length > 0,
      sopCount: sopTexts.length,
      context: combinedContext,
      sops: sopTexts.map(s => ({ type: s.type, name: s.name, length: s.text.length }))
    });
    
  } catch (error) {
    console.error('Error fetching SOP text for context:', error);
    res.status(500).json({ message: 'Failed to fetch SOP text', error: error.message });
  }
};

/**
 * Get extraction status for all documents
 */
const getExtractionStatus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, document_name, extraction_status, 
             CASE WHEN extracted_text IS NOT NULL THEN LENGTH(extracted_text) ELSE 0 END as text_length,
             created_at
      FROM sop_documents 
      ORDER BY created_at DESC
    `);
    
    res.json({
      documents: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching extraction status:', error);
    res.status(500).json({ message: 'Failed to fetch extraction status', error: error.message });
  }
};

/**
 * Get all SOP organizations
 */
const getOrganizations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, created_at, created_by
      FROM sop_organizations
      ORDER BY name ASC
    `);
    res.json({ organizations: result.rows });
  } catch (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01') {
      return res.json({ organizations: [] });
    }
    console.error('Error fetching organizations:', error);
    res.status(500).json({ message: 'Failed to fetch organizations' });
  }
};

/**
 * Create a new SOP organization
 */
const createOrganization = async (req, res) => {
  try {
    const { name } = req.body;
    const clerkId = req.auth.userId;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    // Check if exists
    const existing = await pool.query(
      'SELECT id FROM sop_organizations WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Organization already exists' });
    }

    const result = await pool.query(`
      INSERT INTO sop_organizations (name, created_by, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `, [name.trim(), clerkId]);

    // Log to history
    await pool.query(`
      INSERT INTO sop_history (action_type, assignment_type, assignment_value, changed_by, created_at)
      VALUES ('org_created', 'organization', $1, $2, NOW())
    `, [name.trim(), clerkId]);

    res.json({ organization: result.rows[0], message: 'Organization created' });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ message: 'Failed to create organization' });
  }
};

/**
 * Delete an SOP document
 */
const deleteSopDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const clerkId = req.auth?.userId;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Get document info first
    const docResult = await pool.query(
      'SELECT * FROM sop_documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const document = docResult.rows[0];

    // Delete any assignments using this document first
    await pool.query(
      'DELETE FROM sop_assignments WHERE sop_document_id = $1',
      [documentId]
    );

    // Delete the document
    await pool.query('DELETE FROM sop_documents WHERE id = $1', [documentId]);

    // Log to history
    await pool.query(`
      INSERT INTO sop_history (
        action_type, 
        sop_document_id,
        changed_by, 
        change_details,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      'document_deleted',
      documentId,
      clerkId,
      JSON.stringify({ document_name: document.document_name })
    ]);

    res.json({ 
      message: 'Document deleted successfully',
      deletedDocument: document.document_name
    });
  } catch (error) {
    console.error('Error deleting SOP document:', error);
    res.status(500).json({ message: 'Failed to delete document' });
  }
};

/**
 * Delete an SOP organization
 */
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const clerkId = req.auth.userId;

    // Get org name first
    const org = await pool.query('SELECT name FROM sop_organizations WHERE id = $1', [id]);
    if (org.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const orgName = org.rows[0].name;

    // Delete assignments first
    await pool.query(
      'DELETE FROM sop_assignments WHERE assignment_type = $1 AND assignment_value = $2',
      ['organization', orgName]
    );

    // Delete org
    await pool.query('DELETE FROM sop_organizations WHERE id = $1', [id]);

    // Log to history
    await pool.query(`
      INSERT INTO sop_history (action_type, assignment_type, assignment_value, changed_by, created_at)
      VALUES ('org_deleted', 'organization', $1, $2, NOW())
    `, [orgName, clerkId]);

    res.json({ message: 'Organization deleted' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ message: 'Failed to delete organization' });
  }
};

/**
 * Remove a SOP assignment (state or organization)
 */
const removeSopAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const clerkId = req.auth?.userId;

    if (!assignmentId) {
      return res.status(400).json({ message: 'Assignment ID is required' });
    }

    // Get the assignment details before deleting for history logging
    const assignmentResult = await pool.query(`
      SELECT sa.*, sd.document_name
      FROM sop_assignments sa
      LEFT JOIN sop_documents sd ON sa.sop_document_id = sd.id
      WHERE sa.id = $1
    `, [assignmentId]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const assignment = assignmentResult.rows[0];

    // Delete the assignment
    await pool.query(`DELETE FROM sop_assignments WHERE id = $1`, [assignmentId]);

    // Log to SOP history
    await pool.query(`
      INSERT INTO sop_history (
        sop_document_id,
        action_type,
        assignment_type,
        assignment_value,
        changed_by,
        change_details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      assignment.sop_document_id,
      'removed',
      assignment.assignment_type,
      assignment.assignment_value,
      clerkId,
      JSON.stringify({
        document_name: assignment.document_name,
        removed_by: clerkId
      })
    ]);

    res.json({ 
      message: 'SOP assignment removed successfully',
      assignment: {
        type: assignment.assignment_type,
        value: assignment.assignment_value,
        documentName: assignment.document_name
      }
    });
  } catch (error) {
    console.error('Error removing SOP assignment:', error);
    res.status(500).json({ message: 'Failed to remove SOP assignment' });
  }
};

/**
 * Get default SOP settings
 */
const getDefaultSopSettings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT dss.*, sd.document_name
      FROM default_sop_settings dss
      LEFT JOIN sop_documents sd ON dss.default_document_id = sd.id
      ORDER BY dss.id DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return res.json({
        defaultDocumentId: null,
        documentName: null,
        excludedStates: []
      });
    }
    
    const settings = result.rows[0];
    res.json({
      id: settings.id,
      defaultDocumentId: settings.default_document_id,
      documentName: settings.document_name,
      excludedStates: settings.excluded_states || []
    });
  } catch (error) {
    console.error('Error fetching default SOP settings:', error);
    res.status(500).json({ message: 'Failed to fetch default SOP settings', error: error.message });
  }
};

/**
 * Update default SOP settings
 */
const updateDefaultSopSettings = async (req, res) => {
  try {
    const { defaultDocumentId, excludedStates } = req.body;
    const clerkId = req.auth?.userId;
    
    // Check if settings exist
    const existingResult = await pool.query('SELECT id FROM default_sop_settings LIMIT 1');
    
    if (existingResult.rows.length > 0) {
      // Update existing
      await pool.query(`
        UPDATE default_sop_settings 
        SET default_document_id = $1, 
            excluded_states = $2, 
            updated_at = NOW()
        WHERE id = $3
      `, [defaultDocumentId, excludedStates || [], existingResult.rows[0].id]);
    } else {
      // Create new
      await pool.query(`
        INSERT INTO default_sop_settings (default_document_id, excluded_states, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `, [defaultDocumentId, excludedStates || []]);
    }
    
    // Log to history
    await pool.query(`
      INSERT INTO sop_history (
        action_type, 
        sop_document_id, 
        changed_by, 
        change_details, 
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      'default_sop_updated',
      defaultDocumentId,
      clerkId,
      JSON.stringify({ excluded_states: excludedStates })
    ]);
    
    res.json({ message: 'Default SOP settings updated successfully' });
  } catch (error) {
    console.error('Error updating default SOP settings:', error);
    res.status(500).json({ message: 'Failed to update default SOP settings', error: error.message });
  }
};

/**
 * Get SOP documents for a state (including default if applicable)
 * This is for user-facing pages to know what SOPs apply
 */
const getStateSopWithDefault = async (req, res) => {
  try {
    const { state, organization } = req.query;
    
    if (!state) {
      return res.status(400).json({ message: 'State parameter is required' });
    }
    
    let sops = [];
    
    // 1. Get manually assigned state SOP
    const stateResult = await pool.query(`
      SELECT sa.id, sa.sop_document_id as document_id, sd.document_name, sd.file_url, 'state' as source
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.sop_document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
    `, [state]);
    
    if (stateResult.rows.length > 0) {
      sops.push({
        ...stateResult.rows[0],
        isManuallyAssigned: true,
        isDefault: false
      });
    }
    
    // 2. Get default SOP if state is not excluded
    const defaultResult = await pool.query(`
      SELECT dss.default_document_id as document_id, sd.document_name, sd.file_url, 
             dss.excluded_states, 'default' as source
      FROM default_sop_settings dss
      LEFT JOIN sop_documents sd ON dss.default_document_id = sd.id
      WHERE dss.default_document_id IS NOT NULL
      LIMIT 1
    `);
    
    if (defaultResult.rows.length > 0) {
      const defaultSettings = defaultResult.rows[0];
      const excludedStates = defaultSettings.excluded_states || [];
      
      // Check if state is NOT excluded
      if (!excludedStates.includes(state)) {
        // Don't duplicate if already manually assigned same document
        const alreadyHas = sops.some(s => s.document_id === defaultSettings.document_id);
        if (!alreadyHas) {
          sops.push({
            document_id: defaultSettings.document_id,
            document_name: defaultSettings.document_name,
            file_url: defaultSettings.file_url,
            source: 'default',
            isManuallyAssigned: false,
            isDefault: true
          });
        }
      }
    }
    
    // 3. Get organization SOP if provided
    if (organization && organization !== 'None') {
      const orgResult = await pool.query(`
        SELECT sa.id, sa.sop_document_id as document_id, sd.document_name, sd.file_url, 'organization' as source
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
      `, [organization]);
      
      if (orgResult.rows.length > 0) {
        sops.push({
          ...orgResult.rows[0],
          isManuallyAssigned: true,
          isDefault: false
        });
      }
    }
    
    res.json({
      state,
      organization: organization || null,
      sops,
      hasDefaultSop: sops.some(s => s.isDefault),
      hasManualStateSop: sops.some(s => s.source === 'state' && s.isManuallyAssigned)
    });
  } catch (error) {
    console.error('Error fetching state SOPs with default:', error);
    res.status(500).json({ message: 'Failed to fetch SOPs', error: error.message });
  }
};

module.exports = {
  uploadSopDocument,
  assignStateSop,
  assignOrgSop,
  getActiveSops,
  getSopAssignments,
  getSopHistory,
  getSopDocuments,
  exportSopHistoryCsv,
  retryPdfExtraction,
  getSopTextForContext,
  getExtractionStatus,
  getOrganizations,
  createOrganization,
  deleteOrganization,
  removeSopAssignment,
  deleteSopDocument,
  getDefaultSopSettings,
  updateDefaultSopSettings,
  getStateSopWithDefault
};

