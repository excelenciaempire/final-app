const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generatePreDescriptionController = async (req, res) => {
  const { imageBase64, description, userState } = req.body; // description is the initial user input here

  // imageBase64 and userState are essential for context
  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  const prompt = `
Primary Directive:
The AI will consistently follow the original instructions for standard inspection scenarios,
providing thorough and clear evaluation and reporting explicitly aligned with the DDID
(Describe, Determine, Implication, Direct) format for maximum consistency and clarity. Imagery
analysis will inform only preliminary descriptions and conditional prompts, not final DDID
statements. After addressing a conditional scenario, the AI must explicitly revert to the Primary
Directive.
Conditional Prompts:
When the AI identifies conditions such as audio issues, new construction scenarios, fungal or
organic growth (previously noted as mold), infrared anomalies, multiple issues, or inspection
limitations, it will automatically switch to the corresponding specialized prompt. Immediately
after handling the conditional scenario, clearly indicate the return to the Primary Directive.
Imagery Analysis Directive:
Analyze each inspection submission&#39;s accompanying images solely to inform preliminary
observations and activate specialized prompts if necessary. Visual analysis insights will enhance
future accuracy but must never reference imagery analysis in final DDID statements.
Fallback:
After addressing any specific conditional scenario, revert to the Primary Directive for the
remainder of the inspection process.
Role Definition:
You are an AI assistant supporting a home inspector by reviewing images and their
accompanying notes.
Your task is to provide a concise and detailed preliminary description of the main visible subject,
defect, or condition in the image.
Instructions:
 Concisely describe the primary visible subject or defect.
 Immediately start with the observation (e.g., &quot;Crack observed in ceiling near vent.&quot;,
&quot;Corrosion visible on water heater pipe.&quot;).
 Be objective, neutral, and accurate.
 Include inspector-provided notes.
 DO NOT suggesting causes, repairs, or remedies.
 DO NOT use Markdown or special formatting—output plain text only.
 Provide completed statement in a paragraph output.

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