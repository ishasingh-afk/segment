import { openai } from "./aiClient.js";

export interface CanonicalSpec {
  metadata: {
    title: string;
    description: string;
    summary?: string;
    version: string;
    created_at: string;
  };
  events: CanonicalEvent[];
  destinations: string[];
  acceptance_criteria: string[];
  open_questions: string[];
}

export interface CanonicalEvent {
  name: string;
  description: string;
  trigger: string;
  properties: CanonicalProperty[];
  identity: {
    primary: string | null;
    secondary: string[];
  };
  business_rules: string[];
  technical_rules: string[];
  validation?: {
    overall_score?: number;
  };
}

export interface CanonicalProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string | number | boolean;
  format?: string;
  enum?: string[];
  min?: number;
  max?: number;
  pii?: {
    classification: string;
  };
}

const SYSTEM_PROMPT = `You are SpecPilot, an expert at transforming vague tracking requirements into structured CDP specifications.

When given a tracking request, you should:
1. Identify all relevant events in the user journey (typically 3-6 events)
2. Define clear properties for each event
3. Identify PII fields and their classifications
4. Create acceptance criteria
5. List any open questions for clarification

Always return well-structured, implementation-ready specifications.`;

const CANONICAL_SYSTEM_PROMPT = `You are SpecPilot, an expert at creating comprehensive, implementation-ready CDP specifications in JSON format.

Return a JSON object with this exact structure:
{
  "metadata": {
    "title": "string",                          // Clear, descriptive title
    "description": "string",                    // Detailed description of what this spec covers and why
    "summary": "string",                        // 2-3 sentence summary of the tracking implementation
    "version": "1.0.0",
    "created_at": "ISO date string"
  },
  "events": [
    {
      "name": "Event Name",                     // Concise, Title Case (max 4 words)
      "description": "Detailed description of what this event captures, including the user action and business context",
      "trigger": "Specific condition when this event fires (e.g., 'User clicks checkout button after adding at least one item to cart')",
      "properties": [
        {
          "name": "property_name",              // snake_case
          "type": "string|number|boolean|object|array",
          "required": true|false,
          "description": "Detailed description of what this property captures and how it should be used",
          "example": "example_value",           // Realistic example value matching the type
          "format": "format_constraint",        // e.g., "ISO8601", "UUID", "email", "URL", "currency_code" (optional)
          "enum": ["value1", "value2"],         // Allowed values for string types (optional)
          "min": 0,                             // Minimum value for numbers (optional)
          "max": 100,                           // Maximum value for numbers (optional)
          "pii": { "classification": "none|low|medium|high" }
        }
      ],
      "identity": {
        "primary": "user_id or null",           // Primary identifier field
        "secondary": ["email", "phone"]         // Secondary identifiers for identity resolution
      },
      "business_rules": [                       // Specific business logic rules
        "Detailed business rule with specific conditions and expected behavior"
      ],
      "technical_rules": [                      // Technical implementation rules
        "Specific technical requirement for implementation"
      ],
      "validation": { "overall_score": 85 }     // 0-100 based on spec completeness
    }
  ],
  "destinations": ["segment", "tealium", "mparticle"],   // lowercase slugs
  "acceptance_criteria": [                      // Specific, testable criteria
    "Specific, measurable acceptance criterion with expected outcome"
  ],
  "open_questions": [                           // Context-specific questions
    "Specific question about edge cases, business logic, or implementation details"
  ]
}

CRITICAL RULES FOR QUALITY:

1. EVENTS (generate 3-6):
   - Each event MUST have a detailed description explaining the user action AND business context
   - Trigger MUST be specific (not generic like "When event fires") - describe exact conditions
   - Include all events in the user journey from start to completion

2. PROPERTIES (minimum 5 per event):
   - Every property MUST have a meaningful description (not just restating the name)
   - Include "example" field with realistic, domain-appropriate values
   - Use "format" for constrained types: ISO8601 for timestamps, UUID for IDs, currency_code for currencies
   - Use "enum" when values are from a fixed set
   - Use "min"/"max" for numeric constraints (e.g., quantity >= 1, discount_percent 0-100)
   - Mark PII appropriately: user_id/order_id = none, email = high, name = medium, IP = low

3. BUSINESS RULES (minimum 2 per event):
   - Must be specific to the domain/use case
   - Include conditions, thresholds, and expected behaviors
   - Examples: "Event fires only after payment confirmation", "Cart must contain at least one item"

4. TECHNICAL RULES (minimum 2 per event):
   - Include data validation requirements
   - Specify timing/ordering constraints
   - Examples: "Timestamp must be server-side UTC", "order_id must match pattern ORD-[0-9]{8}"

5. ACCEPTANCE CRITERIA (minimum 4):
   - Must be testable and specific
   - Include data accuracy, timing, and completeness checks
   - Examples: "All monetary values use 2 decimal places", "Events fire within 100ms of user action"

6. OPEN QUESTIONS (minimum 3):
   - Ask about edge cases specific to this use case
   - Ask about business logic clarifications
   - Ask about integration requirements
   - Examples: "Should abandoned cart events fire for guest users?", "What's the retry policy for failed event delivery?"

7. DESTINATIONS: lowercase slugs from: segment, tealium, mparticle, salesforce, adobe (choose 2-3)

Return ONLY valid JSON (no markdown, no code fences).`;

