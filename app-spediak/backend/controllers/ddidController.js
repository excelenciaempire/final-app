const { OpenAI } = require('openai');
const pool = require('../db'); // Import the database pool
const { searchKnowledgeBase } = require('../utils/knowledgeUtils');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get SOP text context for a given state and organization
 * 
 * This function fetches the Standards of Practice (SOP) documents that apply
 * to the user's current inspection context. It retrieves:
 * 1. State-level SOP (e.g., North Carolina regulations)
 * 2. Organization-level SOP (e.g., ASHI or InterNACHI standards)
 * 
 * If no SOP is found, returns empty string (doesn't break the process)
 */
async function getSopContext(state, organization) {
  let sopTexts = [];
  
  try {
    // Step A: Get STATE SOP text (primary authority)
    console.log(`[SOP Context] Fetching State SOP for: ${state}`);
    const stateResult = await pool.query(`
      SELECT sd.document_name, sd.extracted_text
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.sop_document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
      AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
    `, [state]);
    
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      const stateText = stateResult.rows[0].extracted_text;
      sopTexts.push({
        type: 'STATE',
        name: stateResult.rows[0].document_name,
        text: stateText.substring(0, 15000), // Limit to 15k chars per SOP
        priority: 1 // Highest priority
      });
      console.log(`[SOP Context] State SOP loaded: ${stateResult.rows[0].document_name} (${stateText.length} chars)`);
    } else {
      console.log(`[SOP Context] No State SOP found for: ${state}`);
    }
    
    // Step B: Get ORGANIZATION SOP text (secondary authority)
    if (organization && organization !== 'None' && organization !== '') {
      console.log(`[SOP Context] Fetching Organization SOP for: ${organization}`);
      const orgResult = await pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
      `, [organization]);
      
      if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
        const orgText = orgResult.rows[0].extracted_text;
        sopTexts.push({
          type: 'ORGANIZATION',
          name: orgResult.rows[0].document_name,
          text: orgText.substring(0, 15000),
          priority: 2 // Secondary priority
        });
        console.log(`[SOP Context] Organization SOP loaded: ${orgResult.rows[0].document_name} (${orgText.length} chars)`);
      } else {
        console.log(`[SOP Context] No Organization SOP found for: ${organization}`);
      }
    }
  } catch (error) {
    // Don't break the process if SOP fetch fails - just log and continue
    console.error('[SOP Context] Error fetching SOP context:', error.message);
    return '';
  }
  
  // Return empty string if no SOPs found (process continues with generic mode)
  if (sopTexts.length === 0) {
    console.log('[SOP Context] No SOPs loaded - using generic mode');
    return '';
  }
  
  // Sort by priority (State first, then Organization) and format
  sopTexts.sort((a, b) => a.priority - b.priority);
  
  return sopTexts.map(sop => 
    `=== ${sop.type} STANDARDS: ${sop.name} ===\n(Priority: ${sop.type === 'STATE' ? 'PRIMARY - Takes precedence in conflicts' : 'SECONDARY - Defer to State if conflict'})\n\n${sop.text}`
  ).join('\n\n---\n\n');
}

const generateDdidController = async (req, res) => {
  const { imageBase64, description, userState } = req.body;
  const clerkId = req.auth?.userId; // Get clerk ID from auth middleware

  if (!description || !userState || !imageBase64) {
    return res.status(400).json({ message: 'Missing required fields (image, description, userState).' });
  }

  try {
    // Check subscription limits BEFORE generating DDID
    if (clerkId) {
      const subscriptionResult = await pool.query(
        'SELECT plan_type, statements_used, statements_limit, last_reset_date FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      );

      if (subscriptionResult.rows.length > 0) {
        const subscription = subscriptionResult.rows[0];

        // Check if free tier and needs reset (30 days)
        if (subscription.plan_type === 'free') {
          const now = new Date();
          const lastReset = new Date(subscription.last_reset_date);
          const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

          if (daysSinceReset >= 30) {
            // Reset usage counter
            await pool.query(
              'UPDATE user_subscriptions SET statements_used = 0, last_reset_date = NOW() WHERE clerk_id = $1',
              [clerkId]
            );
            subscription.statements_used = 0;
          }

          // Check if at limit
          if (subscription.statements_used >= subscription.statements_limit) {
            return res.status(403).json({
              message: 'Free plan limit reached. Please upgrade to Pro for unlimited statements.',
              statements_used: subscription.statements_used,
              statements_limit: subscription.statements_limit
            });
          }
        }
      }
    }

    // Fetch the live prompt from the database
    const promptResult = await pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'ddid_prompt'");
    if (promptResult.rows.length === 0) {
        return res.status(500).json({ message: 'DDID prompt not found in the database.' });
    }
    const ddid_prompt_template = promptResult.rows[0].prompt_content;
    
    // Search for relevant knowledge using the final description
    const knowledge = await searchKnowledgeBase(description);
    
    const prompt = `
Relevant Knowledge Base Info:
${knowledge || 'None'}
---
${ddid_prompt_template}
Inspector Data:
- Location (State): ${userState}
- Final Description: ${description}

Generate the DDID statement now.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective model with vision
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low' // Use low detail for faster processing
              },
            },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0.3, // Lower temperature for consistent outputs
    });

    let ddid = response.choices[0].message.content?.trim() || 'Error generating statement.';
    ddid = ddid.replace(/\*\*/g, '');

    // Increment usage counter AFTER successful generation (for free tier only)
    if (clerkId) {
      const subscriptionCheck = await pool.query(
        'SELECT plan_type FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      );
      
      if (subscriptionCheck.rows.length > 0 && subscriptionCheck.rows[0].plan_type === 'free') {
        await pool.query(
          'UPDATE user_subscriptions SET statements_used = statements_used + 1, updated_at = NOW() WHERE clerk_id = $1',
          [clerkId]
        );
      }
    }

    console.log("[DDID Final] Generated:", ddid);
    return res.json({ ddid });
  } catch (error) {
    console.error('OpenAI Error (DDID Final):', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred while generating the final statement.';
    return res.status(500).json({ message: `Failed to generate final statement: ${errorMessage}` });
  }
};

