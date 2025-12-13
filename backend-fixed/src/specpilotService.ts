import { openai } from "./aiClient.js";

export interface CanonicalSpec {
  metadata: {
    title: string;
    description: string;
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
}

export interface CanonicalProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
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

const CANONICAL_SYSTEM_PROMPT = `You are SpecPilot, an expert at creating canonical CDP specifications in JSON format.

Return a JSON object with this exact structure:
{
  "metadata": {
    "title": "string",
    "description": "string",
    "version": "1.0.0",
    "created_at": "ISO date string"
  },
  "events": [
    {
      "name": "Event Name",
      "description": "What this event captures",
      "trigger": "When this event fires",
      "properties": [
        {
          "name": "property_name",
          "type": "string|number|boolean|object|array",
          "required": true|false,
          "description": "What this property captures",
          "pii": { "classification": "none|low|medium|high" }
        }
      ],
      "identity": {
        "primary": "user_id or null",
        "secondary": ["email", "phone"]
      },
      "business_rules": ["Rule 1", "Rule 2"],
      "technical_rules": ["Rule 1", "Rule 2"]
    }
  ],
  "destinations": ["Segment", "BigQuery", "etc"],
  "acceptance_criteria": ["Criterion 1", "Criterion 2"],
  "open_questions": ["Question 1", "Question 2"]
}

Generate 3-6 events that cover the complete user journey for the requested tracking.
Return ONLY valid JSON, no markdown code blocks.`;

export async function generateSpecFromIntake(input: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Create a detailed tracking specification for: ${input}

Format as markdown with these sections:
# Event Specification: [Title]

## Overview
[Description of what we're tracking]

## Events

### Event 1: [Event Name]
- **Trigger:** When this event fires
- **Description:** What this event captures

#### Properties
| Property | Type | Required | Description | PII |
|----------|------|----------|-------------|-----|
| property_name | string | Yes | Description | None |

#### Business Rules
- Rule 1
- Rule 2

---

## Destinations
- Destination 1
- Destination 2

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Open Questions
- Question 1?
- Question 2?`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
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
        content: `Create a canonical tracking specification for: ${input}

Generate 3-6 events covering the complete user journey. Return only valid JSON.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
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
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse canonical spec:", err);
    // Return a minimal valid spec
    return {
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
    };
  }
}
