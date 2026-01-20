const { OpenAI } = require('openai');
const pool = require('../db'); // Import the database pool
const { searchKnowledgeBase } = require('../utils/knowledgeUtils');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// SPEED OPTIMIZATION CONFIG
// ============================================
// GPT-4o-mini is the FASTEST vision-capable model available
// - 15x faster than GPT-4 Turbo
// - Cost-effective at $0.15/1M input tokens
// - Supports image analysis with 'low' detail for speed
const OPENAI_CONFIG = {
  model: 'gpt-4o-mini',  // Fastest vision model
  maxTokens: 300,         // Reduced for faster response (typical statement is ~200 tokens)
  temperature: 0.5,       // Lower = faster, more consistent
  imageDetail: 'low',     // Low detail = faster image processing (~85 tokens vs 765+ for high)
};

// Prompt cache to avoid DB lookups
let cachedPrompt = null;
let promptCacheTime = 0;
const PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get SOP text context for a given state and organization
 * 
 * This function fetches the Standards of Practice (SOP) documents that apply
 * to the user's current inspection context. It retrieves:
 * 1. State-level SOP (e.g., North Carolina regulations) - manually assigned
 * 2. Default SOP (e.g., InterNACHI) - applies to all states unless excluded
 * 3. Organization-level SOP (e.g., ASHI standards) - based on user's organization
 * 
 * If no SOP is found, returns empty string (doesn't break the process)
 */
async function getSopContext(state, organization) {
  let sopTexts = [];
  let loadedDocumentIds = new Set(); // Track loaded document IDs to avoid duplicates
  
  try {
    // Step A: Get STATE SOP text (manually assigned - highest priority)
    console.log(`[SOP Context] Fetching State SOP for: ${state}`);
    const stateResult = await pool.query(`
      SELECT sd.id, sd.document_name, sd.extracted_text
      FROM sop_assignments sa
      JOIN sop_documents sd ON sa.sop_document_id = sd.id
      WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
      AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
    `, [state]);
    
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      const stateDoc = stateResult.rows[0];
      loadedDocumentIds.add(stateDoc.id);
      sopTexts.push({
        type: 'STATE',
        name: stateDoc.document_name,
        text: stateDoc.extracted_text.substring(0, 15000), // Limit to 15k chars per SOP
        priority: 1 // Highest priority
      });
      console.log(`[SOP Context] State SOP loaded: ${stateDoc.document_name} (${stateDoc.extracted_text.length} chars)`);
    } else {
      console.log(`[SOP Context] No State SOP found for: ${state}`);
    }
    
    // Step B: Get DEFAULT SOP (applies to all states unless excluded)
    console.log(`[SOP Context] Checking Default SOP for: ${state}`);
    const defaultResult = await pool.query(`
      SELECT sd.id, sd.document_name, sd.extracted_text, dss.excluded_states
      FROM default_sop_settings dss
      JOIN sop_documents sd ON dss.default_document_id = sd.id
      WHERE dss.default_document_id IS NOT NULL
      AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
      LIMIT 1
    `);
    
    if (defaultResult.rows.length > 0) {
      const defaultDoc = defaultResult.rows[0];
      const excludedStates = defaultDoc.excluded_states || [];
      
      // Add default SOP if state is not excluded and not already loaded
      if (!excludedStates.includes(state) && !loadedDocumentIds.has(defaultDoc.id)) {
        loadedDocumentIds.add(defaultDoc.id);
        sopTexts.push({
          type: 'DEFAULT',
          name: defaultDoc.document_name,
          text: defaultDoc.extracted_text.substring(0, 15000),
          priority: 2 // Secondary priority - after state, before org
        });
        console.log(`[SOP Context] Default SOP loaded: ${defaultDoc.document_name} (${defaultDoc.extracted_text.length} chars)`);
      } else if (excludedStates.includes(state)) {
        console.log(`[SOP Context] State ${state} is excluded from default SOP`);
      } else {
        console.log(`[SOP Context] Default SOP already loaded via state assignment`);
      }
    } else {
      console.log(`[SOP Context] No Default SOP configured`);
    }
    
    // Step C: Get ORGANIZATION SOP text (tertiary authority)
    if (organization && organization !== 'None' && organization !== '') {
      console.log(`[SOP Context] Fetching Organization SOP for: ${organization}`);
      const orgResult = await pool.query(`
        SELECT sd.id, sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
      `, [organization]);
      
      if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
        const orgDoc = orgResult.rows[0];
        // Only add if not already loaded
        if (!loadedDocumentIds.has(orgDoc.id)) {
          loadedDocumentIds.add(orgDoc.id);
          sopTexts.push({
            type: 'ORGANIZATION',
            name: orgDoc.document_name,
            text: orgDoc.extracted_text.substring(0, 15000),
            priority: 3 // Tertiary priority
          });
          console.log(`[SOP Context] Organization SOP loaded: ${orgDoc.document_name} (${orgDoc.extracted_text.length} chars)`);
        } else {
          console.log(`[SOP Context] Organization SOP already loaded via another assignment`);
        }
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
  
  console.log(`[SOP Context] Total SOPs loaded: ${sopTexts.length}`);
  
  // Sort by priority (State first, then Default, then Organization) and format
  sopTexts.sort((a, b) => a.priority - b.priority);
  
  return sopTexts.map(sop => {
    let priorityNote = '';
    if (sop.type === 'STATE') {
      priorityNote = 'PRIMARY - Takes precedence in conflicts';
    } else if (sop.type === 'DEFAULT') {
      priorityNote = 'DEFAULT - Applies to all states';
    } else {
      priorityNote = 'SUPPLEMENTARY - Additional reference';
    }
    return `=== ${sop.type} STANDARDS: ${sop.name} ===\n(Priority: ${priorityNote})\n\n${sop.text}`;
  }).join('\n\n---\n\n');
}

/**
 * OPTIMIZED DDID Controller
 * Uses same speed optimizations as generateStatementDirect
 */
const generateDdidController = async (req, res) => {
  const startTime = Date.now();
  const { imageBase64, description, userState } = req.body;
  const clerkId = req.auth?.userId;

  if (!description || !userState || !imageBase64) {
    return res.status(400).json({ message: 'Missing required fields (image, description, userState).' });
  }

  console.log(`[⚡ Fast DDID] Request - State: ${userState}`);

  try {
    // Parallel fetch: subscription + prompt + knowledge
    const [subscriptionData, promptData, knowledge] = await Promise.all([
      clerkId ? pool.query(
        'SELECT plan_type, statements_used, statements_limit, last_reset_date FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      ) : Promise.resolve({ rows: [] }),
      
      // Use cached prompt if available
      getCachedPrompt(),
      
      // Knowledge base search (with timeout)
      Promise.race([
        searchKnowledgeBase(description),
        new Promise(resolve => setTimeout(() => resolve(''), 2000)) // 2s timeout
      ]).catch(() => '')
    ]);

    console.log(`[⚡ Fast DDID] Parallel fetch completed in ${Date.now() - startTime}ms`);

    // Check subscription limits
    if (clerkId && subscriptionData.rows.length > 0) {
      const subscription = subscriptionData.rows[0];

      if (subscription.plan_type === 'free') {
        const now = new Date();
        const lastReset = new Date(subscription.last_reset_date);
        const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

        if (daysSinceReset >= 30) {
          pool.query(
            'UPDATE user_subscriptions SET statements_used = 0, last_reset_date = NOW() WHERE clerk_id = $1',
            [clerkId]
          ).catch(() => {});
          subscription.statements_used = 0;
        }

        if (subscription.statements_used >= subscription.statements_limit) {
          return res.status(403).json({
            message: 'Free plan limit reached. Please upgrade to Pro for unlimited statements.',
            statements_used: subscription.statements_used,
            statements_limit: subscription.statements_limit
          });
        }
      }
    }

    // Build optimized prompt
    const prompt = `${knowledge ? `Context: ${knowledge.substring(0, 500)}\n` : ''}${promptData ? promptData.substring(0, 1500) : 'Generate DDID statement.'}
State: ${userState}
Description: ${description}
Generate now.`;

    console.log(`[⚡ Fast DDID] Calling OpenAI ${OPENAI_CONFIG.model}...`);
    const apiStart = Date.now();

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: OPENAI_CONFIG.imageDetail
              },
            },
          ],
        },
      ],
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: OPENAI_CONFIG.temperature,
    });

    const apiTime = Date.now() - apiStart;
    let ddid = response.choices[0].message.content?.trim() || 'Error generating statement.';
    ddid = ddid.replace(/\*\*/g, '');

    const totalTime = Date.now() - startTime;
    console.log(`[⚡ Fast DDID] Complete in ${totalTime}ms (API: ${apiTime}ms)`);

    // Send response first
    res.json({ ddid, processingTime: totalTime });

    // Non-blocking usage increment
    if (clerkId) {
      pool.query(
        `UPDATE user_subscriptions 
         SET statements_used = statements_used + 1, updated_at = NOW() 
         WHERE clerk_id = $1 AND plan_type = 'free'`,
        [clerkId]
      ).catch(() => {});
    }

  } catch (error) {
    console.error('[⚡ Fast DDID] Error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate statement.';
    return res.status(500).json({ message: errorMessage });
  }
};

