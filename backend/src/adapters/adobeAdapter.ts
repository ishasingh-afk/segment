// backend/src/adapters/adobeAdapter.ts
// Adobe Real-Time CDP (RTCDP) Adapter - Mock Implementation
// Transforms canonical spec into Adobe RTCDP-compatible XDM format

import { CanonicalSpec, CanonicalEvent, CanonicalProperty } from "../models/canonicalSpec";

interface AdobeXDMField {
  "@type": string;
  "xdm:name": string;
  "xdm:dataType": string;
  "xdm:required": boolean;
  "xdm:description": string;
  "meta:xdmField": string;
  "xdm:identityNamespace"?: string;
  "xdm:isPrimary"?: boolean;
  "xdm:sensitivityLabel"?: string;
}

interface AdobeExperienceEvent {
  "@id": string;
  "@type": string;
  "xdm:name": string;
  "xdm:displayName": string;
  "xdm:description": string;
  "xdm:schemaRef": {
    "@id": string;
    "contentType": string;
  };
  "xdm:fields": AdobeXDMField[];
  "xdm:identityMap": {
    [namespace: string]: {
      "xdm:id": string;
      "xdm:primary": boolean;
      "xdm:authenticatedState": string;
    }[];
  };
  "xdm:timestamp": string;
  "xdm:eventType": string;
}

interface AdobeRTCDPSpec {
  "@context": {
    "@vocab": string;
    "xdm": string;
    "meta": string;
  };
  "@type": string;
  "meta:class": string;
  "meta:resourceType": string;
  "meta:sandboxId": string;
  "meta:sandboxType": string;
  "xdm:tenant": string;
  "xdm:schemas": {
    "@id": string;
    "@type": string;
    "xdm:version": string;
    "xdm:title": string;
    "xdm:description": string;
  }[];
  "xdm:experienceEvents": AdobeExperienceEvent[];
  "xdm:datasets": {
    "@id": string;
    "xdm:name": string;
    "xdm:schemaRef": string;
    "xdm:tags": string[];
    "xdm:enabledForProfile": boolean;
    "xdm:enabledForIdentity": boolean;
  }[];
  "xdm:identityGraph": {
    "xdm:namespaces": {
      "xdm:code": string;
      "xdm:displayName": string;
      "xdm:idType": string;
      "xdm:primary": boolean;
    }[];
    "xdm:linkingRules": {
      "xdm:strategy": string;
      "xdm:deterministicFirst": boolean;
    };
  };
  "xdm:dataGovernance": {
    "xdm:consentRequired": boolean;
    "xdm:labels": string[];
    "xdm:retentionPolicy": {
      "xdm:days": number;
      "xdm:action": string;
    };
    "xdm:marketingActions": string[];
  };
  "_metadata": {
    "generatedBy": string;
    "generatedAt": string;
    "note": string;
  };
}

/**
 * Map CanonicalSpec property type to Adobe XDM type
 */
function mapToXDMType(type: string): string {
  const typeMap: Record<string, string> = {
    string: "xdm:string",
    number: "xdm:number",
    boolean: "xdm:boolean",
    integer: "xdm:int",
    array: "xdm:array",
    object: "xdm:object",
    datetime: "xdm:dateTime",
  };
  return typeMap[type?.toLowerCase()] || "xdm:string";
}

/**
 * Generate XDM path for a property
 */
function generateXDMField(eventName: string, propertyName: string, tenantId: string): string {
  const sanitizedEvent = eventName.toLowerCase().replace(/\s+/g, "");
  return `${tenantId}.${sanitizedEvent}.${propertyName}`;
}

/**
 * Get Adobe sensitivity label based on PII classification
 */
function getSensitivityLabel(piiClassification?: string): string | undefined {
  switch (piiClassification?.toLowerCase()) {
    case "high": return "S1"; // Sensitive
    case "medium": return "S2"; // Confidential
    case "low": return "S3"; // Internal
    default: return undefined;
  }
}

/**
 * Get Adobe data governance labels
 */
