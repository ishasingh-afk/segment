// backend/src/specpilotService.ts
// Implements the PRD's 5-layer prompt system: System → Planner → Extractor → Validator → Summarizer

import { openai } from "./aiClient";
import { CanonicalSpec } from "./models/canonicalSpec";

// ============================================================================
// SYSTEM PROMPT (Core Identity + Rules) - From PRD Prompt Pack
// ============================================================================
const SYSTEM_PROMPT = `You are SpecPilot — a CDP intake analysis and requirement-specification agent.

Your job is to convert vague product/analytics/CDP requests into structured, validated, CDP-ready requirement specifications.

Your core responsibilities:
1. Extract events, rules, properties, identity, consent, and destinations from ANY input.
2. Build a canonical CDP spec (the neutral internal representation).
3. Identify missing information or ambiguities.
4. Validate against CDP governance rules.
5. Prepare data for downstream CDP adapters (Segment, Adobe, homegrown).
6. NEVER generate CDP-specific logic in this step — that belongs to adapters.

Strict Output Rules:
- Always produce valid JSON unless explicitly asked otherwise.
- Never hallucinate fields not implied by input.
- If information is missing, call it out in "open_questions".
- NEVER use any Segment, Adobe, or enterprise CDP terminology here.
- The output MUST be CDP-agnostic.

Your Behavior:
- Be concise, deterministic, and factual.
- If something seems inferred, say it explicitly.
- Prefer under-specifying over guessing.
- Follow input tone, but maintain clarity.`;

// ============================================================================
// EXTRACTOR PROMPT - Extracts structured data from intake
// ============================================================================
const EXTRACTOR_PROMPT = `You are the Extractor module for SpecPilot.
Given the input text, extract:
- Event(s) with clear, action-based names (e.g., "Product Added to Cart", "Checkout Completed")
- Event descriptions explaining business purpose
- Triggers (what user action causes this event)
- Properties with proper types (string, number, boolean, array, object)
- Business rules (what must be true for this event)
- Technical rules (validation, format requirements)
- Identity assumptions (how we identify the user)
- Consent implications (privacy considerations)
- Destinations (where data should flow)

CRITICAL - MULTIPLE EVENTS:
- ALWAYS generate ALL relevant events for a complete user journey
- A checkout funnel should have 3-5 events (e.g., Cart Viewed, Checkout Started, Payment Info Entered, Order Completed)
- A signup flow should have 3-4 events (e.g., Signup Started, Email Verified, Profile Completed)
- A purchase flow should include: Product Viewed, Product Added to Cart, Checkout Started, Order Completed
- Think about the COMPLETE user journey and capture all meaningful touchpoints
- Minimum 2 events, typically 3-6 events for any funnel or flow

Extraction Rules:
- Do NOT guess property values that do not appear or logically follow.
- Use snake_case for all property names.
- Event names should be Title Case with spaces (e.g., "Add to Cart", "Order Completed").
- Infer COMPLETE properties based on event type:
  * Cart/Wishlist events: item_id, product_name, price, quantity, category, timestamp
  * Purchase events: order_id, total, currency, items, payment_method, timestamp
  * Subscription events: subscription_id, plan_name, price, billing_cycle, timestamp
  * User events: user_id, action_type, timestamp
  * Video events: video_id, video_title, duration, watch_time, timestamp
- Always include user_id or anonymous_id in identity.primary
- Always include timestamp for events

IDENTITY RULES - ALWAYS POPULATE:
- identity.primary: ALWAYS set to "user_id" unless another identifier is explicitly mentioned
- identity.secondary: Include related identifiers like ["email", "device_id", "session_id"]
- identity.stitching_assumptions: Describe how identities connect (e.g., "User ID links to account, email used for marketing")

PII CLASSIFICATION - Mark ALL fields:
- high: email, phone, name, address, ssn, credit_card
- medium: ip_address, location, device_id
- low: user_id, session_id, anonymous_id
- none: product_id, order_id, timestamp, price, quantity

CONSENT RULES:
- If pii.classification is "high" → consent.required = true, consent.policy_group = "marketing" or "data_processing"
- If pii.classification is "medium" → consent.required = true, consent.policy_group = "analytics"
- If pii.classification is "low" or "none" → consent.required = false

DESTINATIONS - ALWAYS include at least 2:
- Common destinations: Segment, Google Analytics, Amplitude, Mixpanel, Salesforce, HubSpot, Data Warehouse
- Each destination needs: name, requirements array, notes

OPEN QUESTIONS - Generate 2-3 SPECIFIC, ACTIONABLE questions based on the actual intake:
- Ask about specific missing data points relevant to THIS event
- Ask about business logic that wasn't specified
- Ask about integration requirements
- DO NOT ask generic questions like "What are the privacy policies?"
- Questions should be directly tied to gaps in the provided intake

Examples of GOOD questions for "track wishlist additions":
- "Should we capture the product price at the time of addition or defer to a product catalog lookup?"
- "What is the maximum number of items allowed in a wishlist?"
- "Should wishlist additions trigger any downstream notifications or recommendations?"

Examples of BAD (too generic) questions:
- "Are there any specific privacy policies?" 
- "What user identifiers are available?"`;


