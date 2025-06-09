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
{
  "prompt_name": "DDID Home Inspection Support",
  "version": "1.0",
  "primary_directive": {
    "use_ddid_template": true,
    "inspector_notes_only": true,
    "image_reference_restriction": true
  },
  "ddid_template": {
    "DESCRIBE": "Clearly outline the observed condition or defect, using the inspector's wording if provided. Add necessary context to ensure clarity for non-technical readers. Do not include phrases such as 'as noted by the inspector' or 'based on the inspector's observation'—simply state the condition as described.",
    "DETERMINE": "Briefly explain what system or component is affected, helping the reader understand the area of concern.",
    "IMPLICATION": "Describe potential consequences of leaving the issue unaddressed. Use neutral, factual language and focus on possible outcomes, not guaranteed results.",
    "DIRECTION": "Recommend the most appropriate next step, including evaluation or repair by a licensed professional based on the issue type."
  },
  "modules": {
    "conditional_modules": [
      "new_build",
      "infrared",
      "organic_growth",
      "audio_issues",
      "access_limitations",
      "cosmetic_defects",
      "concealed_damage",
      "no_issues_observed",
      "rule_hierarchy_handling",
      "multiple_issues"
    ]
"module_tags": [
  {"module": "access_limitations", "tags": ["visual-only", "obstruction"]},
  {"module": "organic_growth", "tags": ["bio-risk", "hidden-risk"]},
  {"module": "multi_issue_handling", "tags": ["logic-control", "grouping"]}
]
  },
  "logic_controls": {
    "Refer to Main Prompt version 1.2 for logic routing, exception handling, and fallback scenarios for this module."
    },
    "code_reference_handling": {
      "directive": "Do not include building code references in any DDID output. All DDID content must remain neutral and instructional."
    },
    "multi_issue_handling": {
      "grouping_phrase": "Combine into a single DDID statement, listing each defect clearly in the 'Describe' section.",
      "separation_phrase": "Generate a separate, complete DDID block for each issue.",
      "direction_logic": {
        "concealed_damage": "Recommend contractor evaluation of all related areas and note the potential for hidden or concealed damage.",
        "visible_safety_trade": "Refer the issue to the appropriate licensed trade (e.g., electrician, plumber) for correction."
      }
    }
  }
}
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
