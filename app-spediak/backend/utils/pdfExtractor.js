/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files for RAG/AI context
 */

const pdfParse = require('pdf-parse');
const axios = require('axios');

/**
 * Extract text from a PDF file URL
 * @param {string} fileUrl - The URL of the PDF file (e.g., Cloudinary URL)
 * @returns {Promise<{text: string, numPages: number, info: object}>} Extracted text and metadata
 */
async function extractTextFromPdf(fileUrl) {
  try {
    console.log(`[PDF Extractor] Downloading PDF from: ${fileUrl}`);
    
    // Download the PDF file
    const response = await axios.get(fileUrl, { 
      responseType: 'arraybuffer',
      timeout: 60000 // 60 second timeout for large files
    });
    
    const buffer = Buffer.from(response.data);
    console.log(`[PDF Extractor] Downloaded ${buffer.length} bytes`);
    
    // Parse the PDF
    const data = await pdfParse(buffer);
    
    console.log(`[PDF Extractor] Extracted ${data.text.length} characters from ${data.numpages} pages`);
    
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info || {}
    };
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text:', error.message);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
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
  extractTextFromBuffer,
  cleanExtractedText,
  truncateText
};