// Helper to enforce minimal completeness so the UI doesn’t show blanks
export function normalizeCanonicalSpec(input: any): CanonicalSpec {
  const meta = input?.metadata || {};
  const events = Array.isArray(input?.events) ? input.events : [];
  const destinations = Array.isArray(input?.destinations) ? input.destinations : [];
  const acceptance = Array.isArray(input?.acceptance_criteria) ? input.acceptance_criteria : [];
  const questions = Array.isArray(input?.open_questions) ? input.open_questions : [];

  const safeDestinations =
    destinations.length > 0
      ? destinations.map((d: any) => String(d || "").toLowerCase().replace(/\s+/g, ""))
      : ["segment", "tealium", "mparticle"];

  const normalizedEvents = events.map((evt: any, idx: number) => {
    const props = Array.isArray(evt?.properties) ? evt.properties : [];
    const businessRules = Array.isArray(evt?.business_rules) ? evt.business_rules : [];
    const technicalRules = Array.isArray(evt?.technical_rules) ? evt.technical_rules : [];

    return {
      name: (evt?.name || `Event ${idx + 1}`).trim(),
      description: evt?.description || "Event generated by SpecPilot.",
      trigger: evt?.trigger || "When this event fires in the user journey.",
      properties: props.map((p: any) => {
        const prop: any = {
          name: p?.name || "property_name",
          type: (p?.type || "string").toLowerCase(),
          required: !!p?.required,
          description: p?.description || `The ${p?.name || "property"} value for this event`,
        };
        // Preserve optional fields when provided
        if (p?.example !== undefined) prop.example = p.example;
        if (p?.format) prop.format = p.format;
        if (Array.isArray(p?.enum) && p.enum.length > 0) prop.enum = p.enum;
        if (typeof p?.min === "number") prop.min = p.min;
        if (typeof p?.max === "number") prop.max = p.max;
        if (p?.pii) prop.pii = p.pii;
        return prop;
      }),
      identity: {
        primary: evt?.identity?.primary || null,
        secondary: Array.isArray(evt?.identity?.secondary) ? evt.identity.secondary : [],
      },
      business_rules: businessRules.length >= 2 ? businessRules : [
        ...businessRules,
        ...(businessRules.length < 2 ? ["Event must contain all required properties", "Data must accurately reflect the user action"] : [])
      ].slice(0, Math.max(2, businessRules.length)),
      technical_rules: technicalRules.length >= 2 ? technicalRules : [
        ...technicalRules,
        ...(technicalRules.length < 2 ? ["Timestamp must be in ISO8601 format", "All string values must be trimmed and non-empty"] : [])
      ].slice(0, Math.max(2, technicalRules.length)),
      validation: {
        overall_score: evt?.validation?.overall_score ?? 95,
      },
    };
  });

  return {
    metadata: {
      title: meta.title || "Untitled Spec",
      description: meta.description || "Tracking specification based on intake request.",
      summary: meta.summary || meta.description || meta.title || "Tracking specification based on intake request.",
      version: meta.version || "1.0.0",
      created_at: meta.created_at || new Date().toISOString(),
    },
    events: normalizedEvents,
    destinations: safeDestinations,
    acceptance_criteria:
      acceptance.length >= 4 ? acceptance : [
        ...acceptance,
        ...[
          "All required properties must be present and non-null for each event",
          "Events must fire within 100ms of the triggering user action",
          "All timestamps must be in ISO8601 format with timezone",
          "PII fields must be handled according to data privacy requirements",
        ].slice(0, Math.max(4 - acceptance.length, 0))
      ],
    open_questions:
      questions.length >= 3 ? questions : [
        ...questions,
        ...[
          "Should events be tracked for guest/anonymous users?",
          "What is the retry policy for failed event delivery?",
          "Are there any rate limiting requirements for high-volume events?",
        ].slice(0, Math.max(3 - questions.length, 0))
      ],
  };
}