/**
 * Get cached DDID prompt (avoids DB lookup on every request)
 */
async function getCachedPrompt() {
  const now = Date.now();
  
  // Return cached prompt if still valid
  if (cachedPrompt && (now - promptCacheTime) < PROMPT_CACHE_TTL) {
    return cachedPrompt;
  }
  
  try {
    const result = await pool.query(
      "SELECT prompt_content FROM prompts WHERE prompt_name = 'ddid_prompt'"
    );
    
    if (result.rows.length > 0) {
      cachedPrompt = result.rows[0].prompt_content;
      promptCacheTime = now;
      return cachedPrompt;
    }
  } catch (error) {
    console.warn('[Prompt Cache] Error:', error.message);
  }
  
  return '';
}

/**
 * ULTRA-FAST Direct Statement Generation
 * 
 * SPEED OPTIMIZATIONS:
 * 1. Parallel database queries (subscription + SOP fetched simultaneously)
 * 2. Cached DDID prompt (avoids DB lookup on every request)
 * 3. GPT-4o-mini with low image detail (fastest vision model)
 * 4. Minimal prompt tokens (reduces processing time)
 * 5. Reduced max_tokens (faster completion)
 * 6. Non-blocking usage increment (runs after response sent)
 * 
 * Target: < 3 seconds for complete statement generation
 */