// ============================================================================
// VALIDATOR PROMPT - Governance checks
// ============================================================================
const VALIDATOR_PROMPT = `You are the validation engine for SpecPilot.
Given the Canonical Spec, validate against governance rules.

CRITICAL RULES:
- ONLY output ACTUAL PROBLEMS found
- DO NOT list things that are correct/passing
- If something follows the rules, DO NOT mention it at all
- Empty arrays mean everything passed for that category

Governance Rules to Check:

1. NAMING RULES:
   - Event names MUST be Title Case with spaces (e.g., "Cart Abandoned", "Order Completed")
   - Property names MUST be snake_case (e.g., "user_id", "product_name", "cart_total")
   - "Cart Abandoned" = CORRECT Title Case ✓
   - "cart_abandoned" = WRONG (should be "Cart Abandoned")
   - "user_id" = CORRECT snake_case ✓
   - "userId" = WRONG (should be "user_id")

2. REQUIRED FIELDS:
   - Every event should have: user identifier, timestamp
   - Cart events should have: item_id or product_id, quantity
   - Purchase events should have: order_id, total, currency

3. IDENTITY:
   - Must have a primary identifier (user_id, anonymous_id, or email)
   - If no primary identity → ERROR

4. PII & CONSENT:
   - Fields like email, phone, name, address = high PII
   - High PII fields MUST have consent.required = true
   - If high PII without consent → ERROR

5. DATA TYPES:
   - Price/cost/total fields must be type "number"
   - ID fields should be type "string"
   - Quantity fields must be type "number"

SCORING:
- Start at 100
- Critical errors (missing identity, PII without consent): -20 each
- Errors (wrong naming format): -10 each  
- Warnings (missing optional fields): -5 each
- Minimum score: 0

OUTPUT FORMAT - Only include categories that have actual issues:
{
  "naming": ["Only list ACTUAL naming problems found"],
  "fields": ["Only list ACTUAL field problems found"],
  "identity": ["Only list ACTUAL identity problems found"],
  "consent": ["Only list ACTUAL consent/PII problems found"],
  "governance": ["Only list OTHER actual problems found"],
  "overall_score": <calculated score>
}

EXAMPLE - If event name is "Cart Abandoned" and properties are "user_id", "product_id":
- These are ALL CORRECT, so naming array should be EMPTY: []
- DO NOT say "Event name 'Cart Abandoned' is in Title Case" - we only report problems!

EXAMPLE - If event name is "cartAbandoned" and property is "userId":
{
  "naming": [
    "Event name 'cartAbandoned' should be Title Case: 'Cart Abandoned'",
    "Property 'userId' should be snake_case: 'user_id'"
  ],
  "fields": [],
  "identity": [],
  "consent": [],
  "governance": [],
  "overall_score": 80
}`;

