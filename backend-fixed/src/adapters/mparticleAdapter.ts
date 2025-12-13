interface MParticleSpec {
  data_plan_id: string;
  data_plan_name: string;
  data_plan_versions: MParticleVersion[];
}

interface MParticleVersion {
  version: number;
  data_plan_id: string;
  version_document: {
    data_points: MParticleDataPoint[];
  };
}

interface MParticleDataPoint {
  match: {
    type: string;
    criteria: {
      event_name: string;
    };
  };
  validator: {
    type: string;
    definition: {
      properties: {
        data: {
          properties: {
            custom_attributes: {
              properties: Record<string, MParticleAttribute>;
              required: string[];
            };
          };
        };
      };
    };
  };
}

interface MParticleAttribute {
  type: string;
  description: string;
  examples?: (string | number | boolean)[];
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export function transformToMParticleCdp(canonicalSpec: any): MParticleSpec {
  const dataPoints: MParticleDataPoint[] = (canonicalSpec.events || []).map((event: any) => {
    const properties: Record<string, MParticleAttribute> = {};
    const required: string[] = [];

    (event.properties || []).forEach((prop: any) => {
      const mparticleProp: MParticleAttribute = {
        type: mapTypeToMParticle(prop.type),
        description: prop.description || "",
      };

      // Include optional constraint fields (JSON Schema compatible)
      if (prop.example !== undefined) mparticleProp.examples = [prop.example];
      if (prop.format) mparticleProp.format = prop.format;
      if (Array.isArray(prop.enum) && prop.enum.length > 0) mparticleProp.enum = prop.enum;
      if (typeof prop.min === "number") mparticleProp.minimum = prop.min;
      if (typeof prop.max === "number") mparticleProp.maximum = prop.max;

      properties[prop.name] = mparticleProp;
      if (prop.required) {
        required.push(prop.name);
      }
    });

    return {
      match: {
        type: "custom_event",
        criteria: {
          event_name: event.name,
        },
      },
      validator: {
        type: "json_schema",
        definition: {
          properties: {
            data: {
              properties: {
                custom_attributes: {
                  properties,
                  required,
                },
              },
            },
          },
        },
      },
    };
  });

  const planId = (canonicalSpec.metadata?.title || "tracking_plan")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  return {
    data_plan_id: planId,
    data_plan_name: canonicalSpec.metadata?.title || "Tracking Plan",
    data_plan_versions: [
      {
        version: 1,
        data_plan_id: planId,
        version_document: {
          data_points: dataPoints,
        },
      },
    ],
  };
}

function mapTypeToMParticle(type: string): string {
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