function getGovernanceLabels(piiClassification?: string): string[] {
  switch (piiClassification?.toLowerCase()) {
    case "high": return ["C2", "C5", "I1", "S1", "P1"]; // Sensitive PII with export restrictions
    case "medium": return ["C3", "I1", "P2"]; // Standard PII
    case "low": return ["C1"]; // General data
    default: return [];
  }
}

/**
 * Map event name to XDM event type
 */
function getXDMEventType(eventName: string): string {
  const nameLower = eventName.toLowerCase();
  if (nameLower.includes("purchase") || nameLower.includes("order")) return "commerce.purchases";
  if (nameLower.includes("cart") && nameLower.includes("add")) return "commerce.productListAdds";
  if (nameLower.includes("cart") && nameLower.includes("remove")) return "commerce.productListRemovals";
  if (nameLower.includes("checkout")) return "commerce.checkouts";
  if (nameLower.includes("view") || nameLower.includes("page")) return "web.webpagedetails.pageViews";
  if (nameLower.includes("click")) return "web.webinteraction.linkClicks";
  if (nameLower.includes("search")) return "search.searchRequest";
  if (nameLower.includes("login") || nameLower.includes("signup")) return "userAccount.login";
  return "experienceEvent.custom";
}

/**
 * Transform canonical spec to Adobe RTCDP format
 */