const generateStatementDirect = async (req, res) => {
  const startTime = Date.now();
  const { imageBase64, notes, userState, organization } = req.body;
  const clerkId = req.auth?.userId;

  if (!imageBase64 || !userState) {
    return res.status(400).json({ message: 'Missing required fields (image, userState).' });
  }

  console.log(`[⚡ Fast Generate] Request - State: ${userState}, Org: ${organization || 'None'}`);

  try {
    // ============================================
    // PARALLEL DATA FETCHING (Speed Optimization #1)
    // ============================================
    // Fetch ALL 5 sources in parallel: Subscription, SOP, Knowledge, DDID Prompt
    const [subscriptionData, sopContext, knowledge, ddidPrompt] = await Promise.all([
      // 1. Subscription check
      clerkId ? pool.query(
        'SELECT plan_type, statements_used, statements_limit, last_reset_date FROM user_subscriptions WHERE clerk_id = $1',
        [clerkId]
      ) : Promise.resolve({ rows: [] }),
      
      // 2. SOP context (State + Organization) - 5000 chars each
      getSopContextFast(userState, organization),
      
      // 3. Knowledge Base search (with 2s timeout for speed)
      Promise.race([
        searchKnowledgeBase(notes || userState),
        new Promise(resolve => setTimeout(() => resolve(''), 2000))
      ]).catch(() => ''),
      
      // 4. DDID Prompt from database (cached for 5 min)
      getCachedPrompt()
    ]);

    console.log(`[⚡ Fast Generate] Parallel fetch completed in ${Date.now() - startTime}ms (SOP: ${sopContext?.length || 0} chars, KB: ${knowledge?.length || 0} chars)`);

    // Check subscription limits
    if (clerkId && subscriptionData.rows.length > 0) {
      const subscription = subscriptionData.rows[0];

      if (subscription.plan_type === 'free') {
        const now = new Date();
        const lastReset = new Date(subscription.last_reset_date);
        const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

        if (daysSinceReset >= 30) {
          // Reset usage counter (don't await - fire and forget)
          pool.query(
            'UPDATE user_subscriptions SET statements_used = 0, last_reset_date = NOW() WHERE clerk_id = $1',
            [clerkId]
          ).catch(err => console.warn('[Fast Generate] Reset error:', err.message));
          subscription.statements_used = 0;
        }

        if (subscription.statements_used >= subscription.statements_limit) {
          return res.status(403).json({
            message: 'Free plan limit reached. Please upgrade to Pro for unlimited statements.',
            statements_used: subscription.statements_used,
            statements_limit: subscription.statements_limit
          });
        }
      }
    }

    // ============================================
    // UNIFIED PROMPT WITH ALL 5 SOURCES
    // ============================================
    // Sources: 1) State SOP, 2) Org SOP, 3) Knowledge Base, 4) DDID Prompt, 5) Image+Notes
    const hasSop = sopContext && sopContext.length > 0;
    const hasKnowledge = knowledge && knowledge.length > 0;
    const basePrompt = ddidPrompt || 'You are a professional home inspector. Generate a DDID statement (Describe, Determine, Implication, Direction) for the inspection finding shown in the image.';
    
    const prompt = `${basePrompt}

=== INSPECTION CONTEXT ===
State: ${userState}${organization && organization !== 'None' ? `\nOrganization: ${organization}` : ''}${notes ? `\nInspector Notes: ${notes.substring(0, 300)}` : ''}

${hasSop ? `=== STANDARDS OF PRACTICE ===\n${sopContext}\n` : ''}${hasKnowledge ? `=== KNOWLEDGE BASE ===\n${knowledge.substring(0, 1500)}\n` : ''}
Write ONE professional paragraph using DDID format: Describe the condition → Determine the issue → Implication if not addressed → Direction/recommendation. 4-6 sentences, technical language, no bullet points.`;

    console.log(`[⚡ Fast Generate] Calling OpenAI ${OPENAI_CONFIG.model}...`);
    const apiStart = Date.now();

    // ============================================
    // FAST API CALL (Speed Optimization #3)
    // ============================================
    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: OPENAI_CONFIG.imageDetail  // 'low' = ~85 tokens, fastest
              },
            },
          ],
        },
      ],
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: OPENAI_CONFIG.temperature,
    });

    const apiTime = Date.now() - apiStart;
    console.log(`[⚡ Fast Generate] OpenAI responded in ${apiTime}ms`);

    let statement = response.choices[0].message.content?.trim() || 'Error generating statement.';
    
    // Quick cleanup
    statement = statement.replace(/\*\*/g, '').replace(/^\s*[-•]\s*/gm, '').trim();

    // ============================================
    // NON-BLOCKING USAGE INCREMENT (Speed Optimization #4)
    // ============================================
    // Send response FIRST, then update usage counter
    const totalTime = Date.now() - startTime;
    console.log(`[⚡ Fast Generate] Total time: ${totalTime}ms (API: ${apiTime}ms)`);

    // Send response immediately
    res.json({ 
      statement,
      sopUsed: hasSop,
      state: userState,
      organization: organization || null,
      processingTime: totalTime
    });

    // Update usage counter AFTER response (non-blocking)
    if (clerkId) {
      pool.query(
        `UPDATE user_subscriptions 
         SET statements_used = statements_used + 1, updated_at = NOW() 
         WHERE clerk_id = $1 AND plan_type = 'free'`,
        [clerkId]
      ).catch(err => console.warn('[Fast Generate] Usage update error:', err.message));
    }

  } catch (error) {
    console.error('[⚡ Fast Generate] Error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate statement.';
    return res.status(500).json({ message: errorMessage });
  }
};

