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
                    // Reverted to a simple INSERT to avoid errors without a unique constraint.
                    // This is safer than relying on a migration the user may not have run.
                    const dbResult = await pool.query(
                        'INSERT INTO knowledge_documents (file_name, file_type, file_url, status) VALUES ($1, $2, $3, $4) RETURNING id',
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
        // Corrected query to only select columns that are guaranteed to exist.
        const documents = await pool.query('SELECT id, file_name, file_type, uploaded_at, status FROM knowledge_documents ORDER BY uploaded_at DESC');
        res.status(200).json(documents.rows);
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
        const result = await pool.query('SELECT file_name FROM knowledge_documents WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Document not found.' });
        }
        const { file_name } = result.rows[0];
        const public_id = `knowledge_base/${file_name}`;

        // This is the definitive, correct method for generating a secure link for an authenticated raw file.
        // It specifies the correct delivery type and forces a download with the original filename.
        const signed_url = cloudinary.url(public_id, {
            resource_type: 'raw',
            type: 'authenticated',
            sign_url: true,
            expires_at: Math.floor(Date.now() / 1000) + 60, // URL is valid for 60 seconds
            attachment: file_name,
        });

        // Redirect the user's browser to the secure, temporary URL to handle the download directly.
        res.redirect(signed_url);

    } catch (error) {
        console.error('[Download] Error generating download URL:', error);
        res.status(500).json({ message: 'Failed to generate download link.' });
    }
};

module.exports = { uploadDocument, getDocuments, deleteDocument, downloadDocument }; 