export function transformToAdobeRTCDP(canonical: CanonicalSpec): AdobeRTCDPSpec {
  const now = new Date().toISOString();
  const sandboxId = "prod";
  const tenantId = "_experienceplatform";
  const orgId = "EXAMPLE_ORG@AdobeOrg";

  // Transform events to Adobe Experience Events
  const experienceEvents: AdobeExperienceEvent[] = canonical.events.map((event, idx) => {
    const eventId = `event_${event.name.toLowerCase().replace(/\s+/g, "_")}_${idx}`;
    const schemaId = `https://ns.adobe.com/${orgId}/schemas/${eventId}`;

    // Transform properties to XDM fields
    const fields: AdobeXDMField[] = (event.properties || []).map((prop) => ({
      "@type": "xdm:property",
      "xdm:name": prop.name,
      "xdm:dataType": mapToXDMType(prop.type),
      "xdm:required": prop.required ?? false,
      "xdm:description": prop.description || "",
      "meta:xdmField": generateXDMField(event.name, prop.name, tenantId),
      "xdm:identityNamespace": prop.name.toLowerCase().includes("id") || prop.name.toLowerCase().includes("email")
        ? prop.name.toUpperCase().replace(/_/g, "")
        : undefined,
      "xdm:isPrimary": prop.name === event.identity?.primary,
      "xdm:sensitivityLabel": getSensitivityLabel(prop.pii?.classification),
    }));

    // Add standard XDM fields
    fields.unshift(
      {
        "@type": "xdm:property",
        "xdm:name": "_id",
        "xdm:dataType": "xdm:string",
        "xdm:required": true,
        "xdm:description": "Unique identifier for the experience event",
        "meta:xdmField": `${tenantId}._id`,
      },
      {
        "@type": "xdm:property",
        "xdm:name": "timestamp",
        "xdm:dataType": "xdm:dateTime",
        "xdm:required": true,
        "xdm:description": "Time when the event occurred",
        "meta:xdmField": "xdm:timestamp",
      }
    );

    // Build identity map
    const identityMap: AdobeExperienceEvent["xdm:identityMap"] = {};
    
    if (event.identity?.primary) {
      const ns = event.identity.primary.toUpperCase().replace(/_/g, "");
      identityMap[ns] = [{
        "xdm:id": `{${event.identity.primary}}`,
        "xdm:primary": true,
        "xdm:authenticatedState": "authenticated",
      }];
    }

    (event.identity?.secondary || []).forEach((secId) => {
      const ns = secId.toUpperCase().replace(/_/g, "");
      identityMap[ns] = [{
        "xdm:id": `{${secId}}`,
        "xdm:primary": false,
        "xdm:authenticatedState": "ambiguous",
      }];
    });

    // Add ECID if no identity
    if (Object.keys(identityMap).length === 0) {
      identityMap["ECID"] = [{
        "xdm:id": "{ecid}",
        "xdm:primary": true,
        "xdm:authenticatedState": "ambiguous",
      }];
    }

    return {
      "@id": schemaId,
      "@type": "xdm:ExperienceEvent",
      "xdm:name": eventId,
      "xdm:displayName": event.name,
      "xdm:description": event.description || "",
      "xdm:schemaRef": {
        "@id": schemaId,
        "contentType": "application/vnd.adobe.xed-full+json;version=1",
      },
      "xdm:fields": fields,
      "xdm:identityMap": identityMap,
      "xdm:timestamp": "{timestamp}",
      "xdm:eventType": getXDMEventType(event.name),
    };
  });

  // Generate schemas
  const schemas = experienceEvents.map((event) => ({
    "@id": event["@id"],
    "@type": "xdm:Schema",
    "xdm:version": "1.0",
    "xdm:title": event["xdm:displayName"],
    "xdm:description": event["xdm:description"],
  }));

  // Generate datasets
  const datasets = experienceEvents.map((event) => ({
    "@id": `ds_${event["xdm:name"]}`,
    "xdm:name": `${event["xdm:displayName"]} Dataset`,
    "xdm:schemaRef": event["@id"],
    "xdm:tags": ["web", "behavioral", canonical.metadata?.title || "specpilot"],
    "xdm:enabledForProfile": true,
    "xdm:enabledForIdentity": true,
  }));

  // Collect all identity namespaces
  const allNamespaces = new Map<string, boolean>();
  experienceEvents.forEach((event) => {
    Object.entries(event["xdm:identityMap"]).forEach(([ns, ids]) => {
      const isPrimary = ids.some(id => id["xdm:primary"]);
      if (!allNamespaces.has(ns) || isPrimary) {
        allNamespaces.set(ns, isPrimary);
      }
    });
  });

  const identityNamespaces = Array.from(allNamespaces.entries()).map(([ns, isPrimary]) => ({
    "xdm:code": ns,
    "xdm:displayName": ns.charAt(0) + ns.slice(1).toLowerCase().replace(/id$/i, " ID"),
    "xdm:idType": ns === "ECID" ? "COOKIE" : "CROSS_DEVICE",
    "xdm:primary": isPrimary,
  }));

  // Collect all governance labels
  const allLabels = new Set<string>();
  canonical.events.forEach((event) => {
    (event.properties || []).forEach((prop) => {
      getGovernanceLabels(prop.pii?.classification).forEach((label) => allLabels.add(label));
    });
  });

  // Determine if consent is needed
  const requiresConsent = canonical.events.some((event) =>
    (event.properties || []).some(
      (prop) => prop.pii?.classification === "high" || prop.pii?.classification === "medium"
    )
  );

  return {
    "@context": {
      "@vocab": "https://ns.adobe.com/xdm/context/",
      "xdm": "https://ns.adobe.com/xdm/",
      "meta": "https://ns.adobe.com/meta/",
    },
    "@type": "xdm:ExperienceEventSchema",
    "meta:class": "https://ns.adobe.com/xdm/context/experienceevent",
    "meta:resourceType": "schema",
    "meta:sandboxId": sandboxId,
    "meta:sandboxType": "production",
    "xdm:tenant": tenantId,
    "xdm:schemas": schemas,
    "xdm:experienceEvents": experienceEvents,
    "xdm:datasets": datasets,
    "xdm:identityGraph": {
      "xdm:namespaces": identityNamespaces,
      "xdm:linkingRules": {
        "xdm:strategy": "DETERMINISTIC",
        "xdm:deterministicFirst": true,
      },
    },
    "xdm:dataGovernance": {
      "xdm:consentRequired": requiresConsent,
      "xdm:labels": Array.from(allLabels),
      "xdm:retentionPolicy": {
        "xdm:days": requiresConsent ? 30 : 90,
        "xdm:action": "DELETE",
      },
      "xdm:marketingActions": requiresConsent 
        ? ["marketing:email", "marketing:push", "personalization:web"]
        : ["analytics:web"],
    },
    "_metadata": {
      generatedBy: "SpecPilot Adobe RTCDP Adapter",
      generatedAt: now,
      note: "This is a mock representation of Adobe Experience Platform XDM format. Actual implementation may vary.",
    },
  };
}