export async function generateSpecFromIntake(input: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Create a comprehensive, implementation-ready tracking specification for: ${input}

Format as markdown with these sections:
# Event Specification: [Title]

## Overview
[Detailed description of what we're tracking, the business context, and why this tracking matters]

## Events

### Event 1: [Event Name]
- **Trigger:** Specific condition when this event fires (be precise about user action and context)
- **Description:** Detailed explanation of what this event captures and its business significance

#### Properties
| Property | Type | Required | Example | Format | Description | PII |
|----------|------|----------|---------|--------|-------------|-----|
| property_name | string | Yes | "example_value" | format | Detailed description | None/Low/Medium/High |

Include at least 5 properties per event with realistic examples and format constraints.

#### Business Rules
- Specific, actionable business rule with conditions and expected behavior
- At least 2 rules per event

#### Technical Rules
- Specific technical implementation requirement
- At least 2 rules per event

---

## Destinations
List 2-3 specific destinations with brief explanation of what data goes where.

## Acceptance Criteria
- [ ] Specific, testable criterion with measurable outcome
- [ ] At least 4 criteria covering data accuracy, timing, and completeness

## Open Questions
- Context-specific question about edge cases?
- Question about business logic clarification?
- At least 3 questions specific to this use case`,
      },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  });

  return response.choices[0]?.message?.content || "";
}

export async function generateCanonicalSpecFromIntake(input: string): Promise<CanonicalSpec> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: CANONICAL_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Create a comprehensive, implementation-ready tracking specification for: ${input}

Requirements:
- Generate 3-6 events covering the COMPLETE user journey from start to finish
- Each event needs at least 5 detailed properties with examples, formats, and constraints
- Include specific, actionable business rules and technical rules for each event
- Provide at least 4 testable acceptance criteria
- Include at least 3 context-specific open questions about edge cases and implementation
- All descriptions must be detailed and meaningful (not generic placeholders)

Return only valid JSON.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  
  // Clean up potential markdown code blocks
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeCanonicalSpec(parsed);
  } catch (err) {
    console.error("Failed to parse canonical spec:", err);
    // Return a minimal valid spec
    return normalizeCanonicalSpec({
      metadata: {
        title: "Parsing Error",
        description: "Failed to parse AI response",
        version: "1.0.0",
        created_at: new Date().toISOString(),
      },
      events: [],
      destinations: [],
      acceptance_criteria: [],
      open_questions: ["AI response could not be parsed. Please try again."],
    });
  }
}
