const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to read prompts from JSON file
const getPrompts = () => {
  const promptsPath = path.join(__dirname, '..', 'prompts.json');
  const promptsJson = fs.readFileSync(promptsPath, 'utf8');
  return JSON.parse(promptsJson);
};

const generatePreDescriptionController = async (req, res) => {
  const { imageBase64, description, userState } = req.body; // description is the initial user input here

  // imageBase64 and userState are essential for context
  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  const { pre_description_prompt } = getPrompts();

  const prompt = `
${pre_description_prompt}
Inspector Data:
- Analyze the image and the inspector's notes (${description || 'None provided'}).
- Location (State): ${userState}
- Initial Notes: ${description || 'None provided'}
- Image: <attached>

Generate the preliminary description now.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Or gpt-4-vision-preview if preferred
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`, // Assuming JPEG, adjust if needed
              },
            },
          ],
        },
      ],
      max_tokens: 100, // Keep it brief
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

module.exports = { generatePreDescriptionController }; 