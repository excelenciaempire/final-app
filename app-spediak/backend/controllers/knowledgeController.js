const pool = require('../db');
const { OpenAI } = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');
const { Readable } = require('stream');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Multer Setup for file uploads ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, TXT, and MD are allowed.'), false);
        }
    }
}).single('document');

// --- Document Processing Service ---
const processAndEmbedDocument = async (documentId, fileBuffer, fileType) => {
    try {
        // 1. Update document status to 'indexing'
        await pool.query('UPDATE knowledge_documents SET status = $1 WHERE id = $2', ['indexing', documentId]);

        // 2. Extract text from the document
        let text = '';
        if (fileType === 'application/pdf') {
            const data = await pdf(fileBuffer);
            text = data.text;
        } else {
            text = fileBuffer.toString('utf-8');
        }

        // 3. Split text into chunks
        const chunks = text.match(/[\s\S]{1,1000}/g) || [];

        // 4. Generate embeddings and store chunks
        for (const chunk of chunks) {
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: chunk,
            });
            const embedding = embeddingResponse.data[0].embedding;

            await pool.query(
                'INSERT INTO knowledge_chunks (document_id, chunk_text, embedding) VALUES ($1, $2, $3)',
                [documentId, chunk, embedding]
            );
        }

        // 5. Update document status to 'complete'
        await pool.query('UPDATE knowledge_documents SET status = $1 WHERE id = $2', ['complete', documentId]);
        console.log(`[KnowledgeBase] Successfully processed and embedded document ID: ${documentId}`);

    } catch (error) {
        console.error(`[KnowledgeBase] Error processing document ID ${documentId}:`, error);
        await pool.query(
            'UPDATE knowledge_documents SET status = $1, error_message = $2 WHERE id = $3',
            ['error', error.message, documentId]
        );
    }
};

// --- Controller Functions ---
const uploadDocument = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const { originalname, mimetype, buffer } = req.file;

        try {
            const result = await pool.query(
                'INSERT INTO knowledge_documents (file_name, file_type, status) VALUES ($1, $2, $3) RETURNING id',
                [originalname, mimetype, 'pending']
            );
            const documentId = result.rows[0].id;

            // Start processing in the background, don't make the user wait
            processAndEmbedDocument(documentId, buffer, mimetype);

            res.status(201).json({ message: 'File uploaded and is being processed.', documentId });
        } catch (error) {
            console.error('[KnowledgeBase] Error creating document record:', error);
            res.status(500).json({ message: 'Failed to save document record.' });
        }
    });
};

const getDocuments = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, file_name, file_type, uploaded_at, status FROM knowledge_documents ORDER BY uploaded_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[KnowledgeBase] Error fetching documents:', error);
        res.status(500).json({ message: 'Failed to fetch documents.' });
    }
};

const deleteDocument = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
        res.status(200).json({ message: 'Document deleted successfully.' });
    } catch (error) {
        console.error(`[KnowledgeBase] Error deleting document ID ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete document.' });
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    deleteDocument
}; 