// backend/src/adapters/enterpriseAdapter.ts
// Enterprise/Homegrown CDP Adapter - Mock Implementation
// Transforms canonical spec into enterprise CDP format with strict governance

import { CanonicalSpec, CanonicalEvent, CanonicalProperty } from "../models/canonicalSpec";

interface EnterpriseField {
  field_name: string;
  field_type: string;
  nullable: boolean;
  pii_classification: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "RESTRICTED";
  data_governance: {
    retention_days: number;
    encryption_required: boolean;
    masking_rule: string | null;
  };
  consent_requirements: {
    required: boolean;
    consent_types: string[];
  };
  validation: {
    pattern?: string;
    min_length?: number;
    max_length?: number;
    allowed_values?: string[];
  };
}

interface EnterpriseEvent {
  event_code: string;
  event_name: string;
  event_category: string;
  description: string;
  trigger_condition: string;
  schema: {
    namespace: string;
    version: string;
    fields: EnterpriseField[];
  };
  identity_resolution: {
    primary_key: string;
    secondary_keys: string[];
    stitching_strategy: string;
  };
  data_quality: {
    required_fields: string[];
    business_rules: string[];
    technical_validations: string[];
  };
  lineage: {
    source_system: string;
    data_steward: string;
    classification: string;
  };
}

interface EnterpriseCDPSpec {
  spec_version: "2.0";
  organization: {
    id: string;
    name: string;
    environment: string;
  };
  governance: {
    data_classification: string;
    compliance_frameworks: string[];
    consent_management: {
      enabled: boolean;
      default_policy: string;
    };
    retention_policy: {
      default_days: number;
      pii_days: number;
    };
  };
  events: EnterpriseEvent[];
  identity_graph: {
    primary_namespace: string;
    supported_namespaces: {
      code: string;
      display_name: string;
      priority: number;
      is_pii: boolean;
    }[];
    resolution_rules: {
      strategy: string;
      deterministic_keys: string[];
      probabilistic_enabled: boolean;
    };
  };
  destinations: {
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    sync_mode: string;
    filter_rules: string[];
  }[];
  _audit: {
    generated_by: string;
    generated_at: string;
    approval_status: string;
    last_modified_by: string;
  };
}

/**
 * Map canonical type to enterprise type
 */
function mapToEnterpriseType(type: string): string {
  const typeMap: Record<string, string> = {
    string: "VARCHAR(255)",
    number: "DECIMAL(18,4)",
    boolean: "BOOLEAN",
    integer: "BIGINT",
    array: "ARRAY<STRING>",
    object: "JSON",
    datetime: "TIMESTAMP_NTZ",
  };
  return typeMap[type?.toLowerCase()] || "VARCHAR(255)";
}

/**
 * Convert to enterprise event code (SCREAMING_SNAKE_CASE)
 */
function toEventCode(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Convert to enterprise field name (snake_case)
 */
function toFieldName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Map PII classification
 */
function mapPiiClassification(pii?: { classification?: string }): EnterpriseField["pii_classification"] {
  const classification = pii?.classification?.toLowerCase();
  switch (classification) {
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
    default: return "NONE";
  }
}

/**
 * Determine masking rule based on PII level
 */
function getMaskingRule(piiLevel: string): string | null {
  switch (piiLevel) {
    case "HIGH": return "FULL_MASK";
    case "MEDIUM": return "PARTIAL_MASK";
    case "LOW": return "HASH_SHA256";
    default: return null;
  }
}

/**
 * Categorize event based on name
 */
function categorizeEvent(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("cart") || nameLower.includes("checkout") || nameLower.includes("purchase") || nameLower.includes("order")) {
    return "COMMERCE";
  }
  if (nameLower.includes("login") || nameLower.includes("signup") || nameLower.includes("register")) {
    return "AUTHENTICATION";
  }
  if (nameLower.includes("click") || nameLower.includes("view") || nameLower.includes("page")) {
    return "ENGAGEMENT";
  }
  if (nameLower.includes("search") || nameLower.includes("filter")) {
    return "DISCOVERY";
  }
  return "GENERAL";
}

/**
 * Transform canonical spec to Enterprise CDP format
 */