// ============================================================================
// SUMMARIZER PROMPT - Human-readable markdown output
// ============================================================================
const SUMMARIZER_PROMPT = `You are the summarizer for SpecPilot.
Your job is to turn the Canonical Spec into a professional, readable Markdown requirement specification.

CRITICAL: You MUST use the EXACT data from the canonical spec. Do not omit or change any data.

Target Output: A clean, well-formatted Markdown document suitable for Jira & Slack.

REQUIRED FORMAT (follow exactly):

# {Title}

## Summary
{2-3 sentence description of what this tracking requirement covers}

---

## Events

### {Event Name}
**Trigger:** {When this event fires}

**Description:** {What this event captures}

**Properties**
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| {property_name} | {type} | {true/false} | {description} |
(Include EVERY property from the canonical spec - do not skip any)

**Identity**
| Role | Identifier | Notes |
|------|------------|-------|
| Primary | {identity.primary - e.g., "user_id"} | {identity.stitching_assumptions or "Primary user identifier"} |
| Secondary | {identity.secondary joined - e.g., "email, device_id"} | {Explain secondary identifiers} |

**PII & Consent**
| Field | PII Level | Consent Required |
|-------|-----------|------------------|
| {property_name} | {pii.classification} | {consent.required ? "Yes" : "No"} |
(Include EVERY property that has pii classification - even "none")

---

## Business Rules
- {business_rules[0]}
- {business_rules[1]}
(List ALL business rules from canonical spec)

## Technical Rules
- {technical_rules[0]}
- {technical_rules[1]}
(List ALL technical rules from canonical spec)

---

## Destinations
| Destination | Requirements |
|-------------|--------------|
| {destinations[0].name} | {destinations[0].requirements joined with ", "} |
| {destinations[1].name} | {destinations[1].requirements joined with ", "} |
(Include ALL destinations from canonical spec)

## Acceptance Criteria
- [ ] {acceptance_criteria[0]}
- [ ] {acceptance_criteria[1]}
(Include ALL acceptance criteria from canonical spec)

---

## Open Questions
{List the EXACT open_questions from the canonical spec - do not generate new ones}

---

IMPORTANT RULES:
1. Use the EXACT properties from the canonical spec JSON - count them and include ALL
2. Use the EXACT open_questions from the canonical spec - do not modify or add new ones
3. Identity table MUST have both Primary and Secondary rows with actual data
4. PII & Consent table MUST include ALL properties with their PII levels
5. Destinations table MUST include ALL destinations with their requirements
6. Use proper markdown table syntax with | separators

TONE:
- Direct and clear
- Professional but concise
- Non-technical language where possible
- No CDP-specific jargon`;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate human-readable markdown spec from intake
 */
