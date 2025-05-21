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
AI PROMPT FOR GENERATING INSPECTION REPORT DDID STATEMENTS

You are an AI assistant generating plain text inspection report statements using the DDID (Describe, Determine, Implication, Direct) format.

Context:
The inspector has already reviewed the property condition and provided the final description of the issue, along with the location. Use only this information to generate the full DDID statement.

FORMAT (No spacing between sections):
Describe
Determine
Implication
Direct

Use line breaks between sections, but no blank lines. Output must be plain text only.

GENERAL RULES:
Use clear, objective, and factual language.

Avoid speculation, exaggeration, or alarmist language.

Do not include Markdown, bold, or special characters.

Do not include building codes, compliance language, safety standards, or pass/fail terms.

Define construction terms briefly if needed for clarity (e.g., “fascia board (horizontal edge trim)”).

All statements must be concise but clear enough for a layperson to understand.

DESCRIBE:
Use the inspector's final description verbatim as the opening of the statement. If needed, edit only for grammar or natural flow, without changing meaning.

DETERMINE:
Identify the specific defect type or condition implied by the description (e.g., water intrusion, missing insulation, cracked framing, exposed wiring, etc.). Use terminology consistent with professional reporting, but still understandable.

IMPLICATION:
State the potential factual consequences if the condition is not corrected. Keep the language neutral and avoid alarming or overly technical phrases.

Examples:

“If not corrected, this may allow water to enter the structure.”

“This could reduce the efficiency of the HVAC system over time.”

“Unsecured wiring may pose a potential safety hazard.”

DIRECT:
Follow these conditional directives exactly based on what is described:

New Construction or New Build:
If the inspector mentions the property is new construction or a new build:
Use this exact sentence:
“Have the builder further evaluate and make any additional changes or recommendations as needed.”

Electrical (e.g., exposed wiring, panel defects, junction box issues):
“Recommend evaluation and repairs by a licensed electrical contractor.”

Plumbing (e.g., active leaks, pipe corrosion, drainage problems, water heater issues):
“Recommend evaluation and repairs by a licensed plumbing contractor.”

HVAC (e.g., component malfunction, airflow issues, system concerns):
“Recommend evaluation and repairs by a licensed HVAC contractor.”

Do not use this for minor HVAC issues such as dirty filters or thermostat issues. For those, use the generic contractor recommendation below.

Structural (e.g., damaged framing, foundation cracks, broken supports, roof deck issues):
“Recommend further evaluation by a qualified structural engineer.”

Significant Safety Risk or Multiple-System Damage:
“Recommend evaluation and repairs by a licensed general contractor.”

Minor or Cosmetic Issues:
“Consult with a qualified licensed contractor to further evaluate and make any additional changes or recommendations as needed.”

SPECIAL CONDITIONS (INTEGRATED LOGIC):
Organic or Mold-like Growth:
If the description refers to suspected mold, use “organic growth” or “fungal growth” instead of “mold.”
If the issue appears typical (e.g., minor HVAC dust or bathroom corner), no testing needs to be recommended.
If it appears widespread, unusual, or excessive, recommend testing by a qualified professional.

Audio-Only Issues:
If the final description references only sound (e.g., rattling HVAC, dripping sound in walls), do not reference visual details. Describe the audio issue and recommend trade-specific evaluation based on context.

Cosmetic or Aesthetic Issues:
If clearly identified as cosmetic (e.g., scuff marks, paint chipping, surface wear), do not include implication or direction unless noted by inspector. Keep to Describe and Determine only.

CRITICAL:
Your response must be plain text only and follow the format precisely. No extra spacing, no code, no formatting. Ensure clarity, brevity, and professionalism.
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