/**
 * FAST SOP Context Fetcher
 * - Fetches both State and Organization SOP in parallel
 * - Limited to 5000 chars each for balance of context vs speed
 */
async function getSopContextFast(state, organization) {
  try {
    const sopParts = [];
    
    // Fetch State and Organization SOP in parallel
    const [stateResult, orgResult] = await Promise.all([
      // State SOP (primary authority)
      pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'state' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
        LIMIT 1
      `, [state]),
      
      // Organization SOP (secondary authority)
      organization && organization !== 'None' ? pool.query(`
        SELECT sd.document_name, sd.extracted_text
        FROM sop_assignments sa
        JOIN sop_documents sd ON sa.sop_document_id = sd.id
        WHERE sa.assignment_type = 'organization' AND sa.assignment_value = $1
        AND sd.extracted_text IS NOT NULL AND sd.extracted_text != ''
        LIMIT 1
      `, [organization]) : Promise.resolve({ rows: [] })
    ]);
    
    // Add State SOP (5000 chars max)
    if (stateResult.rows.length > 0 && stateResult.rows[0].extracted_text) {
      sopParts.push(`[STATE: ${state}]\n${stateResult.rows[0].extracted_text.substring(0, 5000)}`);
    }
    
    // Add Organization SOP (5000 chars max)
    if (orgResult.rows.length > 0 && orgResult.rows[0].extracted_text) {
      sopParts.push(`[ORG: ${organization}]\n${orgResult.rows[0].extracted_text.substring(0, 5000)}`);
    }
    
    return sopParts.join('\n\n');
  } catch (error) {
    console.warn('[Fast SOP] Error:', error.message);
    return '';
  }
}

module.exports = { 
  generateDdid: generateDdidController,
  generateStatementDirect
};
