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
    "describe": "Clearly outline the observed condition or defect, using the inspector's wording if provided. Add necessary context to ensure clarity for non-technical readers. Do not include phrases such as 'as noted by the inspector' or 'based on the inspector's observation'—simply state the condition as described.",
    "determine": "Briefly explain what system or component is affected, helping the reader understand the area of concern.",
    "implication": "Describe potential consequences of leaving the issue unaddressed. Use neutral, factual language and focus on possible outcomes, not guaranteed results.",
    "direct": "Recommend the most appropriate next step, including evaluation or repair by a licensed professional based on the issue type."
  },
  "modules": {
    "image_analysis": {
      "trigger": "image_analysis=true",
      "use_for_preliminary_only": true
    },
    "full_image_ddid": {
      "status": "inactive",
      "use_visual_for_describe_and_determine": true
    },
    "conditional_modules": [
      "new_build",
      "infrared",
      "organic_growth",
      "audio_issues",
      "access_limitations",
      "cosmetic_defects",
      "concealed_damage",
      "no_issues_observed",
      "rule_hierarchy_handling"
    ]
  },
  "logic_controls": {
    "vague_input_phrasing": {
      "trigger_keywords": ["possibly", "unclear", "potential"],
      "template": "The condition noted may affect the component's integrity over time if not addressed. Recommend evaluation by a qualified contractor to confirm and address hidden issues."
    },
    "alarmist_language_filter": {
      "avoid_terms": ["collapse", "death", "emergency"],
      "preferred_phrases": ["may lead to further deterioration", "could affect long-term performance"]
    }
  },
  "direction_logic_table": {
    "general_defect": "Recommend further evaluation by qualified licensed contractor.",
    "electrical_issue": "Consult with a licensed electrical contractor for additional repairs.",
    "plumbing_defect": "Consult with a licensed plumbing contractor for additional repairs.",
    "hvac_major": "Consult with a licensed HVAC contractor for additional repairs.",
    "hvac_minor": "Recommend maintenance by qualified licensed contractor.",
    "roofing_attic": "Recommend evaluation by roofing or licensed contractor.",
    "structural_issue": "Consult with a structural engineer for further evaluation to determine the repairs needed.",
    "multiple_critical": "Consolidate if implications match; separate if implications differ.",
    "new_build_defect": "Have the builder further evaluate and make any additional repairs as deemed necessary.",
    "organic_growth_minor": "Recommend monitoring after removal; further evaluation by environmental specialist if recurrence occurs.",
    "organic_growth_extensive": "Recommend environmental testing and evaluation by a specialist.",
    "wear_and_tear": "Recommend continued monitoring and repair as needed."
  }
}

---

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