export async function generateSpecFromIntake(intakeText: string): Promise<{ specText: string }> {
  // First, generate the canonical spec
  const canonicalSpec = await generateCanonicalSpecFromIntake(intakeText);
  
  // Then, summarize it into markdown
  const summarizerPrompt = `${SUMMARIZER_PROMPT}

Given this Canonical Spec:
${JSON.stringify(canonicalSpec, null, 2)}

Generate a professional Markdown requirement specification following the exact format specified.
Output ONLY the markdown, no JSON wrapper, no code blocks.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: summarizerPrompt },
    ],
    temperature: 0.2,
  });

  const markdown = response.choices[0]?.message?.content || "";

  return { specText: markdown };
}

/**
 * Generate canonical spec with proper validation from intake
 */
export async function generateCanonicalSpecFromIntake(intakeText: string): Promise<CanonicalSpec> {
  // Step 1: Extract structured data
  const extractionPrompt = `${EXTRACTOR_PROMPT}

User Intake:
"${intakeText}"

Extract all relevant information and output as JSON matching this structure:
{
  "metadata": {
    "title": "string - descriptive title for this tracking requirement",
    "summary": "string - 2-3 sentence summary",
    "requestor": null,
    "submitted_at": "${new Date().toISOString()}",
    "status": "draft"
  },
  "events": [
    // IMPORTANT: Generate 3-6 events that cover the complete user journey
    // Example for checkout: Cart Viewed → Checkout Started → Payment Entered → Order Completed
    {
      "name": "string - Title Case event name (e.g., 'Product Added to Cart')",
      "description": "string - what this event captures",
      "trigger": "string - when this event fires",
      "properties": [
        {
          "name": "string - snake_case (e.g., 'order_id')",
          "type": "string|number|boolean|array|object",
          "required": true,
          "description": "string",
          "pii": {
            "classification": "none|low|medium|high",
            "reason": "string explaining why (e.g., 'Contains user email address')"
          },
          "consent": {
            "required": true,
            "policy_group": "marketing|analytics|data_processing|null"
          }
        }
      ],
      "identity": {
        "primary": "user_id",
        "secondary": ["email", "device_id", "session_id"],
        "stitching_assumptions": "User ID is the primary key linked to account. Email used for marketing communications. Device ID for cross-device tracking."
      },
      "business_rules": ["Rule 1 - e.g., 'Order total must be greater than zero'", "Rule 2"],
      "technical_rules": ["Rule 1 - e.g., 'Order ID must be a valid UUID format'", "Rule 2"],
      "validation": {
        "naming": [],
        "fields": [],
        "identity": [],
        "consent": [],
        "governance": [],
        "overall_score": 0
      }
    }
    // Add more events here to complete the journey (3-6 events total)
  ],
  "destinations": [
    {
      "name": "Segment",
      "requirements": ["Must map to tracking plan schema", "Real-time streaming required"],
      "notes": "Primary CDP for event collection"
    },
    {
      "name": "Google Analytics",
      "requirements": ["E-commerce events must follow GA4 schema"],
      "notes": "For marketing attribution"
    }
  ],
  "acceptance_criteria": [
    "Event fires correctly when user completes the action",
    "All required properties are captured and sent to destinations",
    "User identity is properly resolved",
    "PII fields are handled according to consent preferences"
  ],
  "open_questions": ["Question 1 specific to this intake", "Question 2"]
}

IMPORTANT:
- EVERY property MUST have pii.classification (none/low/medium/high) and consent fields filled
- identity.primary MUST be set (default to "user_id")
- identity.secondary MUST have at least 2 identifiers
- destinations MUST have at least 2 entries with proper requirements
- acceptance_criteria MUST have at least 3 items

Output ONLY valid JSON, no markdown, no comments.`;

  const extractionResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: extractionPrompt },
    ],
    temperature: 0.1,
  });

  const extractedRaw = extractionResponse.choices[0]?.message?.content ?? "{}";
  
  let canonicalSpec: CanonicalSpec;
  try {
    canonicalSpec = JSON.parse(extractedRaw) as CanonicalSpec;
  } catch (err) {
    console.error("Failed to parse extraction JSON:", extractedRaw);
    throw new Error("Could not parse AI response as CanonicalSpec JSON");
  }

  // Step 2: Validate each event
  for (const event of canonicalSpec.events) {
    // Helper to check naming conventions
    const isSnakeCase = (s: string) => /^[a-z][a-z0-9_]*$/.test(s);
    // Title Case: First word capitalized, subsequent words can be lowercase articles/prepositions OR capitalized
    // Valid: "Add to Cart", "Cart Abandoned", "Order Completed", "Product Added to Wishlist"
    const isTitleCase = (s: string) => {
      const words = s.split(' ');
      if (words.length === 0) return false;
      // First word must start with capital
      if (!/^[A-Z]/.test(words[0])) return false;
      // Rest can be lowercase articles/prepositions or capitalized words
      const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'with'];
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const isSmallWord = smallWords.includes(word.toLowerCase());
        const isCapitalized = /^[A-Z]/.test(word);
        if (!isSmallWord && !isCapitalized) return false;
      }
      return true;
    };
    
    // Pre-check for actual issues to guide the AI
    const namingIssues: string[] = [];
    const fieldIssues: string[] = [];
    
    // Check event name
    if (!isTitleCase(event.name)) {
      namingIssues.push(`Event name '${event.name}' should be Title Case (e.g., 'Cart Abandoned')`);
    }
    
    // Check property names
    for (const prop of event.properties || []) {
      if (!isSnakeCase(prop.name)) {
        namingIssues.push(`Property '${prop.name}' should be snake_case (e.g., '${prop.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}')`);
      }
      // Check numeric types
      if (['price', 'cost', 'total', 'amount', 'quantity', 'count'].some(t => prop.name.toLowerCase().includes(t))) {
        if (prop.type !== 'number') {
          fieldIssues.push(`Property '${prop.name}' should have type 'number', not '${prop.type}'`);
        }
      }
    }
    
    // Check identity
    const identityIssues: string[] = [];
    if (!event.identity?.primary) {
      identityIssues.push('Missing primary identity - add user_id, anonymous_id, or email');
    }
    
    // Check PII/consent - only actual PII fields, not product names
    const consentIssues: string[] = [];
    for (const prop of event.properties || []) {
      // Only flag actual user PII, not product/item data
      const actualPiiFields = ['email', 'phone', 'address', 'ssn', 'dob', 'birth', 'first_name', 'last_name', 'full_name', 'user_name', 'customer_name'];
      const isPiiField = actualPiiFields.some(pii => {
        // Exact match or ends with the PII term (e.g., "user_email" but not "product_name")
        return prop.name.toLowerCase() === pii || 
               prop.name.toLowerCase().endsWith('_' + pii) ||
               prop.name.toLowerCase().startsWith(pii + '_');
      });
      
      if (isPiiField) {
        if (prop.pii?.classification !== 'high') {
          consentIssues.push(`Property '${prop.name}' contains PII and should have pii.classification = 'high'`);
        }
        if (!prop.consent?.required) {
          consentIssues.push(`PII field '${prop.name}' should have consent.required = true`);
        }
      }
    }
    
    // Check for currency with monetary fields
    const governanceIssues: string[] = [];
    const hasMonetaryField = (event.properties || []).some(p => 
      ['price', 'cost', 'total', 'amount', 'value'].some(t => p.name.toLowerCase().includes(t))
    );
    const hasCurrency = (event.properties || []).some(p => p.name.toLowerCase().includes('currency'));
    if (hasMonetaryField && !hasCurrency) {
      governanceIssues.push('Monetary fields detected but no currency field - add currency (e.g., "USD")');
    }
    
    // Calculate score based on actual issues found
    const totalIssues = namingIssues.length + fieldIssues.length + identityIssues.length + consentIssues.length + governanceIssues.length;
    let score = 100;
    score -= namingIssues.length * 10;
    score -= fieldIssues.length * 5;
    score -= identityIssues.length * 20;
    score -= consentIssues.length * 15;
    score -= governanceIssues.length * 5;
    score = Math.max(0, Math.min(100, score));
    
    // If no issues found, score should be 100
    if (totalIssues === 0) {
      score = 100;
    }
    
    event.validation = {
      naming: namingIssues,
      fields: fieldIssues,
      identity: identityIssues,
      consent: consentIssues,
      governance: governanceIssues,
      overall_score: score,
    };
  }

  return canonicalSpec;
}

// Note: Validation score is now calculated inline in generateCanonicalSpecFromIntake