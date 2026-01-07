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
 */
const getSopTextForContext = async (req, res) => {
  try {
    const { state, organization } = req.query;
    
    if (!state) {
      return res.status(400).json({ message: 'State parameter is required' });
    }
    
    let sopTexts = [];
    
    // Get state SOP text
    const stateResult = await pool.query(`
      SELECT sd.document_name, sd.extracted_text, sd.extraction_status
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
      AND sd.extracted_text IS NOT NULL
    `, [state]);
    
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      sopTexts.push({
        type: 'state',
        name: stateResult.rows[0].document_name,
        text: stateResult.rows[0].extracted_text
      });
    }
    
    // Get organization SOP text if provided
    if (organization && organization !== 'None') {
      const orgResult = await pool.query(`
        SELECT sd.document_name, sd.extracted_text, sd.extraction_status
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL
      `, [organization]);
      
      if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
        sopTexts.push({
          type: 'organization',
          name: orgResult.rows[0].document_name,
          text: orgResult.rows[0].extracted_text
        });
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
  getExtractionStatus
};

