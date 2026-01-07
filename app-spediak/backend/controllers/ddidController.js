const { OpenAI } = require('openai');
const pool = require('../db'); // Import the database pool
const { searchKnowledgeBase } = require('../utils/knowledgeUtils');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get SOP text context for a given state and organization
 */
async function getSopContext(state, organization) {
  let sopTexts = [];
  
  try {
    // Get state SOP text
    const stateResult = await pool.query(`
      SELECT sd.document_name, sd.extracted_text
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
      AND sd.extracted_text IS NOT NULL
    `, [state]);
    
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      sopTexts.push({
        type: 'State',
        name: stateResult.rows[0].document_name,
        text: stateResult.rows[0].extracted_text.substring(0, 15000) // Limit to 15k chars per SOP
      });
    }
    
    // Get organization SOP text if provided
    if (organization && organization !== 'None') {
      const orgResult = await pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL
      `, [organization]);
      
      if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
        sopTexts.push({
          type: 'Organization',
          name: orgResult.rows[0].document_name,
          text: orgResult.rows[0].extracted_text.substring(0, 15000)
        });
      }
    }
  } catch (error) {
    console.error('[DDID] Error fetching SOP context:', error);
  }
  
  if (sopTexts.length === 0) return '';
  
  return sopTexts.map(sop => 
    `=== ${sop.type} SOP: ${sop.name} ===\n${sop.text}`
  ).join('\n\n');
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
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 600,
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
 * Direct Statement Generation - Combines pre-description and DDID into single call
 * This is the streamlined flow that skips the intermediate pre-description review step
 */
const generateStatementDirect = async (req, res) => {
  const { imageBase64, notes, userState, organization } = req.body;
  const clerkId = req.auth?.userId;

  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

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

    // Fetch the DDID prompt from the database
    const promptResult = await pool.query("SELECT prompt_content FROM prompts WHERE prompt_name = 'ddid_prompt'");
    if (promptResult.rows.length === 0) {
      return res.status(500).json({ message: 'DDID prompt not found in the database.' });
    }
    const ddid_prompt_template = promptResult.rows[0].prompt_content;

    // Get knowledge base context
    const knowledge = await searchKnowledgeBase(notes || '');
    
    // Get SOP context based on user's state and organization
    const sopContext = await getSopContext(userState, organization);

    // Build comprehensive prompt
    const prompt = `
${sopContext ? `Relevant Standards of Practice (SOP) Documentation:\n${sopContext}\n---\n` : ''}
${knowledge ? `Relevant Knowledge Base Info:\n${knowledge}\n---\n` : ''}
${ddid_prompt_template}

Inspector Data:
- Location (State): ${userState}
${organization && organization !== 'None' ? `- Organization: ${organization}` : ''}
- Inspector Notes: ${notes || 'None provided'}
- Image: <attached>

IMPORTANT: Generate a professional DDID statement based on the image and notes provided. 
The statement should be compliant with ${userState} state regulations${organization && organization !== 'None' ? ` and ${organization} standards` : ''}.
Analyze the image thoroughly before generating the statement.

Generate the DDID statement now.
`;

    console.log('[Generate Statement] Processing request for state:', userState);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 800,
    });

    let statement = response.choices[0].message.content?.trim() || 'Error generating statement.';
    statement = statement.replace(/\*\*/g, '');

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

    console.log("[Generate Statement] Generated:", statement.substring(0, 100) + '...');
    
    return res.json({ 
      statement,
      sopUsed: sopContext ? true : false,
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
