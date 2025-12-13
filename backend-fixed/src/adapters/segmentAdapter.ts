interface SegmentTrackingPlan {
  display_name: string;
  rules: {
    events: SegmentEvent[];
  };
}

interface SegmentEvent {
  name: string;
  description: string;
  rules: {
    properties: {
      properties: Record<string, SegmentProperty>;
      required: string[];
    };
  };
}

interface SegmentProperty {
  type: string;
  description: string;
}

export function transformToSegmentTrackingPlan(canonicalSpec: any): SegmentTrackingPlan {
  const events: SegmentEvent[] = (canonicalSpec.events || []).map((event: any) => {
    const properties: Record<string, SegmentProperty> = {};
    const required: string[] = [];

    (event.properties || []).forEach((prop: any) => {
      properties[prop.name] = {
        type: mapTypeToSegment(prop.type),
        description: prop.description || "",
      };
      if (prop.required) {
        required.push(prop.name);
      }
    });

    return {
      name: event.name,
      description: event.description || "",
      rules: {
        properties: {
          properties,
          required,
        },
      },
    };
  });

  return {
    display_name: canonicalSpec.metadata?.title || "Tracking Plan",
    rules: {
      events,
    },
  };
}

function mapTypeToSegment(type: string): string {
  const typeMap: Record<string, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    object: "object",
    array: "array",
    integer: "integer",
  };
  return typeMap[type?.toLowerCase()] || "string";
}
