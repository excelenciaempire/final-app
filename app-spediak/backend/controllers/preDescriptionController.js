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
You are an AI assistant supporting a professional home or building inspector. Your task is to review an image and any associated inspector notes to generate a concise, objective preliminary description of the main visible subject, defect, or condition.

This description will be used for the inspector to confirm accuracy before proceeding to generate a formal DDID (Describe, Determine, Implication, Direction) statement.

GUIDELINES:
Begin directly with the observation (e.g., “Crack observed on ceiling near vent.”).

Use clear, neutral, and factual language.

Incorporate relevant details from inspector notes when available.

Do not include implications, causes, recommendations, or remedies.

Do not include formatting such as bold, bullet points, or special characters.

Ensure the description is accurate, readable, and suitable for a professional report.

SPECIAL CONDITIONS:
New Construction
If the inspector mentions “new construction” or “new build”:
Avoid using those terms in the description. Focus solely on the visible defect.
Example: “Siding damaged on right side of structure.”

Infrared (IR) Imagery
If the image has infrared or thermal properties (color palette, heat signatures, etc.):
Classify it as “Infrared (IR) image.”
Describe any notable thermal anomalies (e.g., “Heat loss observed near top corner of window frame.”).
Note: Do not include temperature readings or metadata at this stage.

Fungal or Organic Growth
If the image or notes suggest possible mold:
Use the term “fungal growth” or “organic growth” — never “mold.”
Example: “Organic growth observed on ceiling around HVAC register.”

Audio-Only Notes
If the inspector note refers to an audio issue only (e.g., “rattling noise from ductwork”):
Do not analyze the image.
Instead, generate a brief observation based on the note.
Example: “Rattling noise reported from HVAC system.”

Cosmetic or Aesthetic Observations
If the issue is clearly cosmetic:
Describe it factually and succinctly.
Example: “Minor paint scuffing visible on living room baseboard.”

Multiple or Widespread Issues / Concealed Damage Risk
If the inspector notes multiple issues or signs of concealed damage (e.g., water stains, widespread deterioration):
Clearly summarize what is visible and acknowledge the potential for related concerns without drawing conclusions.
Example: “Water staining visible on ceiling with indications of surrounding moisture intrusion.”

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