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
}

export function transformToTealiumCdp(canonicalSpec: any): TealiumSpec {
  const events: TealiumEvent[] = (canonicalSpec.events || []).map((event: any) => {
    const attributes: TealiumAttribute[] = (event.properties || []).map((prop: any) => ({
      name: prop.name,
      type: mapTypeToTealium(prop.type),
      required: prop.required || false,
      description: prop.description || "",
    }));

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
