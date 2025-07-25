const { OpenAI } = require('openai');
const pool = require('../db'); // Import the database pool
const { searchKnowledgeBase } = require('../utils/knowledgeUtils');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateDdidController = async (req, res) => {
  const { imageBase64, description, userState } = req.body;

  if (!description || !userState || !imageBase64) {
    return res.status(400).json({ message: 'Missing required fields (image, description, userState).' });
  }

  try {
    // Fetch the live prompt from the database
    const promptResult = await pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'ddid_prompt'");
    if (promptResult.rows.length === 0) {
        return res.status(500).json({ message: 'DDID prompt not found in the database.' });
    }
    const ddid_prompt_template = promptResult.rows[0].prompt_content;
    
    // Search for relevant knowledge using the final description
    const knowledge = await searchKnowledgeBase(description);
    
    const prompt = `
Relevant Knowledge Base Info:
${knowledge || 'None'}
---
${ddid_prompt_template}
Inspector Data:
- Location (State): ${userState}
- Final Description: ${description}

Generate the DDID statement now.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 600,
    });

    let ddid = response.choices[0].message.content?.trim() || 'Error generating statement.';
    ddid = ddid.replace(/\*\*/g, '');

    console.log("[DDID Final] Generated:", ddid);
    return res.json({ ddid });
  } catch (error) {
    console.error('OpenAI Error (DDID Final):', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred while generating the final statement.';
    return res.status(500).json({ message: `Failed to generate final statement: ${errorMessage}` });
  }
};

module.exports = { generateDdid: generateDdidController };
