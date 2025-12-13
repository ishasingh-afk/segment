interface TealiumSpec {
  account: string;
  profile: string;
  events: TealiumEvent[];
}

interface TealiumEvent {
  event_name: string;
  event_type: string;
  attributes: TealiumAttribute[];
}

interface TealiumAttribute {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string | number | boolean;
  format?: string;
  allowed_values?: string[];
  min_value?: number;
  max_value?: number;
}

export function transformToTealiumCdp(canonicalSpec: any): TealiumSpec {
  const events: TealiumEvent[] = (canonicalSpec.events || []).map((event: any) => {
    const attributes: TealiumAttribute[] = (event.properties || []).map((prop: any) => {
      const attr: TealiumAttribute = {
        name: prop.name,
        type: mapTypeToTealium(prop.type),
        required: prop.required || false,
        description: prop.description || "",
      };

      // Include optional constraint fields
      if (prop.example !== undefined) attr.example = prop.example;
      if (prop.format) attr.format = prop.format;
      if (Array.isArray(prop.enum) && prop.enum.length > 0) attr.allowed_values = prop.enum;
      if (typeof prop.min === "number") attr.min_value = prop.min;
      if (typeof prop.max === "number") attr.max_value = prop.max;

      return attr;
    });

    return {
      event_name: event.name,
      event_type: "event",
      attributes,
    };
  });

  return {
    account: "default_account",
    profile: "main",
    events,
  };
}

function mapTypeToTealium(type: string): string {
  const typeMap: Record<string, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    object: "object",
    array: "array_of_strings",
    integer: "number",
  };
  return typeMap[type?.toLowerCase()] || "string";
}
