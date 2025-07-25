const { OpenAI } = require('openai');
const pool = require('../db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const searchKnowledgeBase = async (queryText) => {
    try {
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: queryText,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        const searchResult = await pool.query(
            'SELECT chunk_text FROM knowledge_chunks ORDER BY embedding <=> $1 LIMIT 3',
            [JSON.stringify(queryEmbedding)]
        );

        return searchResult.rows.map(row => row.chunk_text).join('\n---\n');
    } catch (error) {
        console.error('[KnowledgeBase] Error searching knowledge base:', error);
        return ''; // Return empty string if search fails
    }
};

module.exports = { searchKnowledgeBase }; 