export function transformToEnterpriseCdp(canonical: CanonicalSpec): EnterpriseCDPSpec {
  const now = new Date().toISOString();

  // Transform events
  const enterpriseEvents: EnterpriseEvent[] = canonical.events.map((event) => {
    const eventCode = toEventCode(event.name);
    const category = categorizeEvent(event.name);

    // Transform fields with full governance metadata
    const fields: EnterpriseField[] = (event.properties || []).map((prop) => {
      const piiLevel = mapPiiClassification(prop.pii);
      return {
        field_name: toFieldName(prop.name),
        field_type: mapToEnterpriseType(prop.type),
        nullable: !prop.required,
        pii_classification: piiLevel,
        data_governance: {
          retention_days: piiLevel === "HIGH" ? 30 : piiLevel === "MEDIUM" ? 90 : 365,
          encryption_required: piiLevel === "HIGH" || piiLevel === "MEDIUM",
          masking_rule: getMaskingRule(piiLevel),
        },
        consent_requirements: {
          required: piiLevel !== "NONE",
          consent_types: piiLevel === "HIGH" 
            ? ["EXPLICIT_CONSENT", "DATA_PROCESSING"] 
            : piiLevel === "MEDIUM" 
              ? ["IMPLIED_CONSENT"] 
              : [],
        },
        validation: {
          max_length: prop.type === "string" ? 255 : undefined,
        },
      };
    });

    // Add standard enterprise fields
    fields.unshift(
      {
        field_name: "event_id",
        field_type: "VARCHAR(36)",
        nullable: false,
        pii_classification: "NONE",
        data_governance: { retention_days: 365, encryption_required: false, masking_rule: null },
        consent_requirements: { required: false, consent_types: [] },
        validation: { pattern: "^[a-f0-9-]{36}$" },
      },
      {
        field_name: "event_timestamp",
        field_type: "TIMESTAMP_NTZ",
        nullable: false,
        pii_classification: "NONE",
        data_governance: { retention_days: 365, encryption_required: false, masking_rule: null },
        consent_requirements: { required: false, consent_types: [] },
        validation: {},
      },
      {
        field_name: "session_id",
        field_type: "VARCHAR(64)",
        nullable: true,
        pii_classification: "LOW",
        data_governance: { retention_days: 90, encryption_required: false, masking_rule: "HASH_SHA256" },
        consent_requirements: { required: false, consent_types: [] },
        validation: {},
      }
    );

    return {
      event_code: eventCode,
      event_name: event.name,
      event_category: category,
      description: event.description || "",
      trigger_condition: event.trigger || "User action",
      schema: {
        namespace: `com.enterprise.events.${category.toLowerCase()}`,
        version: "1.0.0",
        fields,
      },
      identity_resolution: {
        primary_key: event.identity?.primary || "user_id",
        secondary_keys: event.identity?.secondary || ["email", "device_id"],
        stitching_strategy: "DETERMINISTIC_FIRST",
      },
      data_quality: {
        required_fields: fields.filter(f => !f.nullable).map(f => f.field_name),
        business_rules: event.business_rules || [],
        technical_validations: event.technical_rules || [],
      },
      lineage: {
        source_system: "WEB_APP",
        data_steward: "cdp-team@enterprise.com",
        classification: "INTERNAL",
      },
    };
  });

  // Collect all identity namespaces
  const namespaces = new Set<string>();
  canonical.events.forEach((event) => {
    if (event.identity?.primary) namespaces.add(event.identity.primary);
    (event.identity?.secondary || []).forEach((s) => namespaces.add(s));
  });
  if (namespaces.size === 0) namespaces.add("user_id");

  // Transform destinations
  const destinations = (canonical.destinations || []).map((dest, i) => ({
    id: `dest_${i + 1}`,
    name: dest.name,
    type: dest.name.toLowerCase().includes("segment") ? "CDP" 
      : dest.name.toLowerCase().includes("adobe") ? "ANALYTICS"
      : dest.name.toLowerCase().includes("salesforce") ? "CRM"
      : "DATA_WAREHOUSE",
    enabled: true,
    sync_mode: "STREAMING",
    filter_rules: dest.requirements || [],
  }));

  return {
    spec_version: "2.0",
    organization: {
      id: "ORG_001",
      name: "Enterprise Corp",
      environment: "PRODUCTION",
    },
    governance: {
      data_classification: "CONFIDENTIAL",
      compliance_frameworks: ["GDPR", "CCPA", "SOC2"],
      consent_management: {
        enabled: true,
        default_policy: "OPT_IN_REQUIRED",
      },
      retention_policy: {
        default_days: 365,
        pii_days: 30,
      },
    },
    events: enterpriseEvents,
    identity_graph: {
      primary_namespace: "USER_ID",
      supported_namespaces: Array.from(namespaces).map((ns, i) => ({
        code: ns.toUpperCase(),
        display_name: ns.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        priority: i + 1,
        is_pii: ["email", "phone", "name"].some(pii => ns.toLowerCase().includes(pii)),
      })),
      resolution_rules: {
        strategy: "DETERMINISTIC",
        deterministic_keys: ["user_id", "email"],
        probabilistic_enabled: false,
      },
    },
    destinations,
    _audit: {
      generated_by: "SpecPilot Enterprise Adapter",
      generated_at: now,
      approval_status: canonical.metadata?.status?.toUpperCase() || "DRAFT",
      last_modified_by: "system",
    },
  };
}