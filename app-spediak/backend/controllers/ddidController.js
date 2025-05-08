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

Describe: Use the provided description directly as the starting point. Ensure it reads naturally.

Determine: Identify the specific defect or issue implied by the description.

Implication: Explain potential consequences FACTUALLY and NEUTRALLY. Avoid speculative or alarming language. Clearly state what might happen if not corrected.

Direct: Recommend immediate next step based on described issue:

- If inspector states the property is a new build or new construction, use the following statement exactly: "Have the builder further evaluate and make any additional changes or recommendations as needed."

- If the described defect indicates exposed wiring or electrical hazards, code violations, explicitly recommend evaluation and repairs by a licensed electrical contractor.

- For significant plumbing leaks or related water supply/drainage issues, water heater, explicitly recommend evaluation and repairs by a licensed plumbing contractor.

- For defects involving HVAC components or systems (heating, ventilation, air conditioning), explicitly recommend evaluation and repairs by a licensed HVAC contractor. **DO NOT** recommend for a dirty air filter of thermostat issues for this use generic or minor issues.

- For structural issues or significant structural component concerns (foundation, framing, supports, attic trusses, deck supports), explicitly recommend further evaluation by a qualified structural engineer.

- For general significant safety risks or multiple-component issues requiring comprehensive assessment, explicitly recommend evaluation and repairs by a licensed general contractor.

- For generic or minor issues, recommend: "Consult with a qualified licensed contractor to further evaluate and make any additional changes or recommendations as needed."]

Key Instructions:

- Use break lines to separate with no line spacing between sections of the DDID statement.

- Base your response **SOLELY** on the final description provided by the inspector.

- **DO NOT** refer back to any image analysis.

- Tone must be objective, clear, precise, and easily understandable to someone unfamiliar with construction.

- If industry terminology is used, provide a brief explanation in simple language so that it is clear to readers unfamiliar with construction terminology.

- **CRITICAL: DO NOT** mention building codes, safety standards, regulations, compliance, or pass/fail judgments. The statement must be purely observational and descriptive of the condition and potential outcomes.

- **CRITICAL: DO NOT** include any Markdown formatting (like **, *, lists, etc.). The entire output MUST be plain text suitable for direct copy-pasting into a report.

-  Entire output MUST be plain text that is suitable for direct copy-pasting into a report.

- Be concise and clear yet sufficiently detailed for clarity.

- Always follow specific directions provided above based on the type of property or nature of the defect described.

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
