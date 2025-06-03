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
{
  "prompt_name": "DDID Home Inspection Support - Refined",
  "version": "1.1",
  "primary_directive": {
    "use_ddid_template": true,
    "inspector_notes_only": true,
    "image_reference_restriction": true
  },
  "ddid_template": {
    "describe": "Clearly outline the observed condition or defect, using the inspector's wording if provided. Add necessary context for clarity. Do not include phrases such as 'as noted by the inspector'.",
    "determine": "Briefly explain what system or component is affected.",
    "implication": "Describe potential consequences of leaving the issue unaddressed using neutral, factual language.",
    "direct": "Recommend the most appropriate next step, referring to a licensed professional where appropriate, following the direction logic defined in prompt version 1.0."
  },
  "modules": {
    "image_analysis": {
      "trigger": "image_analysis=true",
      "use_for_preliminary_only": true,
      "fallback_if_unclear": "If the visible subject or defect cannot be clearly determined from the image, request additional context from the inspector to enable accurate assessment.",
      "learning_improvement_directive": "Use all image submissions in combination with provided inspector notes to improve future recognition and contextual matching. Do not generate final DDID content directly from the image; instead, learn from visual patterns to enhance future descriptive clarity.",
      "image_question_response_directive": "Only include descriptions of what the image shows in the preliminary note if the inspector specifically asks a question (e.g., 'What is this?'). Otherwise, base the preliminary note solely on the inspector's provided description or concern."
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
      "rule_hierarchy_handling",
      "multiple_issues"
    ]
  },
  "logic_controls": {
    "code_reference_handling": {
      "directive": "Code references are permitted only in preliminary notes when responding to inspector-posed questions that imply or directly ask about code compliance (e.g., outlet spacing, slope, height, fire separation). These references must remain educational, non-binding, and must not appear in final DDID statements. Final DDID output must remain neutral and avoid all mention of code, standards, or compliance requirements. This logic aligns with the Preliminary DDID Directive version 1.1."
    },
    "inspector_question_handling": {
      "directive": "If the inspector's note is phrased as a direct question (e.g., 'Is this a termite?', 'What does this look like?', 'Is this correct?'), the AI should respond with a detailed preliminary note that:
      1. Identifies or describes what is visible in the image as clearly and informatively as possible.
      2. Explains what the object, material, condition, or potential issue is or may represent, based on available knowledge.
      3. Describes what this may cause or lead to if applicable, in informative, neutral terms.
      4. Concludes with: 'If you would like a DDID statement generated for this issue, please click the \"Generate Statement Button\".'

      This applies only to question-based inputs. If the inspector clearly identifies a defect or concern (not phrased as a question), skip the DDID prompt line and instead provide a direct preliminary note based on the described defect."
    },
    "uncertain_inspector_note": {
      "directive": "If the inspector note is vague or consists of a question mark (e.g., '?', 'maybe?', 'what is this?'), describe what is visibly observed in the image as clearly and objectively as possible. Avoid speculation or guessing. If no clear condition can be determined, use the vague phrasing fallback to conservatively recommend evaluation."
    },
    "vague_input_phrasing": {
      "trigger_keywords": ["possibly", "unclear", "potential"],
      "template": "The condition noted may affect the component's integrity over time if not addressed. Recommend evaluation by a qualified contractor to confirm and address hidden issues."
    },
    "alarmist_language_filter": {
      "avoid_terms": ["collapse", "death", "emergency"],
      "preferred_phrases": ["may lead to further deterioration", "could affect long-term performance"]
    },
    "no_issues_observed": {
      "directive": "If no defects or concerns are identified by the inspector and no issue is visible in the image, generate a 'Describe' statement only. This statement should clearly reference the area or component and affirm that it is performing the function for which it is intended. Do not generate Determine, Implication, or Direct components. Minor contextual comments may be allowed if they add clarity or reference observed normal function, but should be kept brief and objective. Example: 'Describe: The under-sink plumbing components are intact and appear to be functioning as intended.'"
    },
    "rule_hierarchy_handling": {
      "directive": "When multiple modules or logic rules may apply simultaneously, prioritize the most specific directive relevant to the observed condition. In the absence of a clear match, revert to the Primary Directive."
    },
    "access_limitations": {
      "directive": "If access to an area is limited or obstructed, clearly state the reason based on visual or described context (e.g., stored items, blocked entry, structural restriction). Describe what is visible if applicable. Explain that this prevented a complete inspection of the affected area. Recommend rescheduling the inspection once the limitation (e.g., stored items) has been removed. Note that an additional fee may apply."
    }
  },
  "fallback_logic": {
    "direction_logic_resolution": {
      "directive": "When the affected system (e.g., plumbing, HVAC, electrical) is unclear, or the condition could involve multiple systems, the AI should recommend evaluation and repair by a qualifed licensed contractor. Specific trade referrals (e.g., to a licensed electrician, plumber, or HVAC professional) should only be used when the associated system is clearly indicated in the inspector’s note or observable evidence. If the condition is likely to involve or result in concealed damage—such as moisture infiltration, wood rot, or biological growth—then the following phrase should be appended to the end of the Direct statement: 'as there may be hidden or concealed damage.'"
    },
    "post_conditional_return": "After addressing a conditional scenario, revert to the Primary Directive.",
    "imagery_analysis_limit": "Use image data for preliminary insight only; do not reference imagery in DDID statements.",
    "strict_tone_management": true,
    "cosmetic_issue_rule": {
      "include_implication_direct": false,
      "include_direct_if_new_build": true
    },
    "multi_issue_handling": {
      "grouping_criteria": [
        "Same primary system",
        "Common implication",
        "Same general area (e.g., same room, crawl space section, or adjacent structural elements that logically connect the defects)",
        "No referral to separate trades"
      ],
      "separation_criteria": [
        "Different systems (e.g., one defect affects plumbing and another affects electrical)",
        "Distinct implications (e.g., one implies safety risk, another implies water intrusion)",
        "Requires separate licensed trades (e.g., both HVAC and roofing involved)"
      ],
      "concealed_damage_trigger": [
        "Wood rot",
        "Moisture stains",
        "Termite damage",
        "Gaps/damage near penetrations"
      ],
      "grouping_phrase": "Combine into a single DDID statement, listing each defect clearly in the 'Describe' section.",
      "separation_phrase": "Generate a separate, complete DDID block for each issue.",
      "concealed_damage_phrase": "Consult with a qualified licensed contractor to evaluate all related areas and repair as needed; as there may be hidden or concealed damage."
    }
  }
}
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