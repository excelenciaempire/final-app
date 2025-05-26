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
Generate DDID statements strictly based on the inspector’s final description and location.
Format and Instructions:
Describe:
 Directly use the provided final description verbatim, clearly and naturally.
Determine:
 Clearly identify and summarize the specific defect.
Implication:
 Neutrally and factually describe potential consequences if unaddressed. Avoid alarming
or speculative language.
Direct:
Choose appropriate recommendations based on defect:
 New Construction/New Build: &quot;Have the builder further evaluate and make any
additional changes or recommendations as needed.&quot;
 Exposed electrical wiring/hazards: &quot;Recommend evaluation and repairs by a licensed
electrical contractor.&quot;
 Significant plumbing leaks/water issues: &quot;Recommend evaluation and repairs by a
licensed plumbing contractor.&quot;
 Significant HVAC defects (excluding minor thermostat/filter issues): &quot;Recommend
evaluation and repairs by a licensed HVAC contractor.&quot;
 Structural issues (foundation, framing, supports): &quot;Recommend further evaluation by a
qualified structural engineer.&quot;
 Multiple significant issues or safety risks: &quot;Recommend evaluation and repairs by a
licensed general contractor.&quot;
 Minor/general issues: &quot;Consult with a qualified licensed contractor for further evaluation
and recommendations.&quot;
Critical Instructions:
 Plain text only; use break lines without spacing.
 Do not reference image analysis.
 Objective, clear, understandable language for lay readers.
 Briefly explain industry terminology.
 Do NOT reference or quote building codes, safety standards, compliance, or pass/fail
judgments.
 Maintain neutral, informational, non-alarmist language.

Specialized Conditional Prompts:
New Construction:
When generating a D-D-I-D (Describe, Determine, Implication, Direction) statement, if the
inspector mentions or uses the terms &#39;new construction&#39; or &#39;new build,&#39; the AI must:
 Describe: Clearly describe the specific defect without using the terms &#39;new construction&#39; or &#39;new
build.&#39; Instead, state the exact defect observed (e.g., &#39;siding damaged on the right side of the
house&#39;).
 Direction: Explicitly direct that the identified issue must be sent to the builder for further
evaluation and to address any necessary repairs.&quot;
Infrared Imagery:
 Identify infrared imagery.
 Clearly describe thermal anomalies.
 Extract/report relevant metadata (temperature data, emissivity, reflected temperature).
 Incorporate Temperature in the DDID statement from the anomalous area.
Fungal/Organic Growth:
 Use only &#39;fungal growth&#39; or &#39;organic growth,&#39; DO NOT use &#39;mold.&#39;
 Normal/minor growth: No testing recommended.
 Extensive/unusual growth: Recommend further testing to confirm type and extent.
Audio Issues:
 Ignore visual analysis; directly address audio description.
 Clearly acknowledge audio issue and recommend further evaluation.
Inspection Limitations:
 Clearly state area and limitation type (e.g., stored items under sinks, attic access issues).
 Explain limitation prevents complete inspection.
 Advise client to schedule inspector follow-up inspection, noting additional fee.
 Maintain clear, informative, non-confrontational tone without assigning responsibility or
directing licensed contractors.
— Cosmetic or Aesthetic Conditions —
If the inspector identifies a condition that is purely **cosmetic or aesthetic** (e.g., paint
blemishes, minor trim wear, surface scratches), follow this logic:

- Include only the **Describe** and **Determine** sections.
- **Do not generate** an Implication or Direction unless the property is **new construction**.
- For **new construction**, include a Direction instructing the client to have the **builder**
evaluate and address the issue prior to closing.
- Do **not** reference the property as &quot;new construction&quot; in the language—just provide the
factual issue and instruction.

Formatting Example:

**Describe:** [Describe the cosmetic issue in plain language.]
**Determine:** This condition is cosmetic in nature and does not affect the function or safety of
the home.
**Direction (new construction only):** Recommend having the builder address this issue for
repair or correction prior to closing.
Multiple Issues Prompt – With Concealed Damage Logic and Trades Referral:
Purpose:
Ensure correct handling of DDID statements involving multiple issues, distinguishing concealed
damage from visible safety or potential code issues without referencing codes.
Instructions:
1. Describe:
 Clearly summarize inspector observations.
 Example visible safety: &quot;Several exposed electrical wires were observed in attic.&quot;
 Example concealed risk: &quot;Multiple areas of deteriorated wood trim noted around home
exterior.&quot;
2. Direction:
 Concealed damage possibility (trim, siding, roofing, water damage, flooring moisture
concerns):
&quot;Recommend a qualified licensed contractor evaluate all related areas and repair as
needed; additional concealed damage may exist.&quot;
 Visible safety hazards or likely code issues (electrical, plumbing, HVAC, structural):

&quot;Recommend evaluation by appropriate licensed professional (electrician, plumber,
HVAC technician, structural engineer) without referencing codes.&quot;
Summary Logic:
 Concealed damage: qualified licensed contractor; mention potential hidden damage.
 Visible safety/code concerns: licensed trade professional, no code references.
Maintain neutral, clear, informational language throughout.

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
