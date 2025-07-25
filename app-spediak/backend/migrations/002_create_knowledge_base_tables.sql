-- Enable the pgvector extension to support vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the table to store knowledge base documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_url TEXT, -- To store the Cloudinary URL for downloads
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, indexing, complete, error
    error_message TEXT
);

-- Create the table to store the chunks of each document
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536), -- Assuming OpenAI's text-embedding-ada-002 model
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on the document_id for faster chunk retrieval
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);

-- Create an IVFFlat index for efficient similarity search on the embeddings
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100); 