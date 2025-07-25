const { OpenAI } = require('openai');
const pool = require('../db'); // Import the database pool

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generatePreDescriptionController = async (req, res) => {
  const { imageBase64, description, userState } = req.body;

  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  try {
    // Fetch the live prompt from the database
    const promptResult = await pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'preliminary_description_prompt'");
    if (promptResult.rows.length === 0) {
        return res.status(500).json({ message: 'Preliminary description prompt not found in the database.' });
    }
    const preliminary_description_prompt = promptResult.rows[0].prompt_content;

    const prompt = `
${preliminary_description_prompt}
Inspector Data:
- Analyze the image and the inspector's notes (${description || 'None provided'}).
- Location (State): ${userState}
- Initial Notes: ${description || 'None provided'}
- Image: <attached>

Generate the preliminary description now.
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
      max_tokens: 100,
    });

    const preDescription = response.choices[0].message.content?.trim() || 'Could not generate preliminary description.';
    console.log("[PreDescription] Generated:", preDescription);
    return res.json({ preDescription });

  } catch (error) {
    console.error('OpenAI Error (PreDescription):', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred while generating the preliminary description.';
    return res.status(500).json({ message: `Failed to generate preliminary description: ${errorMessage}` });
  }
};

module.exports = { generatePreDescription: generatePreDescriptionController }; 