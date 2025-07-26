const pool = require('../db');
const { OpenAI } = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const pgvector = require('pgvector/pg');
const axios = require('axios'); // For streaming from Cloudinary

// Configure services
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }).single('document');

// --- Document Processing Service ---
const processAndEmbedDocument = async (documentId, fileBuffer, fileType) => {
    try {
        await pool.query('UPDATE knowledge_documents SET status = $1 WHERE id = $2', ['indexing', documentId]);

        let text = fileType === 'application/pdf' ? (await pdf(fileBuffer)).text : fileBuffer.toString('utf-8');
        const chunks = text.match(/[\s\S]{1,1000}/g) || [];

        for (const chunk of chunks) {
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: chunk,
            });
            const embedding = embeddingResponse.data[0].embedding;
            await pool.query(
                'INSERT INTO knowledge_chunks (document_id, chunk_text, embedding) VALUES ($1, $2, $3)',
                [documentId, chunk, pgvector.toSql(embedding)]
            );
        }

        await pool.query('UPDATE knowledge_documents SET status = $1 WHERE id = $2', ['complete', documentId]);
        console.log(`[KnowledgeBase] Successfully processed document ID: ${documentId}`);
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
            console.error('[Upload] Multer error:', err);
            return res.status(400).json({ message: 'File upload error: ' + err.message });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        const { originalname, mimetype, buffer } = req.file;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                public_id: originalname,
                folder: 'knowledge_base',
                access_mode: 'authenticated', // IMPORTANT: Make file private
                overwrite: true,
            },
            async (error, result) => {
                if (error) {
                    console.error('[Cloudinary] Upload failed:', error);
                    return res.status(500).json({ message: 'Failed to upload file to cloud storage.' });
                }
                try {
                    const dbResult = await pool.query(
                        'INSERT INTO knowledge_documents (file_name, file_type, file_url, status) VALUES ($1, $2, $3, $4) ON CONFLICT (file_name) DO UPDATE SET file_url = $3, status = $4, uploaded_at = NOW() RETURNING id',
                        [originalname, mimetype, result.secure_url, 'pending']
                    );
                    const documentId = dbResult.rows[0].id;

                    // This can run in the background, no need to await
                    processAndEmbedDocument(documentId, buffer, mimetype);

                    res.status(201).json({ message: 'File uploaded successfully and is being processed.', documentId });
                } catch (dbError) {
                    console.error('[Database] Error saving document metadata:', dbError);
                    res.status(500).json({ message: 'Failed to save document metadata.' });
                }
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });
};

const getDocuments = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, file_name, file_type, file_url, uploaded_at, status FROM knowledge_documents ORDER BY uploaded_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[KnowledgeBase] Error fetching documents:', error);
        res.status(500).json({ message: 'Failed to fetch documents.' });
    }
};

const deleteDocument = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: "Document ID is required." });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const docResult = await client.query('SELECT file_name FROM knowledge_documents WHERE id = $1', [id]);

        if (docResult.rows.length > 0) {
            const fileName = docResult.rows[0].file_name;
            const publicId = `knowledge_base/${fileName}`;

            // Use a promise to handle the async cloudinary call properly
            await new Promise((resolve, reject) => {
                cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }, (error, result) => {
                    if (error) {
                        console.error('[Cloudinary] Failed to delete document:', error);
                        return reject(new Error('Failed to delete file from cloud storage.'));
                    }
                    console.log('[Cloudinary] Document deleted:', result);
                    resolve(result);
                });
            });
        }

        // Now delete from the database
        await client.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Document deleted successfully.' });

    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error(`[KnowledgeBase] Error deleting document ID ${id}:`, error);
        res.status(500).json({ message: error.message || 'Failed to delete document.' });
    } finally {
        if(client) client.release();
    }
};

const downloadDocument = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT file_name, file_type FROM knowledge_documents WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Document not found.' });
        }
        const { file_name, file_type } = result.rows[0];

        const public_id = `knowledge_base/${file_name}`;

        const signed_url = cloudinary.utils.private_download_url(public_id, {
            resource_type: 'raw',
        });

        res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
        res.setHeader('Content-Type', file_type);

        const response = await axios({
            method: 'GET',
            url: signed_url,
            responseType: 'stream',
        });

        response.data.pipe(res);

    } catch (error) {
        console.error('[Download] Error streaming document:', error);
        res.status(500).json({ message: 'Failed to download document.' });
    }
};

module.exports = { uploadDocument, getDocuments, deleteDocument, downloadDocument }; 