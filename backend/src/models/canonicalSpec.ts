// src/models/canonicalSpec.ts

export type ValidationMessage = string;

export interface ValidationSummary {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  suggestions: ValidationMessage[];
  score: number; // 0 - 100
}

export interface CanonicalProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
  pii: {
    classification: "none" | "low" | "medium" | "high";
    reason: string | null;
  };
  consent: {
    required: boolean;
    policy_group: string | null;
  };
}

export interface CanonicalIdentity {
  primary: string | null; // e.g. "user_id"
  secondary: string[];
  stitching_assumptions: string;
}

export interface CanonicalEvent {
  name: string;
  description: string;
  trigger: string;
  properties: CanonicalProperty[];
  identity: CanonicalIdentity;
  business_rules: string[];
  technical_rules: string[];
  validation: {
    naming: string[];
    fields: string[];
    identity: string[];
    consent: string[];
    governance: string[];
    overall_score: number;
  };
}

export interface CanonicalDestination {
  name: "segment" | "adobe" | "homegrown" | "mc" | string;
  requirements: string[];
  notes: string;
}

export interface CanonicalMetadata {
  title: string;
  summary: string;
  requestor: string | null;
  submitted_at: string; // ISO date string
  status: "draft" | "validated" | "approved";
}

export interface CanonicalSpec {
  metadata: CanonicalMetadata;
  events: CanonicalEvent[];
  destinations: CanonicalDestination[];
  acceptance_criteria: string[];
  open_questions: string[];
}