/**
 * Direct Statement Generation - Streamlined single-call flow
 * 
 * Flow:
 * 1. Context (already known): User's State and Organization from profile/selector
 * 2. Trigger: User takes photo, adds notes, presses "Analyze Defect"
 * 3. Internal processing:
 *    - Step A: Fetch SOPs for State and Organization from database
 *    - Step B: Apply DDID format (Describe, Determine, Implication, Direction)
 *    - Step C: Establish hierarchy (State rules > Organization rules if conflict)
 * 4. Result: Return single professional paragraph immediately
 */
const generateStatementDirect = async (req, res) => {
  const { imageBase64, notes, userState, organization } = req.body;
  const clerkId = req.auth?.userId;

  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  console.log(`[Generate Statement] Request received - State: ${userState}, Organization: ${organization || 'None'}`);

  try {
    // Check subscription limits BEFORE generating
    if (clerkId) {
      const subscriptionResult = await pool.query(
        'SELECT plan_type, statements_used, statements_limit, last_reset_date FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      );

      if (subscriptionResult.rows.length > 0) {
        const subscription = subscriptionResult.rows[0];

        // Check if free tier and needs reset (30 days)
        if (subscription.plan_type === 'free') {
          const now = new Date();
          const lastReset = new Date(subscription.last_reset_date);
          const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

          if (daysSinceReset >= 30) {
            await pool.query(
              'UPDATE user_subscriptions SET statements_used = 0, last_reset_date = NOW() WHERE clerk_id = $1',
              [clerkId]
            );
            subscription.statements_used = 0;
          }

          // Check if at limit
          if (subscription.statements_used >= subscription.statements_limit) {
            return res.status(403).json({
              message: 'Free plan limit reached. Please upgrade to Pro for unlimited statements.',
              statements_used: subscription.statements_used,
              statements_limit: subscription.statements_limit
            });
          }
        }
      }
    }

    // Fetch the DDID prompt from the database (fallback if not found)
    let ddid_prompt_template = '';
    try {
      const promptResult = await pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'ddid_prompt'");
      if (promptResult.rows.length > 0) {
        ddid_prompt_template = promptResult.rows[0].prompt_content;
      }
    } catch (promptError) {
      console.warn('[Generate Statement] Could not fetch DDID prompt from DB, using built-in format');
    }

    // Get knowledge base context
    let knowledge = '';
    try {
      knowledge = await searchKnowledgeBase(notes || '') || '';
    } catch (kbError) {
      console.warn('[Generate Statement] Knowledge base search failed:', kbError.message);
    }
    
    // Step A: Fetch SOPs for State and Organization
    const sopContext = await getSopContext(userState, organization);
    const hasSopContext = sopContext && sopContext.length > 0;
    
    console.log(`[Generate Statement] SOP Context loaded: ${hasSopContext ? 'Yes' : 'No'}`);

    // Build optimized prompt for faster response
    const prompt = `Home inspection assistant. Write ONE paragraph statement for this inspection image.

State: ${userState}${organization && organization !== 'None' ? ` | Org: ${organization}` : ''}
${notes ? `Notes: ${notes}` : ''}
${hasSopContext ? `Standards: ${sopContext.substring(0, 3000)}` : ''}
${knowledge ? `Context: ${knowledge.substring(0, 1000)}` : ''}

FORMAT (DDID in one paragraph): Describe component → Determine issue → Implication → Direction/recommendation.

RULES: One paragraph, 4-6 sentences, technical, no bullets, no intro phrases. If unclear, describe visible condition and recommend evaluation.`;

    console.log('[Generate Statement] Sending request to OpenAI GPT-4o-mini...');
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective model with vision
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low' // Use low detail for faster processing
              },
            },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0.3, // Lower temperature for consistent outputs
    });

    console.log(`[Generate Statement] OpenAI responded in ${Date.now() - startTime}ms`);

    let statement = response.choices[0].message.content?.trim() || 'Error generating statement.';
    
    // Clean up the response (remove markdown formatting, extra whitespace)
    statement = statement.replace(/\*\*/g, '');
    statement = statement.replace(/^\s*[-•]\s*/gm, ''); // Remove bullet points if any
    statement = statement.trim();

    // Increment usage counter AFTER successful generation (for free tier only)
    if (clerkId) {
      const subscriptionCheck = await pool.query(
        'SELECT plan_type FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      );
      
      if (subscriptionCheck.rows.length > 0 && subscriptionCheck.rows[0].plan_type === 'free') {
        await pool.query(
          'UPDATE user_subscriptions SET statements_used = statements_used + 1, updated_at = NOW() WHERE clerk_id = $1',
          [clerkId]
        );
        console.log(`[Generate Statement] Usage incremented for user ${clerkId}`);
      }
    }

    console.log("[Generate Statement] Successfully generated:", statement.substring(0, 100) + '...');
    
    return res.json({ 
      statement,
      sopUsed: hasSopContext,
      state: userState,
      organization: organization || null
    });

  } catch (error) {
    console.error('OpenAI Error (Generate Statement):', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred while generating the statement.';
    return res.status(500).json({ message: `Failed to generate statement: ${errorMessage}` });
  }
};

module.exports = { 
  generateDdid: generateDdidController,
  generateStatementDirect
};
