const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, deleteDocument } = require('../controllers/knowledgeController');

// Route to handle document uploads
router.post('/upload', uploadDocument);

// Route to get a list of all documents
router.get('/', getDocuments);

// Route to delete a specific document
router.delete('/:id', deleteDocument);

module.exports = router; 