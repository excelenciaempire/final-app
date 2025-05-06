const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateDdidController = async (req, res) => {
  const { description, userState } = req.body;

  if (!description || !userState) {
    return res.status(400).json({ message: 'Missing required fields (description, userState).' });
  }

  const prompt = `
You are an AI assistant creating plain text inspection statements for reports, following the Describe, Determine, Implication, Direct (DDID) model.

The inspector has provided the final description of the issue after reviewing an initial observation (and potentially editing it). Your task is to generate the full DDID statement based ONLY on this final description and the location.

Format:
Describe: [Use the provided description directly as the starting point. Ensure it reads naturally.]
Determine: [Identify the specific defect or issue implied by the description.]
Implication: [Explain the potential consequences FACTUALLY and NEUTRALLY based on the described issue. Avoid speculative or alarming language. Focus on what the issue *could* lead to if unaddressed, e.g., "Could lead to structural weakening" or "May indicate foundation movement".]
Direct: [Recommend the immediate next step based on the described issue, usually involving professional assessment, e.g., "Further evaluation by a qualified structural engineer is recommended." or "Consultation with a licensed plumber is advised." or "Recommend monitoring for changes."]

Key Instructions:
- Use break lines to separate each section of the DDID statement.
- Base your response **SOLELY** on the final description provided by the inspector.
- **DO NOT** refer back to any image analysis.
- Ensure the tone throughout is objective, precise, and informative. Avoid jargon where possible, but be specific.
- **CRITICAL: DO NOT** mention building codes, safety standards, regulations, compliance, or pass/fail judgments. The statement must be purely observational and descriptive of the condition and potential outcomes.
- **CRITICAL: DO NOT** include any Markdown formatting (like **, *, lists, etc.). The entire output MUST be plain text suitable for direct copy-pasting into a report.
- Be concise and clear in each section.

Inspector Data:
- Location (State): ${userState}
- Final Description: ${description}

Generate the DDID statement now.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
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

module.exports = { generateDdidController };
