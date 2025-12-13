// backend/src/adapters/segmentAdapter.ts
// Segment Tracking Plan Adapter - Real Segment Format
// Transforms canonical spec into Segment-compatible tracking plan

import { CanonicalSpec, CanonicalEvent, CanonicalProperty } from "../models/canonicalSpec";

interface SegmentProperty {
  description: string;
  type: string | string[];
  required?: boolean;
  enum?: string[];
  pattern?: string;
}

interface SegmentEventRules {
  $schema: string;
  type: string;
  properties: Record<string, SegmentProperty>;
  required: string[];
}

interface SegmentEvent {
  name: string;
  description: string;
  rules: SegmentEventRules;
  version: number;
}

interface SegmentTrackingPlan {
  display_name: string;
  name: string;
  type: string;
  rules: {
    events: SegmentEvent[];
    global: {
      $schema: string;
      type: string;
      properties: Record<string, SegmentProperty>;
      required: string[];
    };
    identify: {
      $schema: string;
      type: string;
      properties: {
        traits: {
          type: string;
          properties: Record<string, SegmentProperty>;
        };
      };
    };
    group: {
      $schema: string;
      type: string;
      properties: Record<string, SegmentProperty>;
    };
  };
  _metadata: {
    generatedBy: string;
    generatedAt: string;
    sourceSpec: string;
  };
}

/**
 * Map canonical property type to Segment JSON Schema type
 */
function mapToSegmentType(type: string): string | string[] {
  const typeMap: Record<string, string | string[]> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    integer: "integer",
    array: "array",
    object: "object",
    datetime: "string", // Segment uses string with format
    any: ["string", "number", "boolean", "object", "array"],
  };
  return typeMap[type?.toLowerCase()] || "string";
}

/**
 * Convert event name to Segment format (Title Case)
 */
function toSegmentEventName(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Convert property name to Segment format (snake_case)
 */
function toSegmentPropertyName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Transform canonical spec to Segment Tracking Plan format
 */
export function transformToSegmentTrackingPlan(canonical: CanonicalSpec): SegmentTrackingPlan {
  const now = new Date().toISOString();
  const planName = canonical.metadata?.title || "SpecPilot Tracking Plan";

  // Transform events to Segment format
  const segmentEvents: SegmentEvent[] = canonical.events.map((event) => {
    const properties: Record<string, SegmentProperty> = {};
    const required: string[] = [];

    // Add standard Segment properties
    properties["context"] = {
      description: "Segment context object with device, app, and session info",
      type: "object",
    };

    // Transform canonical properties
    (event.properties || []).forEach((prop) => {
      const propName = toSegmentPropertyName(prop.name);
      properties[propName] = {
        description: prop.description || `${prop.name} property`,
        type: mapToSegmentType(prop.type),
      };

      if (prop.required) {
        required.push(propName);
      }
    });

    // Add timestamp if not present
    if (!properties["timestamp"]) {
      properties["timestamp"] = {
        description: "ISO 8601 timestamp when the event occurred",
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}",
      };
    }

    return {
      name: toSegmentEventName(event.name),
      description: event.description || `Tracks when ${event.name.toLowerCase()} occurs`,
      rules: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties,
        required,
      },
      version: 1,
    };
  });

  // Build global properties (common to all events)
  const globalProperties: Record<string, SegmentProperty> = {
    anonymousId: {
      description: "Anonymous identifier for the user",
      type: "string",
    },
    userId: {
      description: "Unique identifier for a logged-in user",
      type: "string",
    },
    messageId: {
      description: "Unique identifier for this message",
      type: "string",
    },
    sentAt: {
      description: "Timestamp when the message was sent from the client",
      type: "string",
    },
    receivedAt: {
      description: "Timestamp when Segment received the message",
      type: "string",
    },
  };

  // Build identify traits from canonical identity
  const identifyTraits: Record<string, SegmentProperty> = {
    email: {
      description: "User's email address",
      type: "string",
    },
    name: {
      description: "User's full name",
      type: "string",
    },
    created_at: {
      description: "When the user account was created",
      type: "string",
    },
  };

  return {
    display_name: planName,
    name: planName.toLowerCase().replace(/\s+/g, "_"),
    type: "TRACKING_PLAN",
    rules: {
      events: segmentEvents,
      global: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: globalProperties,
        required: [],
      },
      identify: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          traits: {
            type: "object",
            properties: identifyTraits,
          },
        },
      },
      group: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          groupId: {
            description: "Unique identifier for the group",
            type: "string",
          },
          traits: {
            description: "Group traits",
            type: "object",
          },
        },
      },
    },
    _metadata: {
      generatedBy: "SpecPilot Segment Adapter",
      generatedAt: now,
      sourceSpec: canonical.metadata?.title || "Unknown",
    },
  };
}