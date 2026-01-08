/**
 * Document Text Extraction Utility
 * Extracts text content from PDF and DOCX files for RAG/AI context
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');

/**
 * Detect file type from URL or content
 */
function getFileType(fileUrl) {
  const lowerUrl = fileUrl.toLowerCase();
  if (lowerUrl.includes('.docx') || lowerUrl.includes('docx')) return 'docx';
  if (lowerUrl.includes('.doc') && !lowerUrl.includes('.docx')) return 'doc';
  return 'pdf'; // Default to PDF
}

/**
 * Extract text from a document URL (supports PDF and DOCX)
 * @param {string} fileUrl - The URL of the file (PDF or DOCX)
 * @returns {Promise<{text: string, numPages: number, info: object}>} Extracted text and metadata
 */
async function extractTextFromPdf(fileUrl) {
  const fileType = getFileType(fileUrl);
  
  try {
    console.log(`[Doc Extractor] Downloading ${fileType.toUpperCase()} from: ${fileUrl}`);
    
    // Download the file
    const response = await axios.get(fileUrl, { 
      responseType: 'arraybuffer',
      timeout: 60000 // 60 second timeout for large files
    });
    
    const buffer = Buffer.from(response.data);
    console.log(`[Doc Extractor] Downloaded ${buffer.length} bytes`);
    
    if (fileType === 'docx') {
      return await extractTextFromDocx(buffer);
    } else {
      // Parse as PDF
      const data = await pdfParse(buffer);
      console.log(`[Doc Extractor] Extracted ${data.text.length} characters from ${data.numpages} pages`);
      
      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info || {}
      };
    }
  } catch (error) {
    console.error('[Doc Extractor] Error extracting text:', error.message);
    throw new Error(`Failed to extract ${fileType.toUpperCase()} text: ${error.message}`);
  }
}

/**
 * Extract text from a DOCX buffer
 * @param {Buffer} buffer - The DOCX file buffer
 * @returns {Promise<{text: string, numPages: number, info: object}>} Extracted text and metadata
 */
async function extractTextFromDocx(buffer) {
  try {
    console.log(`[DOCX Extractor] Processing buffer of ${buffer.length} bytes`);
    
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Estimate pages (roughly 3000 chars per page)
    const estimatedPages = Math.ceil(text.length / 3000);
    
    console.log(`[DOCX Extractor] Extracted ${text.length} characters (~${estimatedPages} pages)`);
    
    return {
      text: text,
      numPages: estimatedPages,
      info: { format: 'docx' }
    };
  } catch (error) {
    console.error('[DOCX Extractor] Error extracting text:', error.message);
    throw new Error(`Failed to extract DOCX text: ${error.message}`);
  }
}

/**
 * Extract text from a PDF buffer (for direct file uploads)
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<{text: string, numPages: number, info: object}>} Extracted text and metadata
 */
async function extractTextFromBuffer(buffer) {
  try {
    console.log(`[PDF Extractor] Processing buffer of ${buffer.length} bytes`);
    
    const data = await pdfParse(buffer);
    
    console.log(`[PDF Extractor] Extracted ${data.text.length} characters from ${data.numpages} pages`);
    
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info || {}
    };
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text from buffer:', error.message);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }
}

/**
 * Clean and normalize extracted PDF text
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text
 */
function cleanExtractedText(text) {
  if (!text) return '';
  
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

/**
 * Truncate text to a maximum length while preserving word boundaries
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum character length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 50000) {
  if (!text || text.length <= maxLength) return text;
  
  // Find the last space before the limit
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

module.exports = {
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromBuffer,
  cleanExtractedText,
  truncateText,
  getFileType
};

