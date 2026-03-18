const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const { searchKnowledgeBase } = require('../utils/knowledgeUtils');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fetch extracted SOP text for the user's state and organizations
async function getSopContext(state, organizations) {
  try {
    const orgList = Array.isArray(organizations)
      ? organizations.filter(o => o && o !== 'None')
      : [];

    const [stateResult, ...orgResults] = await Promise.all([
      pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
        LIMIT 1
      `, [state]),
      ...orgList.map(org => pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
        LIMIT 1
      `, [org]))
    ]);

    const parts = [];
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      parts.push(`[STATE: ${state}]\n${stateResult.rows[0].extracted_text.substring(0, 3000)}`);
    }
    orgResults.forEach((result, i) => {
      if (result.rows.length > 0 && result.rows[0].extracted_text) {
        parts.push(`[ORG: ${orgList[i]}]\n${result.rows[0].extracted_text.substring(0, 2000)}`);
      }
    });
    return parts.join('\n\n');
  } catch (err) {
    console.warn('[PreDesc SOP] Error fetching SOP context:', err.message);
    return '';
  }
}

const generatePreDescriptionController = async (req, res) => {
  const { imageBase64, description, userState, organizations } = req.body;

  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  try {
    // Fetch prompt, knowledge base, and SOP context in parallel
    const [promptResult, knowledge, sopContext] = await Promise.all([
      pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'preliminary_description_prompt'"),
      searchKnowledgeBase(description),
      getSopContext(userState, organizations || []),
    ]);

    if (promptResult.rows.length === 0) {
      return res.status(500).json({ message: 'Preliminary description prompt not found in the database.' });
    }
    const preliminary_description_prompt = promptResult.rows[0].prompt_content;

    const prompt = `${preliminary_description_prompt}

=== INSPECTOR DATA ===
- Location (State): ${userState}${organizations && organizations.length > 0 ? `\n- Organizations: ${organizations.join(', ')}` : ''}
- Initial Notes: ${description || 'None provided'}

${sopContext ? `=== STANDARDS OF PRACTICE ===\n${sopContext}\n` : ''}${knowledge ? `=== KNOWLEDGE BASE ===\n${knowledge}\n` : ''}
Analyze the attached image and the inspector notes above. Generate the preliminary description now.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });

    const preDescription = response.content[0].text?.trim() || 'Could not generate preliminary description.';
    console.log('[PreDescription] Generated:', preDescription);
    return res.json({ preDescription });

  } catch (error) {
    console.error('Claude Error (PreDescription):', error);
    const errorMessage = error.message || 'An unknown error occurred while generating the preliminary description.';
    return res.status(500).json({ message: `Failed to generate preliminary description: ${errorMessage}` });
  }
};

module.exports = { generatePreDescription: generatePreDescriptionController };
