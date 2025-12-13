import React, { useState, useEffect } from "react";
import "./App.css";

// ============================================================================
// DESIGN TOKENS (PRD: Inter 14-16px, Walmart-blue CTAs, white cards)
// ============================================================================
const tokens = {
  colors: {
    primary: "#0071dc",        // Walmart blue
    primaryHover: "#005bb7",
    background: "#f8fafc",
    surface: "#ffffff",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    text: {
      primary: "#1e293b",
      secondary: "#64748b",
      muted: "#94a3b8",
    },
    status: {
      draft: { bg: "#f3f4f6", text: "#6b7280" },
      pending_approval: { bg: "#dbeafe", text: "#2563eb" },
      changes_requested: { bg: "#ffedd5", text: "#ea580c" },
      validated: { bg: "#fef3c7", text: "#d97706" },
      approved: { bg: "#dcfce7", text: "#16a34a" },
    },
    validation: {
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
  },
  fonts: {
    base: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
  },
};

// ============================================================================
// CLIENT ID (workspace isolation)
// ============================================================================
function getOrCreateClientId(): string {
  const key = "specpilot_client_id";
  let existing = localStorage.getItem(key);
  if (!existing) {
    existing = crypto.randomUUID();
    localStorage.setItem(key, existing);
  }
  return existing;
}

const CLIENT_ID = getOrCreateClientId();
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// ============================================================================
// AUTHENTICATION TYPES & DEMO USERS
// ============================================================================
type UserRole = "approver" | "user";

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

// Demo users - in production, this would come from a database
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  "approver@specpilot.io": {
    password: "approver123",
    user: {
      id: "user-approver-001",
      email: "approver@specpilot.io",
      name: "Alex Approver",
      role: "approver",
    },
  },
  "user@specpilot.io": {
    password: "user123",
    user: {
      id: "user-001",
      email: "user@specpilot.io",
      name: "Sam User",
      role: "user",
    },
  },
};

// Role-based access control
const ROLE_PERMISSIONS = {
  approver: {
    canAccessSettings: true,
    canAccessAuditLogs: true,
    canApproveSpecs: true,
    canEditValidationConfig: true,
    canManageIntegrations: true,
    canDeleteSpecs: true,
  },
  user: {
    canAccessSettings: false,
    canAccessAuditLogs: false,
    canApproveSpecs: false,
    canEditValidationConfig: false,
    canManageIntegrations: false,
    canDeleteSpecs: false,
  },
};

// ============================================================================
// ICON COMPONENTS (SVG-based, no emojis)
// ============================================================================
const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Specs: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  Agent: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ExternalLink: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  Loader: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
      <path d="M19 10l1 2 1-2 2-1-2-1-1-2-1 2-2 1 2 1z" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  XCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  Slack: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  ),
  Hash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  FileText: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  BarChart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Globe: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  Moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Sun: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Table: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  Code: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  FileJson: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2" />
      <path d="M8 17h2" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Template: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  Pdf: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10 12h4" />
      <path d="M10 16h4" />
      <path d="M8 12v4" />
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Trash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Lock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  LogOut: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Shield: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Mail: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
};

// ============================================================================
// VALIDATION SCORE COMPONENT (Traffic-light colors per PRD)
// ============================================================================
const ValidationScoreGauge = ({ score, size = "large" }: { score: number; size?: "large" | "small" }) => {
  // Traffic-light colors: red < 50, yellow 50-80, green > 80
  const getScoreColor = (s: number) => {
    if (s >= 80) return tokens.colors.validation.success;
    if (s >= 50) return tokens.colors.validation.warning;
    return tokens.colors.validation.error;
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Good";
    if (s >= 50) return "Needs Review";
    return "Issues Found";
  };

  const getScoreBgColor = (s: number) => {
    if (s >= 80) return "#dcfce7";
    if (s >= 50) return "#fef3c7";
    return "#fee2e2";
  };

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const bgColor = getScoreBgColor(score);
  const clampedScore = Math.max(0, Math.min(100, score));

  if (size === "small") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 60,
            height: 6,
            backgroundColor: tokens.colors.borderLight,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${clampedScore}%`,
              height: "100%",
              backgroundColor: color,
              borderRadius: 3,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 28 }}>{score}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        backgroundColor: bgColor,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${color}20`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text.primary }}>
            Validation Score
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: color,
              color: "#fff",
            }}
          >
            {label}
          </span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color }}>
          {score}
          <span style={{ fontSize: 14, fontWeight: 500, color: tokens.colors.text.muted }}>/100</span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 8,
          backgroundColor: `${color}30`,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clampedScore}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// COPY BUTTON COMPONENT - Reusable copy-to-clipboard with feedback
// ============================================================================
const CopyButton = ({ 
  text, 
  label = "Copy",
  size = "sm",
  style = {} 
}: { 
  text: string; 
  label?: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const padding = size === "sm" ? "4px 8px" : "8px 14px";
  const fontSize = size === "sm" ? 11 : 13;

  return (
    <button
      onClick={handleCopy}
      style={{
        padding,
        borderRadius: 4,
        border: "none",
        backgroundColor: copied ? "#16a34a" : "#374151",
        color: "#fff",
        fontSize,
        fontWeight: 500,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "background-color 0.2s",
        ...style,
      }}
    >
      {copied ? <Icons.Check /> : <Icons.Copy />}
      {copied ? "Copied!" : label}
    </button>
  );
};

// ============================================================================
// LOADING ANIMATION COMPONENT - "Analyzing intake..." per PRD
// ============================================================================
const LoadingAnimation = ({ step = 0 }: { step?: number }) => {
  const steps = [
    "Parsing intake request...",
    "Extracting events and properties...",
    "Validating against governance rules...",
    "Building canonical specification...",
    "Generating adapter outputs...",
  ];

  return (
    <div className="loading-container">
      {/* Animated dots */}
      <div className="loading-dots">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>

      {/* Main title */}
      <div className="loading-title">Analyzing intake...</div>

      {/* Subtitle */}
      <div className="loading-subtitle">
        SpecPilot is transforming your request into a structured specification
      </div>

      {/* Progress steps */}
      <div className="loading-steps">
        {steps.map((label, i) => {
          const isActive = i === step;
          const isComplete = i < step;

          return (
            <div
              key={i}
              className={`loading-step ${isActive ? "loading-step--active" : ""}`}
            >
              <div
                className={`loading-step-indicator ${
                  isComplete
                    ? "loading-step-indicator--complete"
                    : isActive
                    ? "loading-step-indicator--active"
                    : "loading-step-indicator--pending"
                }`}
              >
                {isComplete ? (
                  <Icons.Check />
                ) : isActive ? (
                  <span className="spinner" />
                ) : (
                  i + 1
                )}
              </div>

              <span
                className={`loading-step-label ${
                  isComplete
                    ? "loading-step-label--complete"
                    : isActive
                    ? "loading-step-label--active"
                    : "loading-step-label--pending"
                }`}
              >
                {label}
              </span>

              {isActive && <div className="loading-step-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// VALIDATION ISSUES LIST COMPONENT
// ============================================================================
// Note: currently unused; keep for future use but satisfy TS unused checks
const ValidationIssuesList = ({ validation }: { validation: any }) => {
  if (!validation) return null;

  const categories = [
    { key: "naming", label: "Naming Conventions" },
    { key: "fields", label: "Field Validation" },
    { key: "identity", label: "Identity Rules" },
    { key: "consent", label: "Consent & Privacy" },
    { key: "governance", label: "Governance" },
  ];

  const allIssues = categories.flatMap((cat) => {
    const issues = validation[cat.key] || [];
    return issues.map((issue: string) => ({ category: cat.label, issue }));
  });

  if (allIssues.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.text.secondary, marginBottom: 8 }}>
        Validation Notes:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {allIssues.slice(0, 5).map((item: any, i: number) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12,
              color: tokens.colors.text.secondary,
            }}
          >
            <span style={{ color: tokens.colors.validation.warning, flexShrink: 0, marginTop: 1 }}>
              <Icons.AlertTriangle />
            </span>
            <span>
              <span style={{ fontWeight: 500, color: tokens.colors.text.muted }}>{item.category}:</span>{" "}
              {item.issue}
            </span>
          </div>
        ))}
        {allIssues.length > 5 && (
          <div style={{ fontSize: 11, color: tokens.colors.text.muted, marginLeft: 22 }}>
            +{allIssues.length - 5} more issues
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SIMPLE MARKDOWN RENDERER (no external dependencies)
// ============================================================================
// Note: currently unused; keep for future use but satisfy TS unused checks
const SimpleMarkdown = ({ content, darkMode = false }: { content: string; darkMode?: boolean }) => {
  // Dynamic colors based on dark mode
  const colors = darkMode ? {
    textPrimary: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    background: "#0f172a",
    surface: "#1e293b",
    border: "#334155",
    borderLight: "#1e293b",
  } : {
    textPrimary: tokens.colors.text.primary,
    textSecondary: tokens.colors.text.secondary,
    textMuted: tokens.colors.text.muted,
    background: tokens.colors.background,
    surface: tokens.colors.surface,
    border: tokens.colors.border,
    borderLight: tokens.colors.borderLight,
  };

  // Format inline text (bold, code, etc.) - defined outside loop so it can be reused
  const formatInline = (text: string): (string | React.ReactElement)[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 600, color: colors.textPrimary }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ 
          backgroundColor: colors.background, 
          padding: '2px 6px', 
          borderRadius: 4,
          fontFamily: tokens.fonts.mono,
          fontSize: '0.9em',
          color: colors.textPrimary,
        }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushTable = () => {
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: colors.background }}>
                  {tableRows[0].map((cell, i) => (
                    <th key={i} style={{ 
                      padding: '10px 12px', 
                      textAlign: 'left', 
                      fontWeight: 600,
                      borderBottom: `2px solid ${colors.border}`,
                      color: colors.textPrimary,
                    }}>
                      {formatInline(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(2).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ 
                        padding: '10px 12px', 
                        borderBottom: `1px solid ${colors.borderLight}`,
                        color: colors.textSecondary,
                      }}>
                        {formatInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        const isCheckList = listItems.some(item => item.startsWith('[ ]') || item.startsWith('[x]'));
        elements.push(
          <ul key={`list-${elements.length}`} style={{ 
            margin: '8px 0 16px', 
            paddingLeft: isCheckList ? 0 : 24,
            listStyle: isCheckList ? 'none' : 'disc',
          }}>
            {listItems.map((item, i) => {
              const isChecked = item.startsWith('[x]');
              const isUnchecked = item.startsWith('[ ]');
              const text = item.replace(/^\[[ x]\]\s*/, '');
              return (
                <li key={i} style={{ 
                  marginBottom: 6, 
                  color: colors.textSecondary,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                  {(isChecked || isUnchecked) && (
                    <span style={{ 
                      width: 18, 
                      height: 18, 
                      borderRadius: 4, 
                      border: `2px solid ${isChecked ? tokens.colors.validation.success : colors.border}`,
                      backgroundColor: isChecked ? tokens.colors.validation.success : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {isChecked && <Icons.Check />}
                    </span>
                  )}
                  <span>{formatInline(text)}</span>
                </li>
              );
            })}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${elements.length}`} style={{
              backgroundColor: colors.background,
              padding: 16,
              borderRadius: tokens.radius.md,
              overflow: 'auto',
              fontSize: 12,
              fontFamily: tokens.fonts.mono,
              marginBottom: 16,
              color: colors.textPrimary,
            }}>
              {codeContent.join('\n')}
            </pre>
          );
          codeContent = [];
        }
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Tables
      if (line.includes('|') && line.trim().startsWith('|')) {
        flushList();
        inTable = true;
        const cells = line.split('|').filter(c => c.trim() !== '');
        if (!line.includes('---')) {
          tableRows.push(cells);
        }
        return;
      } else if (inTable && line.trim() === '') {
        flushTable();
        inTable = false;
      }

      // If we're in a table but hit a non-table line, flush
      if (inTable && !line.includes('|')) {
        flushTable();
        inTable = false;
      }

      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') {
        flushList();
        elements.push(
          <hr key={`hr-${elements.length}`} style={{ 
            border: 'none', 
            borderTop: `1px solid ${colors.border}`, 
            margin: '20px 0' 
          }} />
        );
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        flushList();
        flushTable();
        elements.push(
          <h1 key={`h1-${elements.length}`} style={{ 
            fontSize: 24, 
            fontWeight: 700, 
            marginTop: 0, 
            marginBottom: 12,
            color: colors.textPrimary,
          }}>
            {line.slice(2)}
          </h1>
        );
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        flushTable();
        elements.push(
          <h2 key={`h2-${elements.length}`} style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            marginTop: 24, 
            marginBottom: 12,
            color: colors.textPrimary,
          }}>
            {line.slice(3)}
          </h2>
        );
        return;
      }
      if (line.startsWith('### ')) {
        flushList();
        flushTable();
        elements.push(
          <h3 key={`h3-${elements.length}`} style={{ 
            fontSize: 15, 
            fontWeight: 600, 
            marginTop: 20, 
            marginBottom: 8,
            color: colors.textPrimary,
          }}>
            {line.slice(4)}
          </h3>
        );
        return;
      }
      if (line.startsWith('#### ')) {
        flushList();
        flushTable();
        elements.push(
          <h4 key={`h4-${elements.length}`} style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            marginTop: 16, 
            marginBottom: 8,
            color: colors.textSecondary,
          }}>
            {line.slice(5)}
          </h4>
        );
        return;
      }

      // List items
      if (line.match(/^[-*]\s/) || line.match(/^\[[ x]\]/)) {
        inList = true;
        listItems.push(line.replace(/^[-*]\s/, ''));
        return;
      } else if (inList && line.trim() === '') {
        flushList();
        inList = false;
        return;
      } else if (inList && !line.match(/^[-*]\s/)) {
        flushList();
        inList = false;
      }

      // Regular paragraph
      if (line.trim() !== '') {
        elements.push(
          <p key={`p-${elements.length}`} style={{ 
            margin: '8px 0', 
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            {formatInline(line)}
          </p>
        );
      }
    });

    // Flush any remaining content
    flushList();
    flushTable();

    return elements;
  };

  return (
    <div style={{ padding: 20 }}>
      {renderMarkdown(content)}
    </div>
  );
};

// ============================================================================
// CDP INDICATOR COMPONENT (colored squares instead of emojis)
// ============================================================================
const CdpIndicator = ({ type, size = 16 }: { type: string; size?: number }) => {
  const cdpConfig: Record<string, { color: string; letter: string }> = {
    segment: { color: "#52BD95", letter: "S" },
    tealium: { color: "#00B4E6", letter: "T" },
    mparticle: { color: "#FF6B35", letter: "m" },
    salesforce: { color: "#00A1E0", letter: "SF" },
    adobe: { color: "#FA0F00", letter: "A" },
  };

  const config = cdpConfig[type] || { color: "#94a3b8", letter: type?.charAt(0)?.toUpperCase() || "?" };

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        backgroundColor: config.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 6,
        fontSize: size * 0.45,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {config.letter}
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
function App() {
  // ============================================================================
  // AUTHENTICATION STATE
  // ============================================================================
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("specpilot_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Get permissions for current user
  const permissions = currentUser 
    ? ROLE_PERMISSIONS[currentUser.role] 
    : null;

  // Login handler
  const handleLogin = () => {
    setLoginError("");
    const userEntry = DEMO_USERS[loginEmail.toLowerCase()];
    
    if (!userEntry) {
      setLoginError("User not found. Try approver@specpilot.io or user@specpilot.io");
      return;
    }
    
    if (userEntry.password !== loginPassword) {
      setLoginError("Invalid password. Try approver123 or user123");
      return;
    }
    
    setCurrentUser(userEntry.user);
    localStorage.setItem("specpilot_user", JSON.stringify(userEntry.user));
    addAuditLog("User Login", `${userEntry.user.name} (${userEntry.user.role}) logged in`);
  };

  // Logout handler
  const handleLogout = () => {
    const userName = currentUser?.name;
    setCurrentUser(null);
    localStorage.removeItem("specpilot_user");
    setLoginEmail("");
    setLoginPassword("");
    if (userName) {
      // Note: This won't persist since user is logged out, but good for demo
      console.log(`${userName} logged out`);
    }
  };

  // Core state
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [canonical, setCanonical] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("draft");

  // Review / comments
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");

  // Spec management
  const [specId, setSpecId] = useState<string | null>(null);
  const [specIdInput, setSpecIdInput] = useState("");

  // Adapters
  const [segmentAdapter, setSegmentAdapter] = useState<any | null>(null);
  const [tealiumAdapter, setTealiumAdapter] = useState<any | null>(null);
  const [mparticleAdapter, setMparticleAdapter] = useState<any | null>(null);
  const [adapterTab, setAdapterTab] = useState<"segment" | "tealium" | "mparticle" | "salesforce">("segment");

  // Navigation - default based on role
  const [activeNav, setActiveNav] = useState<"dashboard" | "specs" | "agent" | "settings">("agent");

  // Jira
  const [selectedExportPersona, setSelectedExportPersona] = useState<string>("engineer");
  const [expandedSpecSections, setExpandedSpecSections] = useState<Set<string>>(new Set(["summary"]));
  
  const toggleSpecSection = (section: string) => {
    setExpandedSpecSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };
  
  const [jiraIssueUrl, setJiraIssueUrl] = useState<string | null>(null);

  // Settings – Slack
  const [slackWebhookInput, setSlackWebhookInput] = useState("");
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackStatus, setSlackStatus] = useState<string | null>(null);

  // Settings – Jira
  const [jiraBaseUrlInput, setJiraBaseUrlInput] = useState("");
  const [jiraEmailInput, setJiraEmailInput] = useState("");
  const [jiraApiTokenInput, setJiraApiTokenInput] = useState("");
  const [jiraProjectKeyInput, setJiraProjectKeyInput] = useState("");
  const [jiraSaving, setJiraSaving] = useState(false);
  const [jiraStatusMsg, setJiraStatusMsg] = useState<string | null>(null);

  // Specs list
  const [specList, setSpecList] = useState<any[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsFilter, setSpecsFilter] = useState<"all" | "draft" | "validated" | "approved">("all");
  const [specsSearch, setSpecsSearch] = useState("");

  // Slack Share
  const [showSlackPreview, setShowSlackPreview] = useState(false);
  const [slackSending, setSlackSending] = useState(false);
  const [slackSent, setSlackSent] = useState(false);

  // Open Questions Answers
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [specRegeneratedFeedback, setSpecRegeneratedFeedback] = useState(false);
  const [showAnswerInputs, setShowAnswerInputs] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Business Context
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [businessContext, setBusinessContext] = useState("");
  const [contextSource, setContextSource] = useState<"text" | "file" | "url">("text");
  const [contextUrl, setContextUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // Fetch context from URL
  const fetchContextFromUrl = async () => {
    if (!contextUrl) return;
    setFetchingUrl(true);
    try {
      const res = await fetch(`${API_BASE}/api/fetch-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: contextUrl }),
      });
      const data = await res.json();
      if (data.ok && data.content) {
        setBusinessContext(data.content);
      } else {
        alert(data.error || "Failed to fetch URL content");
      }
    } catch (err) {
      console.error("Error fetching URL:", err);
      alert("Failed to fetch URL content. Please try again or paste the content manually.");
    } finally {
      setFetchingUrl(false);
    }
  };

  // Dark Mode
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("specpilot_dark_mode");
    return saved === "true";
  });

  // Validation Config
  const [validationConfig, setValidationConfig] = useState({
    naming: {
      eventNameFormat: "Title Case",
      propertyNameFormat: "snake_case",
    },
    requiredFields: {
      allEvents: ["timestamp", "user_id"],
      cartEvents: ["item_id", "quantity"],
      purchaseEvents: ["order_id", "total", "currency"],
    },
    piiFields: ["email", "phone", "address", "ssn", "name", "first_name", "last_name"],
    consentRequired: true,
  });

  // CDP Integrations (enable/disable)
  const [cdpIntegrations, setCdpIntegrations] = useState(() => {
    const saved = localStorage.getItem("specpilot_cdp_integrations");
    return saved ? JSON.parse(saved) : {
      segment: { enabled: true, name: "Segment", color: "#52BD95" },
      tealium: { enabled: true, name: "Tealium", color: "#00A4E4" },
      mparticle: { enabled: true, name: "mParticle", color: "#FF6B35" },
      salesforce: { enabled: false, name: "Salesforce CDP", color: "#00A1E0", comingSoon: true },
      adobe: { enabled: false, name: "Adobe RTCDP", color: "#FF0000", comingSoon: true },
    };
  });

  // Export format modals
  const [showExportModal, setShowExportModal] = useState<"table" | "tracking-plan" | "snippets" | null>(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    action: string;
    details: string;
    specId?: string;
    specTitle?: string;
    timestamp: string;
    user: string;
  }>>(() => {
    const saved = localStorage.getItem("specpilot_audit_logs");
    return saved ? JSON.parse(saved) : [];
  });

  // Spec Templates
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Add audit log helper
  const addAuditLog = (action: string, details: string, specId?: string, specTitle?: string) => {
    const newLog = {
      id: crypto.randomUUID(),
      action,
      details,
      specId,
      specTitle,
      timestamp: new Date().toISOString(),
      user: currentUser?.email || "anonymous",
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 100); // Keep last 100 logs
      localStorage.setItem("specpilot_audit_logs", JSON.stringify(updated));
      return updated;
    });
  };

  // ==========================================================================
  // SPEC TEMPLATES
  // ==========================================================================
  const specTemplates = [
    {
      id: "ecommerce-cart",
      name: "E-commerce: Add to Cart",
      category: "E-commerce",
      description: "Track when users add items to their shopping cart",
      intake: "Track when a user adds a product to their shopping cart. Capture product ID, product name, price, quantity, category, and cart total. Include user ID for identity stitching. This should integrate with our analytics platform and marketing tools for retargeting.",
    },
    {
      id: "ecommerce-purchase",
      name: "E-commerce: Purchase Complete",
      category: "E-commerce",
      description: "Track successful purchase transactions",
      intake: "Track when a user completes a purchase. Capture order ID, total amount, currency, payment method, items purchased (with product ID, name, quantity, price for each), shipping method, and any discount codes applied. Include user ID and email for order confirmation.",
    },
    {
      id: "ecommerce-checkout",
      name: "E-commerce: Checkout Started",
      category: "E-commerce",
      description: "Track when users begin the checkout process",
      intake: "Track when a user starts the checkout process. Capture cart value, number of items, cart ID, and user ID. We want to measure checkout funnel conversion rates.",
    },
    {
      id: "saas-signup",
      name: "SaaS: User Signup",
      category: "SaaS",
      description: "Track new user registrations",
      intake: "Track when a new user signs up for our platform. Capture email, signup method (email, Google, SSO), referral source, UTM parameters, selected plan, and timestamp. This is critical for measuring acquisition funnel performance.",
    },
    {
      id: "saas-feature",
      name: "SaaS: Feature Usage",
      category: "SaaS",
      description: "Track feature adoption and usage",
      intake: "Track when users interact with key features in our app. Capture feature name, action type (view, click, submit), duration of interaction, success/failure status, and any relevant feature-specific properties. Include user ID and account ID.",
    },
    {
      id: "saas-subscription",
      name: "SaaS: Subscription Change",
      category: "SaaS",
      description: "Track plan upgrades, downgrades, and cancellations",
      intake: "Track subscription changes including upgrades, downgrades, and cancellations. Capture previous plan, new plan, change reason, MRR impact, user ID, and account ID. Important for revenue analytics and churn analysis.",
    },
    {
      id: "media-video",
      name: "Media: Video Playback",
      category: "Media",
      description: "Track video watching behavior",
      intake: "Track video playback events including play, pause, complete, and progress milestones (25%, 50%, 75%). Capture video ID, video title, duration, current position, playback quality, and whether it's a live stream. Include user ID for personalization.",
    },
    {
      id: "media-content",
      name: "Media: Content Engagement",
      category: "Media",
      description: "Track article and content consumption",
      intake: "Track when users engage with content. Capture content ID, title, category, author, read time, scroll depth percentage, and engagement actions (like, share, comment, bookmark). Include user ID and session ID.",
    },
    {
      id: "mobile-app",
      name: "Mobile: App Lifecycle",
      category: "Mobile",
      description: "Track app open, background, and close events",
      intake: "Track mobile app lifecycle events: app opened, app backgrounded, app closed. Capture app version, OS version, device model, session duration, and notification permission status. Include device ID and user ID if logged in.",
    },
    {
      id: "marketing-form",
      name: "Marketing: Form Submission",
      category: "Marketing",
      description: "Track lead capture form submissions",
      intake: "Track when users submit marketing forms (contact us, demo request, newsletter signup). Capture form name, form fields submitted (excluding sensitive data), submission source page, UTM parameters, and timestamp. Need this for lead attribution.",
    },
  ];

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Load spec list on mount and when navigating to agent/specs view
  useEffect(() => {
    loadSpecList();
    
    // Load saved validation config
    const loadValidationConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/validation-config`, {
          headers: { "X-Client-Id": CLIENT_ID },
        });
        const data = await res.json();
        if (data.ok && data.config) {
          setValidationConfig(data.config);
        }
      } catch (err) {
        console.log("No saved validation config");
      }
    };
    loadValidationConfig();
  }, []);

  // Reload spec list when navigating to specs or agent view
  useEffect(() => {
    if (activeNav === "specs" || activeNav === "agent" || activeNav === "dashboard") {
      loadSpecList();
    }
  }, [activeNav]);

  // Dark mode persistence
  useEffect(() => {
    localStorage.setItem("specpilot_dark_mode", darkMode.toString());
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ==========================================================================
  // THEME TOKENS (Dynamic based on dark mode)
  // ==========================================================================
  const theme = darkMode ? {
    colors: {
      primary: "#3b82f6",
      primaryHover: "#2563eb",
      background: "#0f172a",
      surface: "#1e293b",
      surfaceHover: "#334155",
      border: "#334155",
      borderLight: "#1e293b",
      text: {
        primary: "#f1f5f9",
        secondary: "#94a3b8",
        muted: "#64748b",
      },
      status: tokens.colors.status,
      validation: tokens.colors.validation,
    },
    fonts: tokens.fonts,
    radius: tokens.radius,
  } : tokens;

  // ==========================================================================
  // API FUNCTIONS
  // ==========================================================================

  async function generateSpec() {
    if (!input.trim()) return;

    setLoading(true);
    setLoadingStep(0);
    setResult("");
    setCanonical(null);
    setCopied(false);
    setSegmentAdapter(null);
    setTealiumAdapter(null);
    setMparticleAdapter(null);
    setSpecId(null);
    setComments([]);
    setJiraIssueUrl(null);

    // Build the full input with context if available
    const fullInput = businessContext 
      ? `BUSINESS CONTEXT:\n${businessContext}\n\n---\n\nINTAKE REQUEST:\n${input}`
      : input;

    // Include validation config context
    const inputWithConfig = `${fullInput}

---
VALIDATION RULES:
- Event Name Format: ${validationConfig.naming.eventNameFormat}
- Property Name Format: ${validationConfig.naming.propertyNameFormat}
- Required fields for all events: ${validationConfig.requiredFields.allEvents.join(", ")}
- Required fields for cart events: ${validationConfig.requiredFields.cartEvents.join(", ")}
- Required fields for purchase events: ${validationConfig.requiredFields.purchaseEvents.join(", ")}
- PII Fields: ${validationConfig.piiFields.join(", ")}
- Consent Required for PII: ${validationConfig.consentRequired ? "Yes" : "No"}`;

    try {
      // Step 0: Parsing intake request
      setLoadingStep(0);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Step 1: Extracting events and properties
      setLoadingStep(1);
      const specRes = await fetch(`${API_BASE}/api/specpilot/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputWithConfig }),
      });
      
      // Step 2: Validating against governance rules
      setLoadingStep(2);
      const canonicalRes = await fetch(`${API_BASE}/api/specpilot/canonical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputWithConfig }),
      });
      
      // Step 3: Building canonical specification
      setLoadingStep(3);
      const specData = await specRes.json();
      const canonicalData = await canonicalRes.json();

      let markdownSpec = "";
      if (specData.ok) {
        markdownSpec = specData.spec;
        setResult(markdownSpec);
      } else {
        setResult("Error: " + specData.error);
      }

      // Step 4: Generating adapter outputs
      setLoadingStep(4);
      const adaptersRes = await fetch(`${API_BASE}/api/specpilot/adapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputWithConfig }),
      });
      const adaptersData = await adaptersRes.json();

      if (canonicalData.ok && canonicalData.canonicalSpec) {
        const canonicalSpec = canonicalData.canonicalSpec;
        setCanonical(canonicalSpec);
        setReviewStatus(canonicalSpec?.metadata?.status || "draft");

        // Auto-save
        try {
          const saveRes = await fetch(`${API_BASE}/api/specpilot/save`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Client-Id": CLIENT_ID,
            },
            body: JSON.stringify({ 
              canonicalSpec, 
              markdownSpec,
              title: canonicalSpec.metadata?.title || "Untitled Spec",
              createdBy: currentUser?.name || "Unknown",
            }),
          });

          const saveData = await saveRes.json();
          if (saveData.ok && saveData.stored) {
            setSpecId(saveData.stored.id);
            setSpecIdInput(saveData.stored.id);
            setReviewStatus(saveData.stored.status || "draft");
            setComments(saveData.stored.comments || []);
            
            // Audit log
            addAuditLog(
              "Spec Created",
              `Generated new specification from intake request`,
              saveData.stored.id,
              canonicalSpec.metadata?.title || "Untitled"
            );
          }
        } catch (err) {
          console.error("Save failed:", err);
        }
      }

      if (adaptersData.ok) {
        setSegmentAdapter(adaptersData.segment);
        setTealiumAdapter(adaptersData.tealium);
        setMparticleAdapter(adaptersData.mparticle);
      }
    } catch (error) {
      console.error(error);
      setResult("Error contacting backend.");
    }

    setLoading(false);
    setLoadingStep(0);
  }

  async function regenerateWithAnswers() {
    if (!canonical?.open_questions?.length) return;
    
    // Build enhanced input with original + answers
    const answersContext = canonical.open_questions
      .map((q: string, i: number) => {
        const answer = questionAnswers[i];
        return answer ? `Q: ${q}\nA: ${answer}` : null;
      })
      .filter(Boolean)
      .join("\n\n");
    
    if (!answersContext) {
      alert("Please provide at least one answer before regenerating.");
      return;
    }

    const enhancedInput = `${input}

ADDITIONAL CLARIFICATIONS:
${answersContext}

Please incorporate these answers into the specification and remove the answered questions from open_questions.`;

    setRegenerating(true);

    try {
      // Generate new canonical spec with enhanced input
      const [specRes, canonicalRes] = await Promise.all([
        fetch(`${API_BASE}/api/specpilot/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: enhancedInput }),
        }),
        fetch(`${API_BASE}/api/specpilot/canonical`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: enhancedInput }),
        }),
      ]);

      const specData = await specRes.json();
      const canonicalData = await canonicalRes.json();

      if (specData.ok) {
        setResult(specData.spec);
      }

      if (canonicalData.ok && canonicalData.canonicalSpec) {
        setCanonical(canonicalData.canonicalSpec);

        // Regenerate adapters
        const adaptersRes = await fetch(`${API_BASE}/api/specpilot/adapters-from-canonical`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonicalSpec: canonicalData.canonicalSpec }),
        });
        const adaptersData = await adaptersRes.json();

        if (adaptersData.ok) {
          setSegmentAdapter(adaptersData.segment);
          setTealiumAdapter(adaptersData.tealium);
          setMparticleAdapter(adaptersData.mparticle);
        }

        // Save the updated spec with answers in comments
        if (specId) {
          try {
            const saveRes = await fetch(`${API_BASE}/api/specpilot/save`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Client-Id": CLIENT_ID,
              },
              body: JSON.stringify({
                canonicalSpec: canonicalData.canonicalSpec,
                status: "draft",
                commentText: `📝 Spec regenerated with clarifications:\n\n${answersContext}`,
                author: currentUser?.name || "Unknown",
                markdownSpec: specData.spec,
                title: canonicalData.canonicalSpec?.metadata?.title || "Untitled Spec",
                createdBy: currentUser?.name || "Unknown",
              }),
            });
            const saveData = await saveRes.json();
            if (saveData.ok && saveData.stored) {
              setSpecId(saveData.stored.id);
              setReviewStatus(saveData.stored.status);
              setComments(saveData.stored.comments || []);
            }
          } catch (err) {
            console.error("Save failed:", err);
          }
        }

        // Clear answers and close input mode
        setQuestionAnswers({});
        setShowAnswerInputs(false);
        
        // Show success feedback
        setSpecRegeneratedFeedback(true);
        setTimeout(() => setSpecRegeneratedFeedback(false), 3000);
      }
    } catch (error) {
      console.error(error);
      alert("Error regenerating spec.");
    }

    setRegenerating(false);
  }

  async function loadSpecById(idOverride?: string) {
    const idToLoad = (idOverride ?? specIdInput).trim();
    if (!idToLoad) {
      alert("Enter a Spec ID to load.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/specpilot/spec/${idToLoad}`, {
        headers: { "X-Client-Id": CLIENT_ID },
      });
      const data = await res.json();

      if (!data.ok || !data.stored) {
        alert(data.error || "Spec not found");
        return;
      }

      const stored = data.stored;
      setCanonical(stored.canonicalSpec);
      setReviewStatus(stored.status || "draft");
      setComments(stored.comments || []);
      setSpecId(stored.id);
      setSpecIdInput(stored.id);
      setResult(stored.markdownSpec || "");

      // Rebuild adapters
      try {
        const adaptersRes = await fetch(`${API_BASE}/api/specpilot/adapters-from-canonical`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonicalSpec: stored.canonicalSpec }),
        });
        const adaptersData = await adaptersRes.json();
        if (adaptersData.ok) {
          setSegmentAdapter(adaptersData.segment);
          setTealiumAdapter(adaptersData.tealium);
          setMparticleAdapter(adaptersData.mparticle);
        }
      } catch (err) {
        console.error("Error loading adapters:", err);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading spec");
    }
  }

  // Status type for the workflow
  type SpecStatus = "draft" | "pending_approval" | "changes_requested" | "validated" | "approved";

  async function handleReview(status: SpecStatus) {
    if (!specId) {
      alert("No spec loaded. Generate or load a spec first.");
      return;
    }

    // Frontend permission check
    // Users can only: request approval (pending_approval) or go back to draft
    // Approvers can: validate, approve, request changes, or return to draft
    const approverOnlyStatuses = ["validated", "approved", "changes_requested"];
    if (approverOnlyStatuses.includes(status) && !permissions?.canApproveSpecs) {
      alert("Permission denied. Only Approvers can perform this action.");
      return;
    }

    // Users can only request approval from draft or changes_requested
    if (status === "pending_approval" && !["draft", "changes_requested"].includes(reviewStatus)) {
      alert("Can only request approval for draft or revised specs.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/specpilot/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": CLIENT_ID,
        },
        body: JSON.stringify({
          id: specId,
          status,
          commentText: commentText.trim() || undefined,
          author: currentUser?.name || "Unknown",
          userRole: currentUser?.role || "user",
        }),
      });

      const data = await res.json();
      
      if (data.error === "PERMISSION_DENIED") {
        alert("Permission denied. Only Approvers can perform this action.");
        return;
      }
      
      if (data.ok && data.stored) {
        setReviewStatus(data.stored.status);
        setComments(data.stored.comments || []);
        setCommentText("");
        
        // Audit log
        const actionMap: Record<SpecStatus, string> = {
          draft: "Returned to Draft",
          pending_approval: "Approval Requested",
          changes_requested: "Changes Requested",
          validated: "Spec Validated",
          approved: "Spec Approved",
        };
        addAuditLog(
          actionMap[status],
          commentText.trim() ? `${actionMap[status]}: "${commentText.trim()}"` : actionMap[status],
          specId,
          canonical?.metadata?.title || "Untitled"
        );
      } else {
        alert(data.error || "Failed to update review");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating review");
    }
  }

  async function handleCreateJira() {
    if (!specId) {
      alert("No spec loaded.");
      return;
    }

    try {
      setJiraCreating(true);
      setJiraIssueUrl(null);

      const res = await fetch(`${API_BASE}/api/specpilot/jira-ticket/${specId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": CLIENT_ID,
        },
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Failed to create Jira issue");
        return;
      }
      setJiraIssueUrl(data.url);
      
      // Audit log
      addAuditLog(
        "Jira Issue Created",
        `Created Jira issue: ${data.url}`,
        specId,
        canonical?.metadata?.title || "Untitled"
      );
    } catch (err) {
      console.error(err);
      alert("Error calling Jira API");
    } finally {
      setJiraCreating(false);
    }
  }

  async function handleSendToSlack() {
    if (!specId || !canonical) {
      alert("No spec loaded.");
      return;
    }

    try {
      setSlackSending(true);
      
      // Build the Slack message
      const title = canonical.metadata?.title || "Untitled Spec";
      const summary = canonical.metadata?.summary || "";
      const eventCount = canonical.events?.length || 0;
      const avgScore = canonical.events?.length > 0 
        ? Math.round(canonical.events.reduce((sum: number, evt: any) => sum + (evt.validation?.overall_score || 0), 0) / canonical.events.length)
        : 0;
      
      const res = await fetch(`${API_BASE}/api/specpilot/slack-share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": CLIENT_ID,
        },
        body: JSON.stringify({
          specId,
          title,
          summary,
          status: reviewStatus,
          eventCount,
          validationScore: avgScore,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Failed to send to Slack");
        return;
      }
      
      // Audit log
      addAuditLog(
        "Shared to Slack",
        `Spec shared to configured Slack channel`,
        specId,
        canonical?.metadata?.title || "Untitled"
      );
      
      setSlackSent(true);
      setTimeout(() => {
        setSlackSent(false);
        setShowSlackPreview(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("Error sending to Slack");
    } finally {
      setSlackSending(false);
    }
  }

  async function handleSaveSlack() {
    setSlackStatus(null);
    if (!slackWebhookInput.trim()) {
      setSlackStatus("Please enter a Slack webhook URL.");
      return;
    }

    try {
      setSlackSaving(true);
      const res = await fetch(`${API_BASE}/api/integrations/slack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": CLIENT_ID,
        },
        body: JSON.stringify({ webhookUrl: slackWebhookInput.trim() }),
      });

      const data = await res.json();
      setSlackStatus(data.ok ? "Slack integration connected successfully." : data.error || "Failed to connect.");
    } catch (e) {
      console.error(e);
      setSlackStatus("Error connecting Slack.");
    } finally {
      setSlackSaving(false);
    }
  }

  async function handleSaveJira() {
    setJiraStatusMsg(null);
    if (!jiraBaseUrlInput.trim() || !jiraEmailInput.trim() || !jiraApiTokenInput.trim() || !jiraProjectKeyInput.trim()) {
      setJiraStatusMsg("Please fill all Jira fields.");
      return;
    }

    try {
      setJiraSaving(true);
      const res = await fetch(`${API_BASE}/api/integrations/jira`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": CLIENT_ID,
        },
        body: JSON.stringify({
          baseUrl: jiraBaseUrlInput.trim(),
          email: jiraEmailInput.trim(),
          apiToken: jiraApiTokenInput.trim(),
          projectKey: jiraProjectKeyInput.trim(),
        }),
      });

      const data = await res.json();
      setJiraStatusMsg(data.ok ? "Jira integration saved successfully." : data.error || "Failed to save.");
    } catch (e) {
      console.error(e);
      setJiraStatusMsg("Error connecting Jira.");
    } finally {
      setJiraSaving(false);
    }
  }

  async function loadSpecList() {
    setSpecsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/specpilot/specs`, {
        headers: { "X-Client-Id": CLIENT_ID },
      });
      const data = await res.json();
      if (data.ok) {
        setSpecList(data.specs || []);
      }
    } catch (e) {
      console.error("Failed to load specs:", e);
    } finally {
      setSpecsLoading(false);
    }
  }

  async function copySpec() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function clearAll() {
    setInput("");
    setResult("");
    setCanonical(null);
    setCopied(false);
    setReviewStatus("draft");
    setSegmentAdapter(null);
    setTealiumAdapter(null);
    setMparticleAdapter(null);
    setSpecId(null);
    setSpecIdInput("");
    setComments([]);
    setCommentText("");
    setJiraIssueUrl(null);
    setQuestionAnswers({});
    setShowAnswerInputs(false);
  }

  // ==========================================================================
  // EXPORT HELPERS
  // ==========================================================================

  // Generate Table Format (HTML)
  const generateTableExport = () => {
    if (!canonical) return "";
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${canonical.metadata?.title || "CDP Spec"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #1e293b; border-bottom: 2px solid #0071dc; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f1f5f9; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-weight: 600; }
    td { padding: 12px; border: 1px solid #e2e8f0; }
    tr:hover { background: #f8fafc; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-required { background: #fee2e2; color: #dc2626; }
    .badge-optional { background: #f1f5f9; color: #64748b; }
    .badge-pii { background: #fef3c7; color: #d97706; }
  </style>
</head>
<body>
  <h1>${canonical.metadata?.title || "CDP Specification"}</h1>
  <p>${canonical.metadata?.summary || ""}</p>
  
  <h2>Events</h2>
  <table>
    <thead>
      <tr>
        <th>Event Name</th>
        <th>Description</th>
        <th>Trigger</th>
        <th>Properties</th>
      </tr>
    </thead>
    <tbody>
      ${(canonical.events || []).map((e: any) => `
      <tr>
        <td><strong>${e.name}</strong></td>
        <td>${e.description || ""}</td>
        <td>${e.trigger || ""}</td>
        <td>${(e.properties || []).map((p: any) => `<code>${p.name}</code>`).join(", ")}</td>
      </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>Properties Detail</h2>
  <table>
    <thead>
      <tr>
        <th>Property</th>
        <th>Type</th>
        <th>Required</th>
        <th>PII Level</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${(canonical.events || []).flatMap((e: any) => (e.properties || []).map((p: any) => `
      <tr>
        <td><code>${p.name}</code></td>
        <td>${p.type}</td>
        <td><span class="badge ${p.required ? 'badge-required' : 'badge-optional'}">${p.required ? 'Required' : 'Optional'}</span></td>
        <td>${p.pii?.classification !== 'none' ? `<span class="badge badge-pii">${p.pii?.classification || 'none'}</span>` : 'None'}</td>
        <td>${p.description || ""}</td>
      </tr>
      `)).join("")}
    </tbody>
  </table>

  <h2>Destinations</h2>
  <table>
    <thead>
      <tr>
        <th>Destination</th>
        <th>Requirements</th>
      </tr>
    </thead>
    <tbody>
      ${(canonical.destinations || []).map((d: any) => `
      <tr>
        <td>${d.name}</td>
        <td>${(d.requirements || []).join(", ")}</td>
      </tr>
      `).join("")}
    </tbody>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
    Generated by SpecPilot on ${new Date().toLocaleString()}
  </footer>
</body>
</html>`;
    return html;
  };

  // Generate Segment Tracking Plan JSON
  const generateTrackingPlan = () => {
    if (!canonical) return null;
    
    const trackingPlan = {
      name: canonical.metadata?.title || "Tracking Plan",
      display_name: canonical.metadata?.title || "Tracking Plan",
      rules: {
        events: (canonical.events || []).map((e: any) => ({
          name: e.name,
          description: e.description || "",
          rules: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: (e.properties || []).reduce((acc: any, p: any) => {
              acc[p.name] = {
                type: p.type === "number" ? "number" : p.type === "boolean" ? "boolean" : "string",
                description: p.description || "",
              };
              return acc;
            }, {}),
            required: (e.properties || []).filter((p: any) => p.required).map((p: any) => p.name),
          },
        })),
        global: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: {
            context: { type: "object" },
            traits: { type: "object" },
          },
        },
        identify: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: {},
        },
        group: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: {},
        },
      },
    };
    
    return trackingPlan;
  };

  // Generate Instrumentation Snippets
  const generateSnippets = () => {
    if (!canonical || !canonical.events?.length) return null;
    
    const event = canonical.events[0];
    const eventName = event.name;
    const props = event.properties || [];
    
    const snippets = {
      javascript: `// JavaScript (Analytics.js)
analytics.track("${eventName}", {
${props.map((p: any) => `  ${p.name}: ${p.type === 'string' ? '"value"' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '{}'},`).join('\n')}
});`,

      react: `// React with useAnalytics hook
import { useAnalytics } from '@segment/analytics-react';

function TrackButton() {
  const { track } = useAnalytics();
  
  const handle${eventName.replace(/\s+/g, '')} = () => {
    track("${eventName}", {
${props.map((p: any) => `      ${p.name}: ${p.type === 'string' ? '"value"' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '{}'},`).join('\n')}
    });
  };
  
  return <button onClick={handle${eventName.replace(/\s+/g, '')}}>Track</button>;
}`,

      node: `// Node.js
const Analytics = require('analytics-node');
const analytics = new Analytics('YOUR_WRITE_KEY');

analytics.track({
  userId: 'user_123',
  event: '${eventName}',
  properties: {
${props.map((p: any) => `    ${p.name}: ${p.type === 'string' ? '"value"' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '{}'},`).join('\n')}
  }
});`,

      swift: `// Swift (iOS)
Analytics.shared().track("${eventName}", properties: [
${props.map((p: any) => `    "${p.name}": ${p.type === 'string' ? '"value"' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '[:]'},`).join('\n')}
])`,

      kotlin: `// Kotlin (Android)
Analytics.with(context).track("${eventName}", Properties()
${props.map((p: any) => `    .putValue("${p.name}", ${p.type === 'string' ? '"value"' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : 'mapOf<String, Any>()'})`).join('\n')}
)`,

      python: `# Python
import analytics

analytics.track('user_123', '${eventName}', {
${props.map((p: any) => `    '${p.name}': ${p.type === 'string' ? "'value'" : p.type === 'number' ? '0' : p.type === 'boolean' ? 'True' : '{}'},`).join('\n')}
})`,
    };
    
    return snippets;
  };

  // Generate PDF Export (opens print dialog)
  const generatePdfExport = () => {
    if (!canonical) return;
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${canonical.metadata?.title || "CDP Spec"} - SpecPilot</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      padding: 40px; 
      max-width: 800px; 
      margin: 0 auto; 
      color: #1e293b;
      line-height: 1.6;
    }
    h1 { 
      color: #0071dc; 
      border-bottom: 3px solid #0071dc; 
      padding-bottom: 12px; 
      margin-bottom: 8px;
      font-size: 28px;
    }
    .subtitle { color: #64748b; margin-bottom: 30px; font-size: 14px; }
    h2 { 
      color: #1e293b; 
      margin-top: 30px; 
      margin-bottom: 16px;
      font-size: 18px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    h3 { color: #334155; margin-top: 20px; font-size: 16px; }
    .summary { 
      background: #f8fafc; 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 24px;
      border-left: 4px solid #0071dc;
    }
    .event { 
      background: #fff; 
      border: 1px solid #e2e8f0; 
      border-radius: 8px; 
      padding: 20px; 
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .event-name { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
    .event-trigger { font-size: 13px; color: #64748b; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: 600; }
    td { padding: 10px 12px; border: 1px solid #e2e8f0; }
    .badge { 
      display: inline-block; 
      padding: 3px 10px; 
      border-radius: 12px; 
      font-size: 11px; 
      font-weight: 500; 
    }
    .badge-success { background: #dcfce7; color: #16a34a; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-error { background: #fee2e2; color: #dc2626; }
    .score { 
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    .score-good { background: #dcfce7; color: #16a34a; }
    .score-warning { background: #fef3c7; color: #d97706; }
    .score-bad { background: #fee2e2; color: #dc2626; }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e2e8f0; 
      color: #64748b; 
      font-size: 11px;
      display: flex;
      justify-content: space-between;
    }
    .destinations { display: flex; gap: 8px; flex-wrap: wrap; }
    .destination { 
      padding: 6px 12px; 
      background: #f1f5f9; 
      border-radius: 6px; 
      font-size: 13px;
    }
    code { 
      font-family: 'SF Mono', monospace; 
      background: #f1f5f9; 
      padding: 2px 6px; 
      border-radius: 4px; 
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>${canonical.metadata?.title || "CDP Specification"}</h1>
  <div class="subtitle">Generated by SpecPilot • ${new Date().toLocaleDateString()}</div>
  
  <div class="summary">
    <strong>Summary:</strong> ${canonical.metadata?.summary || "No summary available."}
  </div>

  <h2>Events (${canonical.events?.length || 0})</h2>
  ${(canonical.events || []).map((e: any) => {
    const score = e.validation?.overall_score || 0;
    const scoreClass = score >= 80 ? 'score-good' : score >= 50 ? 'score-warning' : 'score-bad';
    return `
    <div class="event">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="event-name">${e.name}</div>
        <span class="score ${scoreClass}">${score}/100</span>
      </div>
      <div class="event-trigger"><strong>Trigger:</strong> ${e.trigger || 'Not specified'}</div>
      <div style="margin-bottom: 12px;">${e.description || ''}</div>
      
      <h4 style="margin: 16px 0 8px; font-size: 13px; color: #64748b;">Properties</h4>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Type</th>
            <th>Required</th>
            <th>PII</th>
          </tr>
        </thead>
        <tbody>
          ${(e.properties || []).map((p: any) => `
          <tr>
            <td><code>${p.name}</code></td>
            <td>${p.type}</td>
            <td>${p.required ? '<span class="badge badge-success">Yes</span>' : '<span class="badge">No</span>'}</td>
            <td>${p.pii?.classification !== 'none' && p.pii?.classification ? `<span class="badge badge-warning">${p.pii.classification}</span>` : '—'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `}).join('')}

  <h2>Destinations</h2>
  <div class="destinations">
    ${(canonical.destinations || []).map((d: any) => `<div class="destination">${d.name}</div>`).join('')}
  </div>

  ${canonical.acceptance_criteria?.length ? `
  <h2>Acceptance Criteria</h2>
  <ul>
    ${canonical.acceptance_criteria.map((c: string) => `<li>${c}</li>`).join('')}
  </ul>
  ` : ''}

  ${canonical.open_questions?.length ? `
  <h2>Open Questions</h2>
  <ul>
    ${canonical.open_questions.map((q: string) => `<li>${q}</li>`).join('')}
  </ul>
  ` : ''}

  <div class="footer">
    <div>Spec ID: ${specId || 'N/A'}</div>
    <div>Status: ${reviewStatus}</div>
    <div>SpecPilot</div>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
    
    // Audit log
    addAuditLog(
      "PDF Exported",
      "Spec exported as PDF",
      specId || undefined,
      canonical?.metadata?.title || "Untitled"
    );
  };

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  const getStatusStyle = (status: string) => {
    return tokens.colors.status[status as keyof typeof tokens.colors.status] || tokens.colors.status.draft;
  };

  // ==========================================================================
  // RENDER: DASHBOARD VIEW
  // ==========================================================================
  const renderDashboardView = () => {
    const totalSpecs = specList?.length || 0;
    const draftCount = specList?.filter((s) => s.status === "draft").length || 0;
    const pendingCount = specList?.filter((s) => s.status === "pending_approval").length || 0;
    const validatedCount = specList?.filter((s) => s.status === "validated").length || 0;
    const approvedCount = specList?.filter((s) => s.status === "approved").length || 0;

    // Calculate weekly changes
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const getWeeklyChange = (filterFn?: (s: any) => boolean) => {
      const thisWeek = specList?.filter((s) => {
        const dateStr = s.createdAt || s.updatedAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= oneWeekAgo && (filterFn ? filterFn(s) : true);
      }).length || 0;

      const lastWeek = specList?.filter((s) => {
        const dateStr = s.createdAt || s.updatedAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= twoWeeksAgo && d < oneWeekAgo && (filterFn ? filterFn(s) : true);
      }).length || 0;

      if (lastWeek === 0) return thisWeek > 0 ? 100 : 0;
      return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    };

    const totalChange = getWeeklyChange();
    const approvedChange = getWeeklyChange((s) => s.status === "approved");

    const statsData = [
      { label: "Total Specs", value: totalSpecs, color: tokens.colors.primary, change: totalChange, bg: darkMode ? "rgba(59,130,246,0.1)" : "#eff6ff" },
      { label: "Draft", value: draftCount, color: "#64748b", bg: darkMode ? "rgba(100,116,139,0.1)" : "#f8fafc" },
      { label: "Validated", value: validatedCount, color: "#d97706", bg: darkMode ? "rgba(217,119,6,0.1)" : "#fffbeb" },
      { label: "Approved", value: approvedCount, color: "#16a34a", change: approvedChange, bg: darkMode ? "rgba(22,163,74,0.1)" : "#f0fdf4" },
    ];

    return (
      <div style={{ padding: 32 }}>
        {/* Hero Section with Search */}
        <div style={{ 
          textAlign: "center", 
          marginBottom: 40,
          padding: "20px 0",
        }}>
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: theme.colors.text.primary,
            marginBottom: 8,
          }}>
            Welcome to SpecPilot
          </h1>
          <p style={{ 
            fontSize: 15, 
            color: theme.colors.text.muted,
            marginBottom: 24,
          }}>
            Transform your tracking requirements into structured CDP specifications
          </p>
          
          {/* Search Bar */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: 700,
                padding: "14px 20px",
                borderRadius: 28,
                border: `2px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.primary;
                e.currentTarget.style.boxShadow = "0 6px 28px rgba(59,130,246,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06)";
              }}
            >
              <Icons.Search />
              <input
                type="text"
                placeholder="Describe your tracking needs... e.g. 'Track checkout funnel'"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setInput(val);
                      setActiveNav("agent");
                    }
                  }
                }}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  backgroundColor: "transparent",
                  color: theme.colors.text.primary,
                  fontSize: 15,
                }}
              />
              <button
                onClick={() => setActiveNav("agent")}
                style={{
                  padding: "10px 22px",
                  borderRadius: 20,
                  border: "none",
                  backgroundColor: tokens.colors.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.primaryHover;
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.primary;
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Icons.Sparkles /> Generate
              </button>
            </div>
          </div>
          
          {/* Suggestion Chips */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {["Track checkout funnel", "User signup flow", "Add to cart events", "Search behavior"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                  setActiveNav("agent");
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 16,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: "transparent",
                  color: theme.colors.text.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                  e.currentTarget.style.borderColor = tokens.colors.primary;
                  e.currentTarget.style.color = tokens.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.text.muted;
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {statsData.map((stat: any) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: stat.bg,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${theme.colors.border}`,
                padding: "20px 24px",
                transition: "all 0.2s ease",
                cursor: "default",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ 
                position: "absolute", 
                top: -10, 
                right: -10, 
                fontSize: 64, 
                opacity: 0.08,
                fontWeight: 700,
                color: stat.color,
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: stat.color, marginBottom: 4, position: "relative" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: stat.change !== undefined ? 10 : 0 }}>
                {stat.label}
              </div>
              {stat.change !== undefined && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: stat.change >= 0 
                      ? (darkMode ? "rgba(22,163,74,0.3)" : "#dcfce7")
                      : (darkMode ? "rgba(239,68,68,0.3)" : "#fee2e2"),
                    color: stat.change >= 0 ? "#16a34a" : "#dc2626",
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {stat.change >= 0 ? "↑" : "↓"} {Math.abs(stat.change)}%
                  </span>
                  <span style={{ fontSize: 10, color: theme.colors.text.muted }}>vs last week</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pending Actions Card - Approvers Only */}
        {permissions?.canApproveSpecs && pendingCount > 0 && (
          <div
            style={{
              backgroundColor: darkMode ? "#1e3a5f" : "#eff6ff",
              borderRadius: tokens.radius.lg,
              border: `1px solid ${darkMode ? "#3b82f6" : "#bfdbfe"}`,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
                  {pendingCount} specs awaiting your review
                </div>
                <div style={{ fontSize: 13, color: theme.colors.text.muted }}>
                  Review and approve pending specifications
                </div>
              </div>
              <button
                onClick={() => setActiveNav("settings")}
                style={{
                  padding: "10px 20px",
                  borderRadius: tokens.radius.md,
                  border: "none",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Review All
              </button>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          {/* Recent Specs */}
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${theme.colors.border}`,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${theme.colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: theme.colors.text.primary, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.Specs /> Recent Specs
              </h3>
              <button
                onClick={() => setActiveNav("specs")}
                style={{
                  padding: "6px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: "transparent",
                  color: tokens.colors.primary,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.primary;
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = tokens.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = tokens.colors.primary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                View All <Icons.ChevronRight />
              </button>
            </div>

            {specList.length === 0 ? (
              <div style={{ padding: 50, textAlign: "center", color: theme.colors.text.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No specs yet</div>
                <div style={{ fontSize: 12 }}>Create your first specification to get started</div>
              </div>
            ) : (
              <div>
                {specList.slice(0, 5).map((spec: any, idx: number) => (
                  <div
                    key={spec.id}
                    onClick={() => { setActiveNav("agent"); loadSpecById(spec.id); }}
                    style={{
                      padding: "14px 20px",
                      borderBottom: idx < Math.min(specList.length, 5) - 1 ? `1px solid ${theme.colors.borderLight}` : "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.background;
                      e.currentTarget.style.paddingLeft = "24px";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.paddingLeft = "20px";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {spec.title || spec.canonicalSpec?.metadata?.title || "Untitled Spec"}
                      </div>
                      <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 3 }}>
                        {spec.updatedAt ? new Date(spec.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                        backgroundColor: tokens.colors.status[spec.status as keyof typeof tokens.colors.status]?.bg || "#f3f4f6",
                        color: tokens.colors.status[spec.status as keyof typeof tokens.colors.status]?.text || "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      {({
                        draft: "Draft",
                        pending_approval: "Pending",
                        changes_requested: "Changes",
                        validated: "Validated",
                        approved: "Approved",
                      } as Record<string, string>)[spec.status] || spec.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Quick Actions */}
            <div
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${theme.colors.border}`,
                padding: 20,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: theme.colors.text.primary, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.Sparkles /> Quick Actions
              </h3>
              <button
                onClick={() => setActiveNav("agent")}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: tokens.radius.md,
                  border: "none",
                  backgroundColor: tokens.colors.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.primaryHover;
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.primary;
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Icons.Plus /> New Spec
              </button>
              <button
                onClick={() => setActiveNav("specs")}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: "transparent",
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                  e.currentTarget.style.borderColor = tokens.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <Icons.Specs /> Browse Specs
              </button>
            </div>

            {/* Supported CDPs */}
            <div
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${theme.colors.border}`,
                padding: 20,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: theme.colors.text.primary, display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.Settings /> Supported CDPs
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "Segment", type: "segment", active: true },
                  { name: "Tealium", type: "tealium", active: true },
                  { name: "mParticle", type: "mparticle", active: true },
                  { name: "Salesforce CDP", type: "salesforce", active: false },
                ].map((cdp) => (
                  <div
                    key={cdp.name}
                    style={{
                      padding: "10px 12px",
                      borderRadius: tokens.radius.md,
                      backgroundColor: cdp.active ? (darkMode ? "rgba(22,163,74,0.1)" : "#f0fdf4") : (darkMode ? "rgba(100,116,139,0.1)" : "#f8fafc"),
                      border: `1px solid ${cdp.active ? "#bbf7d0" : theme.colors.border}`,
                      fontSize: 13,
                      fontWeight: 500,
                      color: cdp.active ? "#166534" : theme.colors.text.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <CdpIndicator type={cdp.type} size={20} />
                      {cdp.name}
                    </span>
                    {!cdp.active && (
                      <span style={{ 
                        fontSize: 10, 
                        padding: "2px 8px", 
                        borderRadius: 10,
                        backgroundColor: darkMode ? "rgba(100,116,139,0.2)" : "#e2e8f0",
                        color: theme.colors.text.muted,
                      }}>
                        Coming Soon
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: AGENT VIEW
  // ==========================================================================
  const renderAgentView = () => {
    const statusStyle = getStatusStyle(reviewStatus);

    return (
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Load Spec Card */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter Spec ID to load..."
              value={specIdInput}
              onChange={(e) => setSpecIdInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary,
                fontSize: 14,
                fontFamily: tokens.fonts.mono,
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && loadSpecById()}
            />
            <button
              onClick={() => loadSpecById()}
              style={{
                padding: "10px 20px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text.primary,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Load Spec
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: "10px 20px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text.secondary,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
          {specId && (
            <div style={{ marginTop: 12, fontSize: 13, color: theme.colors.text.secondary }}>
              Current Spec ID: <code style={{ fontFamily: tokens.fonts.mono, backgroundColor: theme.colors.background, padding: "2px 6px", borderRadius: 4 }}>{specId}</code>
            </div>
          )}
        </div>

        {/* Recent Requests - Show only when no spec is loaded */}
        {!result && !canonical && specList.length > 0 && (
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${theme.colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: theme.colors.text.primary }}>
                Recent Requests
              </h3>
              <button
                onClick={() => setActiveNav("specs")}
                style={{
                  padding: "6px 12px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.secondary,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                View All
              </button>
            </div>
            <div style={{ padding: "8px 0" }}>
              {specList.slice(0, 5).map((spec) => (
                <div
                  key={spec.id}
                  onClick={() => {
                    setSpecIdInput(spec.id);
                    loadSpecById(spec.id);
                  }}
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.background)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor:
                          spec.status === "approved"
                            ? tokens.colors.validation.success
                            : spec.status === "validated"
                            ? tokens.colors.validation.warning
                            : theme.colors.text.muted,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text.primary }}>
                        {spec.title || "Untitled Spec"}
                      </div>
                      <div style={{ fontSize: 12, color: theme.colors.text.muted, marginTop: 2 }}>
                        {new Date(spec.updatedAt).toLocaleDateString()} · {({
                          draft: "Draft",
                          pending_approval: "Pending",
                          changes_requested: "Changes",
                          validated: "Validated",
                          approved: "Approved",
                        } as Record<string, string>)[spec.status] || spec.status}
                      </div>
                    </div>
                  </div>
                  <Icons.ChevronRight />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intake Form - Contains Business Context + Intake Request */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
              Intake Request
            </h3>
            <button
              onClick={() => setShowTemplateModal(true)}
              style={{
                padding: "8px 14px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text.primary,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icons.Template /> Use Template
            </button>
          </div>

          {/* Business Context - Collapsible inside Intake */}
          <div
            style={{
              marginBottom: 16,
              borderRadius: tokens.radius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setShowContextPanel(!showContextPanel)}
              style={{
                width: "100%",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icons.Info />
                <span style={{ fontSize: 13, fontWeight: 500, color: theme.colors.text.primary }}>
                  Business Context
                </span>
                {businessContext && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: tokens.colors.validation.success + "20",
                      color: tokens.colors.validation.success,
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    Added
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: theme.colors.text.muted }}>
                <span style={{ fontSize: 11 }}>
                  {showContextPanel ? "Hide" : "Optional: Add context for better specs"}
                </span>
                {showContextPanel ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
              </div>
            </button>

            {showContextPanel && (
              <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${theme.colors.border}` }}>
                <p style={{ margin: "12px 0", fontSize: 12, color: theme.colors.text.muted }}>
                  Provide context about your company, industry, or specific requirements.
                </p>

                {/* Context Source Tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[
                    { id: "text", label: "Type", icon: <Icons.Edit /> },
                    { id: "file", label: "Upload", icon: <Icons.Upload /> },
                    { id: "url", label: "URL", icon: <Icons.Globe /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setContextSource(tab.id as any)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${contextSource === tab.id ? tokens.colors.primary : theme.colors.border}`,
                        backgroundColor: contextSource === tab.id ? tokens.colors.primary + "10" : "transparent",
                        color: contextSource === tab.id ? tokens.colors.primary : theme.colors.text.secondary,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Text Input */}
                {contextSource === "text" && (
                  <textarea
                    placeholder="E.g., We are a B2B SaaS company in fintech. Our platform handles sensitive financial data..."
                    value={businessContext}
                    onChange={(e) => setBusinessContext(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 10,
                      borderRadius: tokens.radius.sm,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text.primary,
                      fontSize: 13,
                      fontFamily: tokens.fonts.base,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {/* File Upload */}
                {contextSource === "file" && (
                  <div
                    style={{
                      padding: 20,
                      border: `2px dashed ${theme.colors.border}`,
                      borderRadius: tokens.radius.md,
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => document.getElementById("context-file-input")?.click()}
                  >
                    <input
                      id="context-file-input"
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setBusinessContext(ev.target?.result as string || "");
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <Icons.Upload />
                    <div style={{ marginTop: 8, fontSize: 12, color: theme.colors.text.muted }}>
                      Click to upload (.txt, .md, .pdf, .doc)
                    </div>
                  </div>
                )}

                {/* URL Input */}
                {contextSource === "url" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="url"
                      placeholder="https://docs.yourcompany.com/context"
                      value={contextUrl}
                      onChange={(e) => setContextUrl(e.target.value)}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text.primary,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={fetchContextFromUrl}
                      disabled={!contextUrl || fetchingUrl}
                      style={{
                        padding: "10px 16px",
                        borderRadius: tokens.radius.sm,
                        border: "none",
                        backgroundColor: !contextUrl || fetchingUrl ? theme.colors.text.muted : tokens.colors.primary,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: !contextUrl || fetchingUrl ? "not-allowed" : "pointer",
                      }}
                    >
                      {fetchingUrl ? "Fetching..." : "Fetch"}
                    </button>
                  </div>
                )}

                {/* Context Preview */}
                {businessContext && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 11, color: theme.colors.text.muted }}>
                        Preview ({businessContext.length} chars)
                      </span>
                      <button
                        onClick={() => setBusinessContext("")}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "none",
                          backgroundColor: "transparent",
                          color: tokens.colors.validation.error,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div style={{
                      padding: 10,
                      backgroundColor: theme.colors.surface,
                      borderRadius: tokens.radius.sm,
                      fontSize: 12,
                      color: theme.colors.text.secondary,
                      maxHeight: 60,
                      overflow: "hidden",
                      border: `1px solid ${theme.colors.border}`,
                    }}>
                      {businessContext.slice(0, 200)}{businessContext.length > 200 ? "..." : ""}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Intake Textarea */}
          <textarea
            placeholder="Describe your CDP tracking requirement... e.g., 'We want to track checkout events with cart value, items, and user identity for our e-commerce funnel.'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              width: "100%",
              minHeight: 120,
              padding: 14,
              borderRadius: tokens.radius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text.primary,
              fontSize: 14,
              fontFamily: tokens.fonts.base,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ marginTop: 16 }}>
            <button
              onClick={generateSpec}
              disabled={loading || !input.trim()}
              style={{
                padding: "12px 24px",
                borderRadius: tokens.radius.md,
                border: "none",
                backgroundColor: loading || !input.trim() ? theme.colors.text.muted : tokens.colors.primary,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loading ? <><Icons.Loader /> Generating...</> : "Generate Spec"}
            </button>
          </div>
        </div>

        {/* Loading Animation */}
        {loading && (
          <LoadingAnimation step={loadingStep} />
        )}

        {/* Results Section - Single Column Layout */}
        {!loading && canonical && (
          <>
            {/* Unified Spec Card */}
            <div style={{ 
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${theme.colors.border}`,
              overflow: "hidden",
            }}>
              {/* Regeneration Success Banner */}
              {specRegeneratedFeedback && (
                <div style={{
                  padding: "12px 24px",
                  backgroundColor: darkMode ? "#14532d" : "#dcfce7",
                  borderBottom: `1px solid ${darkMode ? "#22c55e" : "#86efac"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: darkMode ? "#86efac" : "#166534",
                  fontSize: 14,
                  fontWeight: 500,
                }}>
                  <Icons.CheckCircle />
                  <span>Spec successfully regenerated with your clarifications!</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>Answers saved to comments</span>
                </div>
              )}
              
              {/* Spec Header with Stats */}
              <div style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${theme.colors.border}`,
                background: darkMode 
                  ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" 
                  : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: theme.colors.text.primary }}>
                        {canonical?.metadata?.title || "Generated Specification"}
                      </h2>
                      <span style={{
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}>
                        {reviewStatus}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: theme.colors.text.secondary, lineHeight: 1.6 }}>
                      {canonical?.metadata?.summary || "AI-generated tracking specification based on your intake request."}
                    </p>
                  </div>
                  <button
                    onClick={copySpec}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text.primary,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    {copied ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy</>}
                  </button>
                </div>
                
                {/* Quick Stats Bar */}
                <div style={{ 
                  display: "flex", 
                  gap: 24, 
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: `1px solid ${theme.colors.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: 6, 
                      backgroundColor: "#8b5cf620",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#8b5cf6",
                    }}>
                      <Icons.Code />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.text.primary }}>{canonical.events?.length || 0}</div>
                      <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Events</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: 6, 
                      backgroundColor: "#06b6d420",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#06b6d4",
                    }}>
                      <Icons.Send />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.text.primary }}>{canonical.destinations?.length || 0}</div>
                      <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Destinations</div>
                    </div>
                  </div>
                  {canonical.events?.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: 6, 
                        backgroundColor: Math.round(canonical.events.reduce((sum: number, evt: any) => sum + (evt.validation?.overall_score || 0), 0) / canonical.events.length) >= 80 ? "#10b98120" : "#f59e0b20",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: Math.round(canonical.events.reduce((sum: number, evt: any) => sum + (evt.validation?.overall_score || 0), 0) / canonical.events.length) >= 80 ? "#10b981" : "#f59e0b",
                      }}>
                        <Icons.CheckCircle />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.text.primary }}>
                          {Math.round(canonical.events.reduce((sum: number, evt: any) => sum + (evt.validation?.overall_score || 0), 0) / canonical.events.length)}%
                        </div>
                        <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Quality</div>
                      </div>
                    </div>
                  )}
                  {canonical.open_questions?.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: 6, 
                        backgroundColor: "#f59e0b20",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#f59e0b",
                      }}>
                        <Icons.AlertTriangle />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.text.primary }}>{canonical.open_questions.length}</div>
                        <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Questions</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Accordion Sections Container */}
              <div style={{ padding: "12px" }}>
                
                {/* Summary Section */}
                {canonical.metadata && (
                  <div style={{ 
                    marginBottom: 8,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${expandedSpecSections.has("summary") ? tokens.colors.primary + "40" : theme.colors.border}`,
                    backgroundColor: expandedSpecSections.has("summary") ? (darkMode ? "#1e3a5f" : "#eff6ff") : theme.colors.surface,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => toggleSpecSection("summary")}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: tokens.colors.primary + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: tokens.colors.primary,
                        }}>
                          <Icons.FileText />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>Summary</div>
                          <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                            {canonical.metadata.title || "Spec overview"}
                          </div>
                        </div>
                      </div>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: 6,
                        backgroundColor: theme.colors.background,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.colors.text.muted,
                        transition: "transform 0.2s ease",
                        transform: expandedSpecSections.has("summary") ? "rotate(180deg)" : "rotate(0deg)",
                      }}>
                        <Icons.ChevronDown />
                      </div>
                    </button>
                    {expandedSpecSections.has("summary") && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ 
                          padding: 16, 
                          backgroundColor: theme.colors.surface, 
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${theme.colors.border}`,
                        }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: theme.colors.text.primary, marginBottom: 8 }}>
                            {canonical.metadata.title || "Untitled Spec"}
                          </div>
                          <div style={{ fontSize: 14, color: theme.colors.text.secondary, lineHeight: 1.6 }}>
                            {canonical.metadata.summary || "No summary provided."}
                          </div>
                          {canonical.events?.length > 0 && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.colors.border}` }}>
                              <ValidationScoreGauge 
                                score={
                                  Math.round(
                                    canonical.events.reduce((sum: number, evt: any) => 
                                      sum + (evt.validation?.overall_score || 0), 0
                                    ) / canonical.events.length
                                  ) || 0
                                } 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Events Section */}
                {canonical.events?.length > 0 && (
                  <div style={{ 
                    marginBottom: 8,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${expandedSpecSections.has("events") ? "#8b5cf6" + "40" : theme.colors.border}`,
                    backgroundColor: expandedSpecSections.has("events") ? (darkMode ? "#2e1065" : "#faf5ff") : theme.colors.surface,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => toggleSpecSection("events")}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "#8b5cf6" + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#8b5cf6",
                        }}>
                          <Icons.Code />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>Events & Properties</div>
                          <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                            {canonical.events.length} event{canonical.events.length !== 1 ? "s" : ""} defined
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ 
                          padding: "4px 10px", 
                          borderRadius: 12, 
                          backgroundColor: "#8b5cf6" + "20", 
                          fontSize: 12, 
                          fontWeight: 600,
                          color: "#8b5cf6",
                        }}>
                          {canonical.events.length}
                        </span>
                        <div style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 6,
                          backgroundColor: theme.colors.background,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: theme.colors.text.muted,
                          transition: "transform 0.2s ease",
                          transform: expandedSpecSections.has("events") ? "rotate(180deg)" : "rotate(0deg)",
                        }}>
                          <Icons.ChevronDown />
                        </div>
                      </div>
                    </button>
                    {expandedSpecSections.has("events") && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {canonical.events.map((evt: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: 14,
                                backgroundColor: theme.colors.surface,
                                borderRadius: tokens.radius.md,
                                border: `1px solid ${theme.colors.border}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ 
                                  fontSize: 14, 
                                  fontWeight: 600, 
                                  color: theme.colors.text.primary,
                                  fontFamily: tokens.fonts.mono,
                                }}>
                                  {evt.name}
                                </div>
                                {evt.validation?.overall_score !== undefined && (
                                  <ValidationScoreGauge score={evt.validation.overall_score} size="small" />
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: theme.colors.text.secondary, marginBottom: 8 }}>
                                {evt.description}
                              </div>
                              <div style={{ 
                                fontSize: 12, 
                                color: theme.colors.text.muted,
                                padding: "6px 10px",
                                backgroundColor: theme.colors.background,
                                borderRadius: 6,
                                display: "inline-block",
                              }}>
                                ⚡ {evt.trigger}
                              </div>
                              {evt.properties?.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Properties ({evt.properties.length})
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {evt.properties.map((prop: any, j: number) => (
                                      <span
                                        key={j}
                                        style={{
                                          padding: "5px 10px",
                                          backgroundColor: theme.colors.background,
                                          border: `1px solid ${theme.colors.border}`,
                                          borderRadius: 6,
                                          fontSize: 12,
                                          fontFamily: tokens.fonts.mono,
                                          color: theme.colors.text.primary,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                      >
                                        <span style={{ fontWeight: 500 }}>{prop.name}</span>
                                        <span style={{ color: theme.colors.text.muted, fontSize: 11 }}>{prop.type}</span>
                                        {prop.required && <span style={{ color: tokens.colors.validation.error, fontSize: 10 }}>●</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Destinations Section */}
                {canonical.destinations?.length > 0 && (
                  <div style={{ 
                    marginBottom: 8,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${expandedSpecSections.has("destinations") ? "#06b6d4" + "40" : theme.colors.border}`,
                    backgroundColor: expandedSpecSections.has("destinations") ? (darkMode ? "#083344" : "#ecfeff") : theme.colors.surface,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => toggleSpecSection("destinations")}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "#06b6d4" + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#06b6d4",
                        }}>
                          <Icons.Send />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>Destinations</div>
                          <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                            {canonical.destinations.length} destination{canonical.destinations.length !== 1 ? "s" : ""} configured
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ 
                          padding: "4px 10px", 
                          borderRadius: 12, 
                          backgroundColor: "#06b6d4" + "20", 
                          fontSize: 12, 
                          fontWeight: 600,
                          color: "#06b6d4",
                        }}>
                          {canonical.destinations.length}
                        </span>
                        <div style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 6,
                          backgroundColor: theme.colors.background,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: theme.colors.text.muted,
                          transition: "transform 0.2s ease",
                          transform: expandedSpecSections.has("destinations") ? "rotate(180deg)" : "rotate(0deg)",
                        }}>
                          <Icons.ChevronDown />
                        </div>
                      </div>
                    </button>
                    {expandedSpecSections.has("destinations") && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {canonical.destinations.map((dest: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: "10px 16px",
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: tokens.radius.md,
                                fontSize: 13,
                                fontWeight: 500,
                                color: theme.colors.text.primary,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <CdpIndicator type={dest.name?.toLowerCase()} />
                              {dest.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Acceptance Criteria Section */}
                {canonical.acceptance_criteria?.length > 0 && (
                  <div style={{ 
                    marginBottom: 8,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${expandedSpecSections.has("acceptance") ? "#10b981" + "40" : theme.colors.border}`,
                    backgroundColor: expandedSpecSections.has("acceptance") ? (darkMode ? "#052e16" : "#ecfdf5") : theme.colors.surface,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => toggleSpecSection("acceptance")}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "#10b981" + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#10b981",
                        }}>
                          <Icons.CheckCircle />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>Acceptance Criteria</div>
                          <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                            {canonical.acceptance_criteria.length} criteria to verify
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ 
                          padding: "4px 10px", 
                          borderRadius: 12, 
                          backgroundColor: "#10b981" + "20", 
                          fontSize: 12, 
                          fontWeight: 600,
                          color: "#10b981",
                        }}>
                          {canonical.acceptance_criteria.length}
                        </span>
                        <div style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 6,
                          backgroundColor: theme.colors.background,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: theme.colors.text.muted,
                          transition: "transform 0.2s ease",
                          transform: expandedSpecSections.has("acceptance") ? "rotate(180deg)" : "rotate(0deg)",
                        }}>
                          <Icons.ChevronDown />
                        </div>
                      </div>
                    </button>
                    {expandedSpecSections.has("acceptance") && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {canonical.acceptance_criteria.map((ac: string, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: "10px 14px",
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: tokens.radius.md,
                                fontSize: 13,
                                color: theme.colors.text.secondary,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <span style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: 4,
                                border: `2px solid ${theme.colors.border}`,
                                flexShrink: 0,
                                marginTop: 1,
                              }} />
                              {ac}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Open Questions Section */}
                {canonical.open_questions?.length > 0 && (
                  <div style={{ 
                    marginBottom: 8,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${expandedSpecSections.has("questions") ? "#f59e0b" + "40" : theme.colors.border}`,
                    backgroundColor: expandedSpecSections.has("questions") ? (darkMode ? "#451a03" : "#fffbeb") : theme.colors.surface,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => toggleSpecSection("questions")}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "#f59e0b" + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#f59e0b",
                        }}>
                          <Icons.AlertTriangle />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>Open Questions</div>
                          <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                            {canonical.open_questions.length} item{canonical.open_questions.length !== 1 ? "s" : ""} need clarification
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ 
                          padding: "4px 10px", 
                          borderRadius: 12, 
                          backgroundColor: "#f59e0b" + "20", 
                          fontSize: 12, 
                          fontWeight: 600,
                          color: "#f59e0b",
                        }}>
                          {canonical.open_questions.length}
                        </span>
                        <div style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 6,
                          backgroundColor: theme.colors.background,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: theme.colors.text.muted,
                          transition: "transform 0.2s ease",
                          transform: expandedSpecSections.has("questions") ? "rotate(180deg)" : "rotate(0deg)",
                        }}>
                          <Icons.ChevronDown />
                        </div>
                      </div>
                    </button>
                    {expandedSpecSections.has("questions") && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                          <button
                            onClick={() => setShowAnswerInputs(!showAnswerInputs)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: showAnswerInputs ? tokens.colors.primary : theme.colors.background,
                              color: showAnswerInputs ? "#fff" : theme.colors.text.secondary,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Edit />
                            {showAnswerInputs ? "Done Editing" : "Answer Questions"}
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {canonical.open_questions.map((q: string, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: 14,
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: tokens.radius.md,
                              }}
                            >
                              <div style={{ 
                                display: "flex", 
                                alignItems: "flex-start", 
                                gap: 10,
                                color: darkMode ? "#fcd34d" : "#92400e", 
                                fontSize: 14,
                                marginBottom: showAnswerInputs || questionAnswers[i] ? 12 : 0,
                              }}>
                                <span style={{ 
                                  width: 22, 
                                  height: 22, 
                                  borderRadius: "50%",
                                  backgroundColor: "#f59e0b" + "20",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#f59e0b",
                                  flexShrink: 0,
                                }}>
                                  {i + 1}
                                </span>
                                <span style={{ color: theme.colors.text.primary }}>{q}</span>
                              </div>
                              {showAnswerInputs && (
                                <div style={{ marginLeft: 32 }}>
                                  <textarea
                                    placeholder="Type your answer here..."
                                    value={questionAnswers[i] || ""}
                                    onChange={(e) => setQuestionAnswers(prev => ({
                                      ...prev,
                                      [i]: e.target.value
                                    }))}
                                    style={{
                                      width: "100%",
                                      minHeight: 70,
                                      padding: 12,
                                      borderRadius: tokens.radius.md,
                                      border: `1px solid ${theme.colors.border}`,
                                      backgroundColor: theme.colors.background,
                                      color: theme.colors.text.primary,
                                      fontSize: 13,
                                      fontFamily: tokens.fonts.base,
                                      resize: "vertical",
                                      outline: "none",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                  {questionAnswers[i] && (
                                    <div style={{ 
                                      marginTop: 6, 
                                      fontSize: 11, 
                                      color: tokens.colors.validation.success,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}>
                                      <Icons.Check /> Answer saved
                                    </div>
                                  )}
                                </div>
                              )}
                              {!showAnswerInputs && questionAnswers[i] && (
                                <div style={{ 
                                  marginLeft: 32,
                                  padding: 12,
                                  backgroundColor: darkMode ? "#14532d" : "#dcfce7",
                                  border: `1px solid ${darkMode ? "#22c55e" : "#86efac"}`,
                                  borderRadius: tokens.radius.md,
                                  fontSize: 13,
                                  color: darkMode ? "#86efac" : "#166534",
                                }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, textTransform: "uppercase", opacity: 0.7 }}>
                                    Your Answer
                                  </div>
                                  {questionAnswers[i]}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {showAnswerInputs && Object.keys(questionAnswers).length > 0 && (
                          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={async () => {
                                const answersText = canonical.open_questions
                                  .map((q: string, i: number) => 
                                    questionAnswers[i] 
                                      ? `Q: ${q}\nA: ${questionAnswers[i]}` 
                                      : null
                                  )
                                  .filter(Boolean)
                                  .join("\n\n");
                                
                                if (answersText && specId) {
                                  try {
                                    const res = await fetch(`${API_BASE}/api/specpilot/save`, {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        "X-Client-Id": CLIENT_ID,
                                      },
                                      body: JSON.stringify({
                                        id: specId,
                                        canonicalSpec: canonical,
                                        status: reviewStatus,
                                        commentText: `📋 Answers to Open Questions:\n\n${answersText}`,
                                        author: currentUser?.name || "Unknown",
                                        markdownSpec: result,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (data.ok && data.stored) {
                                      setComments(data.stored.comments || []);
                                      setShowAnswerInputs(false);
                                      addAuditLog("Q&A Comment Added", `Answers to ${Object.keys(questionAnswers).length} questions saved`);
                                    }
                                  } catch (err) {
                                    console.error("Failed to save comment:", err);
                                    // Fallback to comment text field
                                    setCommentText(`📋 Answers to Open Questions:\n\n${answersText}`);
                                    setShowAnswerInputs(false);
                                  }
                                } else if (answersText) {
                                  // No specId yet, just populate the comment field
                                  setCommentText(`📋 Answers to Open Questions:\n\n${answersText}`);
                                  setShowAnswerInputs(false);
                                }
                              }}
                              style={{
                                padding: "10px 16px",
                                borderRadius: tokens.radius.md,
                                border: "none",
                                backgroundColor: "#16a34a",
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Icons.Check /> Save Answers as Comment
                            </button>
                            <button
                              onClick={regenerateWithAnswers}
                              disabled={regenerating}
                              style={{
                                padding: "10px 16px",
                                borderRadius: tokens.radius.md,
                                border: "none",
                                backgroundColor: tokens.colors.primary,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: regenerating ? "not-allowed" : "pointer",
                                opacity: regenerating ? 0.7 : 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {regenerating ? (
                                <><Icons.Loader /> Regenerating...</>
                              ) : (
                                <><Icons.Refresh /> Regenerate with Answers</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
              {/* End of Accordion Container */}
            </div>
            {/* End of Unified Spec Card */}

            {/* Review Panel */}
            {specId && (
              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${theme.colors.border}`,
                  padding: 20,
                }}
              >
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: theme.colors.text.primary }}>
                  Review & Approval
                </h3>

                {/* Comment input */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ 
                    display: "block", 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: theme.colors.text.secondary, 
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>
                    Add Comment
                  </label>
                  <textarea
                    placeholder="Add a comment for the approver (e.g., answers to questions, clarifications, decisions made)..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 12,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontFamily: tokens.fonts.base,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {commentText.trim() && (
                    <button
                      onClick={async () => {
                        if (!commentText.trim()) return;
                        try {
                          const res = await fetch(`${API_BASE}/api/specpilot/save`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "X-Client-Id": CLIENT_ID,
                            },
                            body: JSON.stringify({
                              id: specId,
                              canonicalSpec: canonical,
                              status: reviewStatus,
                              commentText: commentText.trim(),
                              author: currentUser?.name || "Unknown",
                              markdownSpec: result,
                            }),
                          });
                          const data = await res.json();
                          if (data.ok && data.stored) {
                            setComments(data.stored.comments || []);
                            setCommentText("");
                            addAuditLog("Comment Added", `Comment added to spec ${specId}`);
                          }
                        } catch (err) {
                          console.error("Failed to add comment:", err);
                        }
                      }}
                      style={{
                        marginTop: 8,
                        padding: "8px 16px",
                        borderRadius: tokens.radius.md,
                        border: "none",
                        backgroundColor: tokens.colors.primary,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icons.Send /> Add Comment
                    </button>
                  )}
                </div>

                {/* Review buttons - Different for Users vs Approvers */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  
                  {/* Status Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: theme.colors.text.muted }}>Current Status:</span>
                    <span style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      backgroundColor: tokens.colors.status[reviewStatus as keyof typeof tokens.colors.status]?.bg || "#f3f4f6",
                      color: tokens.colors.status[reviewStatus as keyof typeof tokens.colors.status]?.text || "#6b7280",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}>
                      {reviewStatus === "pending_approval" 
                        ? (permissions?.canApproveSpecs ? "Pending Approval" : "Requested Approval")
                        : reviewStatus === "changes_requested" 
                          ? "Changes Requested"
                          : reviewStatus}
                    </span>
                  </div>

                  {/* USER ACTIONS */}
                  {!permissions?.canApproveSpecs && (
                    <div style={{ display: "flex", gap: 12 }}>
                      {/* Request Approval - only for draft or changes_requested */}
                      {(reviewStatus === "draft" || reviewStatus === "changes_requested") && (
                        <button
                          onClick={() => handleReview("pending_approval")}
                          style={{
                            flex: 1,
                            padding: "12px 20px",
                            borderRadius: tokens.radius.md,
                            border: "none",
                            backgroundColor: "#2563eb",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
                        >
                          <Icons.Send /> {reviewStatus === "changes_requested" ? "Resubmit for Approval" : "Request Approval"}
                        </button>
                      )}
                      
                      {/* Waiting message for pending */}
                      {reviewStatus === "pending_approval" && (
                        <div style={{
                          flex: 1,
                          padding: "12px 20px",
                          borderRadius: tokens.radius.md,
                          backgroundColor: darkMode ? "#1e3a5f" : "#dbeafe",
                          color: "#2563eb",
                          fontSize: 14,
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}>
                          <Icons.Clock /> Awaiting Approver Review
                        </div>
                      )}
                      
                      {/* Validated/Approved - view only */}
                      {(reviewStatus === "validated" || reviewStatus === "approved") && (
                        <div style={{
                          flex: 1,
                          padding: "12px 20px",
                          borderRadius: tokens.radius.md,
                          backgroundColor: tokens.colors.status[reviewStatus as keyof typeof tokens.colors.status]?.bg,
                          color: tokens.colors.status[reviewStatus as keyof typeof tokens.colors.status]?.text,
                          fontSize: 14,
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}>
                          <Icons.CheckCircle /> Spec {reviewStatus === "validated" ? "Validated" : "Approved"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* APPROVER ACTIONS */}
                  {permissions?.canApproveSpecs && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {/* Request Changes */}
                      <button
                        onClick={() => {
                          if (!commentText.trim()) {
                            alert("Please add a comment explaining what changes are needed.");
                            return;
                          }
                          handleReview("changes_requested");
                        }}
                        style={{
                          padding: "10px 20px",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.colors.status.changes_requested.text}`,
                          backgroundColor: reviewStatus === "changes_requested" ? tokens.colors.status.changes_requested.bg : "transparent",
                          color: tokens.colors.status.changes_requested.text,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Icons.Edit /> Request Changes
                      </button>
                      
                      {/* Validate */}
                      <button
                        onClick={() => handleReview("validated")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: tokens.radius.md,
                          border: "none",
                          backgroundColor: reviewStatus === "validated" ? tokens.colors.status.validated.text : tokens.colors.status.validated.bg,
                          color: reviewStatus === "validated" ? "#fff" : tokens.colors.status.validated.text,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Icons.Check /> Validate
                      </button>
                      
                      {/* Approve */}
                      <button
                        onClick={() => handleReview("approved")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: tokens.radius.md,
                          border: "none",
                          backgroundColor: reviewStatus === "approved" ? tokens.colors.status.approved.text : tokens.colors.status.approved.bg,
                          color: reviewStatus === "approved" ? "#fff" : tokens.colors.status.approved.text,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Icons.CheckCircle /> Approve
                      </button>
                    </div>
                  )}
                </div>

                {/* Comments list */}
                {comments.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Comments & History ({comments.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {comments.map((c: any, i: number) => {
                        // Determine comment type for styling
                        const isSystemComment = c.author === "system" || c.text?.includes("Spec regenerated");
                        const isQuestionAnswer = c.text?.includes("Open Questions") || c.text?.includes("Q:") && c.text?.includes("A:");
                        const isStatusChange = c.text?.includes("Status changed");
                        
                        return (
                          <div
                            key={i}
                            style={{
                              padding: 14,
                              backgroundColor: isQuestionAnswer 
                                ? (darkMode ? "#1e3a5f" : "#eff6ff")
                                : isSystemComment 
                                  ? (darkMode ? "#374151" : "#f3f4f6")
                                  : theme.colors.background,
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${isQuestionAnswer 
                                ? (darkMode ? "#3b82f6" : "#bfdbfe")
                                : theme.colors.borderLight}`,
                              borderLeft: isQuestionAnswer 
                                ? `3px solid #3b82f6`
                                : isStatusChange
                                  ? `3px solid #f59e0b`
                                  : `3px solid ${theme.colors.border}`,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              {/* Avatar */}
                              <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                backgroundColor: isSystemComment 
                                  ? (darkMode ? "#4b5563" : "#9ca3af")
                                  : tokens.colors.primary,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#fff",
                              }}>
                                {isSystemComment ? <Icons.Settings /> : c.author?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: theme.colors.text.primary }}>
                                  {c.author || "Unknown"}
                                </span>
                                {isQuestionAnswer && (
                                  <span style={{
                                    marginLeft: 8,
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    backgroundColor: "#3b82f6",
                                    color: "#fff",
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}>
                                    Q&A
                                  </span>
                                )}
                                {isStatusChange && (
                                  <span style={{
                                    marginLeft: 8,
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    backgroundColor: "#f59e0b",
                                    color: "#fff",
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}>
                                    Status
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: theme.colors.text.muted }}>
                                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                            <div style={{ 
                              fontSize: 14, 
                              color: theme.colors.text.secondary,
                              marginLeft: 36,
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.5,
                            }}>
                              {c.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Adapter Preview */}
            {(segmentAdapter || tealiumAdapter || mparticleAdapter) && (
              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.colors.border}` }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: theme.colors.text.primary }}>
                    Adapter Preview
                  </h3>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${theme.colors.border}` }}>
                  {[
                    { id: "segment", label: "Segment" },
                    { id: "tealium", label: "Tealium" },
                    { id: "mparticle", label: "mParticle" },
                    { id: "salesforce", label: "Salesforce CDP", comingSoon: true },
                  ].map((tab: any) => (
                    <button
                      key={tab.id}
                      onClick={() => !tab.comingSoon && setAdapterTab(tab.id as any)}
                      disabled={tab.comingSoon}
                      style={{
                        padding: "12px 20px",
                        border: "none",
                        backgroundColor: "transparent",
                        borderBottom: adapterTab === tab.id ? `2px solid ${tokens.colors.primary}` : "2px solid transparent",
                        color: tab.comingSoon ? theme.colors.text.muted : adapterTab === tab.id ? tokens.colors.primary : theme.colors.text.secondary,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: tab.comingSoon ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: tab.comingSoon ? 0.6 : 1,
                      }}
                    >
                      <CdpIndicator type={tab.id} />
                      {tab.label}
                      {tab.comingSoon && (
                        <span style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: theme.colors.text.muted,
                          color: "#fff",
                        }}>
                          Soon
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Adapter Content with Copy Button */}
                <div style={{ position: "relative" }}>
                  <div style={{ 
                    position: "absolute", 
                    top: 10, 
                    right: 10, 
                    zIndex: 10,
                  }}>
                    <CopyButton 
                      text={(() => {
                        const adapter = adapterTab === "segment" 
                          ? segmentAdapter 
                          : adapterTab === "tealium" 
                            ? tealiumAdapter 
                            : mparticleAdapter;
                        return adapter ? JSON.stringify(adapter, null, 2) : "";
                      })()}
                      label="Copy JSON"
                    />
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 20,
                      fontSize: 12,
                      fontFamily: tokens.fonts.mono,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: theme.colors.text.primary,
                      maxHeight: 400,
                      overflow: "auto",
                      backgroundColor: theme.colors.background,
                      lineHeight: 1.5,
                      minHeight: 100,
                    }}
                  >
                    {(() => {
                      const adapter = adapterTab === "segment" 
                        ? segmentAdapter 
                        : adapterTab === "tealium" 
                          ? tealiumAdapter 
                          : mparticleAdapter;
                      return adapter 
                        ? JSON.stringify(adapter, null, 2)
                        : "Loading adapter output...";
                    })()}
                  </pre>
                </div>
              </div>
            )}

            {/* Export Actions */}
            {specId && (
              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${theme.colors.border}`,
                  padding: 20,
                }}
              >
                {/* Persona-Based Export System */}
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: theme.colors.text.primary }}>
                  Export for...
                </h3>
                
                {/* Persona Selector Buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {[
                    { id: "engineer", name: "Integration Engineer", icon: <Icons.Code />, color: "#16a34a" },
                    { id: "marketing", name: "Marketing / CS", icon: <Icons.Send />, color: "#ec4899" },
                    { id: "qa", name: "Data QA Specialist", icon: <Icons.CheckCircle />, color: "#f59e0b" },
                    { id: "cdp", name: "CDP SME", icon: <Icons.Settings />, color: "#3b82f6" },
                  ].map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => setSelectedExportPersona(persona.id)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 20,
                        border: selectedExportPersona === persona.id ? `2px solid ${persona.color}` : `1px solid ${theme.colors.border}`,
                        backgroundColor: selectedExportPersona === persona.id ? `${persona.color}15` : theme.colors.surface,
                        color: selectedExportPersona === persona.id ? persona.color : theme.colors.text.primary,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ color: selectedExportPersona === persona.id ? persona.color : theme.colors.text.muted }}>
                        {persona.icon}
                      </span>
                      {persona.name}
                    </button>
                  ))}
                </div>

                {/* Dynamic Export Options Based on Selected Persona */}
                {selectedExportPersona && (
                  <div style={{
                    padding: 20,
                    backgroundColor: theme.colors.background,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    marginBottom: 24,
                  }}>
                    {/* Integration Engineer Exports */}
                    {selectedExportPersona === "engineer" && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#16a34a" }}>
                            Integration Engineer
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: theme.colors.text.muted }}>
                            Technical implementation resources
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => {
                              const payload = {
                                type: "IMPLEMENTATION_PAYLOAD",
                                generatedAt: new Date().toISOString(),
                                events: canonical?.events?.map((e: any) => ({
                                  event_name: e.name,
                                  trigger: e.trigger,
                                  properties: e.properties?.map((p: any) => ({
                                    name: p.name,
                                    type: p.type,
                                    required: p.required,
                                    description: p.description,
                                  })),
                                  identity: e.identity,
                                })),
                              };
                              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `events-payload-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Download /> JSON Payload
                          </button>
                          <button
                            onClick={() => setShowExportModal("snippets")}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Code /> Code Snippets
                          </button>
                          <button
                            onClick={() => setShowExportModal("table")}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Table /> Mapping Table
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(segmentAdapter, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `segment-tracking-plan-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.FileJson /> Segment Plan
                          </button>
                        </div>
                      </>
                    )}

                    {/* Marketing / Customer Success Exports */}
                    {selectedExportPersona === "marketing" && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#ec4899" }}>
                            Marketing / Customer Success
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: theme.colors.text.muted }}>
                            Plain-English summaries and sharing options
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => {
                              const summary = `📊 ${canonical?.metadata?.title || "Tracking Specification"}\n\n${canonical?.metadata?.summary || ""}\n\n📌 What's Being Tracked:\n${canonical?.events?.map((e: any) => `• ${e.name}: ${e.description || e.trigger}`).join("\n") || "No events"}\n\n🎯 Business Value:\nThis tracking will enable better understanding of user behavior and improve decision-making across ${canonical?.destinations?.length || 0} platforms.`;
                              navigator.clipboard.writeText(summary);
                              alert("Summary copied to clipboard!");
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Copy /> Copy Summary
                          </button>
                          <button
                            onClick={() => setShowSlackPreview(true)}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Slack /> Share to Slack
                          </button>
                          <button
                            onClick={() => {
                              const subject = encodeURIComponent(`Tracking Spec: ${canonical?.metadata?.title || "New Specification"}`);
                              const body = encodeURIComponent(`Hi,\n\nPlease review the tracking specification:\n\n${canonical?.metadata?.summary || ""}\n\nEvents to be tracked:\n${canonical?.events?.map((e: any) => `- ${e.name}`).join("\n") || "None"}\n\nBest regards`);
                              window.open(`mailto:?subject=${subject}&body=${body}`);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Send /> Email Summary
                          </button>
                          <button
                            onClick={generatePdfExport}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Pdf /> PDF Brief
                          </button>
                        </div>
                      </>
                    )}

                    {/* Data QA Specialist Exports */}
                    {selectedExportPersona === "qa" && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>
                            Data QA Specialist
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: theme.colors.text.muted }}>
                            Testing resources and validation checklists
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => {
                              const checklist = {
                                type: "QA_CHECKLIST",
                                generatedAt: new Date().toISOString(),
                                spec_title: canonical?.metadata?.title,
                                acceptance_criteria: canonical?.acceptance_criteria || [],
                                test_scenarios: canonical?.events?.map((e: any) => ({
                                  event: e.name,
                                  trigger: e.trigger,
                                  test_cases: [
                                    `Verify ${e.name} fires when: ${e.trigger}`,
                                    `Verify all required properties are present: ${e.properties?.filter((p: any) => p.required).map((p: any) => p.name).join(", ") || "None"}`,
                                    `Verify property types are correct`,
                                    `Verify event reaches destinations: ${canonical?.destinations?.map((d: any) => d.name).join(", ") || "N/A"}`,
                                  ],
                                  validation_rules: [...(e.business_rules || []), ...(e.technical_rules || [])],
                                })),
                              };
                              const blob = new Blob([JSON.stringify(checklist, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `qa-checklist-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.CheckCircle /> QA Checklist
                          </button>
                          <button
                            onClick={() => {
                              const samples = {
                                type: "SAMPLE_PAYLOADS",
                                generatedAt: new Date().toISOString(),
                                events: canonical?.events?.map((e: any) => ({
                                  event_name: e.name,
                                  sample_payload: {
                                    event: e.name,
                                    properties: Object.fromEntries(
                                      (e.properties || []).map((p: any) => [
                                        p.name,
                                        p.type === "string" ? "sample_value" :
                                        p.type === "number" ? 123 :
                                        p.type === "boolean" ? true :
                                        p.type === "array" ? ["item1", "item2"] : "value"
                                      ])
                                    ),
                                    timestamp: new Date().toISOString(),
                                    userId: "test_user_123",
                                  },
                                })),
                              };
                              const blob = new Blob([JSON.stringify(samples, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `sample-payloads-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.FileJson /> Sample Payloads
                          </button>
                          <button
                            onClick={() => {
                              const criteria = canonical?.acceptance_criteria || [];
                              const rules = canonical?.events?.flatMap((e: any) => [
                                ...(e.business_rules || []).map((r: string) => `[${e.name}] ${r}`),
                                ...(e.technical_rules || []).map((r: string) => `[${e.name}] ${r}`),
                              ]) || [];
                              const text = `ACCEPTANCE CRITERIA\n${"=".repeat(50)}\n\n${criteria.map((c: string, i: number) => `${i + 1}. [ ] ${c}`).join("\n")}\n\nVALIDATION RULES\n${"=".repeat(50)}\n\n${rules.map((r: string, i: number) => `${i + 1}. [ ] ${r}`).join("\n")}`;
                              navigator.clipboard.writeText(text);
                              alert("Acceptance criteria copied to clipboard!");
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Copy /> Copy Criteria
                          </button>
                          <button
                            onClick={handleCreateJira}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.ExternalLink /> Create QA Ticket
                          </button>
                        </div>
                      </>
                    )}

                    {/* CDP SME Exports */}
                    {selectedExportPersona === "cdp" && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#3b82f6" }}>
                            CDP SME / Solution Architect
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: theme.colors.text.muted }}>
                            Architecture documentation and CDP adapters
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={() => {
                              const overview = {
                                type: "CDP_ARCHITECTURE_OVERVIEW",
                                generatedAt: new Date().toISOString(),
                                spec_summary: {
                                  title: canonical?.metadata?.title,
                                  summary: canonical?.metadata?.summary,
                                  event_count: canonical?.events?.length || 0,
                                  property_count: canonical?.events?.reduce((acc: number, e: any) => acc + (e.properties?.length || 0), 0) || 0,
                                },
                                data_flow: {
                                  sources: ["Web", "Mobile", "Server"],
                                  cdp_layer: "Segment / Tealium / mParticle",
                                  destinations: canonical?.destinations?.map((d: any) => d.name) || [],
                                },
                                events_overview: canonical?.events?.map((e: any) => ({
                                  name: e.name,
                                  trigger: e.trigger,
                                  property_count: e.properties?.length || 0,
                                  has_pii: e.properties?.some((p: any) => p.pii?.classification !== "none") || false,
                                })),
                                dependencies: [
                                  "SDK implementation on client",
                                  "Server-side tracking setup",
                                  "Destination configuration",
                                  "Identity resolution setup",
                                ],
                                risks: [
                                  "PII handling compliance",
                                  "Event volume impact",
                                  "Cross-platform consistency",
                                ],
                              };
                              const blob = new Blob([JSON.stringify(overview, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `cdp-architecture-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.FileText /> Architecture Doc
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(segmentAdapter, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `segment-adapter-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Download /> Segment Adapter
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(tealiumAdapter, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `tealium-adapter-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Download /> Tealium Adapter
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(mparticleAdapter, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `mparticle-adapter-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Download /> mParticle Adapter
                          </button>
                          <button
                            onClick={() => {
                              const fullSpec = {
                                canonical: canonical,
                                adapters: {
                                  segment: segmentAdapter,
                                  tealium: tealiumAdapter,
                                  mparticle: mparticleAdapter,
                                },
                                exportedAt: new Date().toISOString(),
                              };
                              const blob = new Blob([JSON.stringify(fullSpec, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `full-cdp-spec-${specId}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.text.primary,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icons.Download /> Full Spec + Adapters
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {jiraIssueUrl && (
                  <div style={{ marginTop: 12, fontSize: 14 }}>
                    <a
                      href={jiraIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: tokens.colors.primary, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      View Jira Issue <Icons.ExternalLink />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Slack Share Preview Modal */}
            {showSlackPreview && canonical && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowSlackPreview(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.xl,
                    width: "100%",
                    maxWidth: 520,
                    maxHeight: "90vh",
                    overflow: "auto",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  {/* Modal Header */}
                  <div
                    style={{
                      padding: "16px 20px",
                      borderBottom: `1px solid ${theme.colors.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icons.Slack />
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
                        Share to Slack
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowSlackPreview(false)}
                      style={{
                        padding: 4,
                        border: "none",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        color: theme.colors.text.muted,
                      }}
                    >
                      <Icons.X />
                    </button>
                  </div>

                  {/* Preview Card */}
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 13, color: theme.colors.text.muted, marginBottom: 12 }}>
                      Preview of Slack message:
                    </div>
                    
                    {/* Slack Message Preview */}
                    <div
                      style={{
                        backgroundColor: "#f8f8f8",
                        borderRadius: tokens.radius.md,
                        border: "1px solid #e0e0e0",
                        padding: 16,
                      }}
                    >
                      {/* Slack App Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: tokens.colors.primary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          SP
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1c1d" }}>SpecPilot</div>
                          <div style={{ fontSize: 11, color: "#616061" }}>APP</div>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div
                        style={{
                          borderLeft: `4px solid ${tokens.colors.primary}`,
                          paddingLeft: 12,
                          marginLeft: 4,
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1264a3", marginBottom: 8 }}>
                          {canonical.metadata?.title || "Untitled Spec"}
                        </div>
                        <div style={{ fontSize: 14, color: "#1d1c1d", marginBottom: 12, lineHeight: 1.5 }}>
                          {canonical.metadata?.summary || "No summary available."}
                        </div>
                        
                        {/* Fields */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
                          <div>
                            <div style={{ color: "#616061", marginBottom: 2 }}>Status</div>
                            <div style={{ fontWeight: 500, color: "#1d1c1d", textTransform: "capitalize" }}>{reviewStatus}</div>
                          </div>
                          <div>
                            <div style={{ color: "#616061", marginBottom: 2 }}>Events</div>
                            <div style={{ fontWeight: 500, color: "#1d1c1d" }}>{canonical.events?.length || 0}</div>
                          </div>
                          <div>
                            <div style={{ color: "#616061", marginBottom: 2 }}>Validation Score</div>
                            <div style={{ fontWeight: 500, color: "#1d1c1d" }}>
                              {canonical.events?.length > 0 
                                ? Math.round(canonical.events.reduce((sum: number, evt: any) => sum + (evt.validation?.overall_score || 0), 0) / canonical.events.length)
                                : 0}/100
                            </div>
                          </div>
                          <div>
                            <div style={{ color: "#616061", marginBottom: 2 }}>Spec ID</div>
                            <div style={{ fontWeight: 500, color: "#1d1c1d", fontFamily: tokens.fonts.mono, fontSize: 12 }}>{specId}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div
                    style={{
                      padding: "16px 20px",
                      borderTop: `1px solid ${theme.colors.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                      Message will be sent to your configured Slack channel
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => setShowSlackPreview(false)}
                        style={{
                          padding: "10px 20px",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.text.primary,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendToSlack}
                        disabled={slackSending || slackSent}
                        style={{
                          padding: "10px 20px",
                          borderRadius: tokens.radius.md,
                          border: "none",
                          backgroundColor: slackSent ? tokens.colors.validation.success : "#4A154B",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: slackSending ? "not-allowed" : "pointer",
                          opacity: slackSending ? 0.7 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {slackSent ? (
                          <><Icons.Check /> Sent!</>
                        ) : slackSending ? (
                          <><Icons.Loader /> Sending...</>
                        ) : (
                          <><Icons.Send /> Send to Slack</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Table Export Modal */}
            {showExportModal === "table" && canonical && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowExportModal(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.lg,
                    width: 600,
                    maxHeight: "80vh",
                    overflow: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Export as Table</h3>
                    <button onClick={() => setShowExportModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Icons.X />
                    </button>
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ margin: "0 0 16px", fontSize: 14, color: theme.colors.text.secondary }}>
                      Export your specification as a formatted HTML table that can be viewed in any browser or imported into tools like Notion or Confluence.
                    </p>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => {
                          const html = generateTableExport();
                          const blob = new Blob([html], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `spec-${specId}-table.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 20px",
                          borderRadius: tokens.radius.md,
                          border: "none",
                          backgroundColor: tokens.colors.primary,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Icons.Download /> Download HTML
                      </button>
                      <button
                        onClick={() => {
                          const html = generateTableExport();
                          const newWindow = window.open();
                          if (newWindow) {
                            newWindow.document.write(html);
                            newWindow.document.close();
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 20px",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.text.primary,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Icons.ExternalLink /> Preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tracking Plan Export Modal */}
            {showExportModal === "tracking-plan" && canonical && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowExportModal(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.lg,
                    width: 700,
                    maxHeight: "80vh",
                    overflow: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Segment Tracking Plan</h3>
                    <button onClick={() => setShowExportModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Icons.X />
                    </button>
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ margin: "0 0 16px", fontSize: 14, color: theme.colors.text.secondary }}>
                      Export as a Segment Tracking Plan JSON that can be imported directly into your Segment workspace.
                    </p>
                    <pre
                      style={{
                        backgroundColor: "#1e293b",
                        color: "#e2e8f0",
                        padding: 16,
                        borderRadius: tokens.radius.md,
                        fontSize: 12,
                        fontFamily: tokens.fonts.mono,
                        overflow: "auto",
                        maxHeight: 300,
                        margin: "0 0 16px",
                      }}
                    >
                      {JSON.stringify(generateTrackingPlan(), null, 2)}
                    </pre>
                    <div style={{ position: "absolute", top: 60, right: 30 }}>
                      <CopyButton 
                        text={JSON.stringify(generateTrackingPlan(), null, 2)}
                        label="Copy JSON"
                      />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => {
                          const plan = generateTrackingPlan();
                          const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `tracking-plan-${specId}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 20px",
                          borderRadius: tokens.radius.md,
                          border: "none",
                          backgroundColor: "#52BD95",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Icons.Download /> Download Tracking Plan
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Code Snippets Modal */}
            {showExportModal === "snippets" && canonical && (() => {
              const snippets = generateSnippets();
              const [activeSnippet, setActiveSnippetLocal] = React.useState<string>("javascript");
              
              return (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                  onClick={() => setShowExportModal(null)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderRadius: tokens.radius.lg,
                      width: 800,
                      maxHeight: "85vh",
                      overflow: "auto",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Instrumentation Snippets</h3>
                      <button onClick={() => setShowExportModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Icons.X />
                      </button>
                    </div>
                    <div style={{ padding: 20 }}>
                      <p style={{ margin: "0 0 16px", fontSize: 14, color: theme.colors.text.secondary }}>
                        Copy-paste ready code snippets for implementing this event in your application.
                      </p>
                      
                      {/* Language Tabs */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                        {snippets && Object.keys(snippets).map((lang) => (
                          <button
                            key={lang}
                            onClick={() => setActiveSnippetLocal(lang)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: tokens.radius.md,
                              border: activeSnippet === lang ? "none" : `1px solid ${theme.colors.border}`,
                              backgroundColor: activeSnippet === lang ? tokens.colors.primary : theme.colors.surface,
                              color: activeSnippet === lang ? "#fff" : theme.colors.text.secondary,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: "pointer",
                              textTransform: "capitalize",
                            }}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>

                      {/* Code Display */}
                      <div style={{ position: "relative" }}>
                        <pre
                          style={{
                            backgroundColor: "#1e293b",
                            color: "#e2e8f0",
                            padding: 20,
                            borderRadius: tokens.radius.md,
                            fontSize: 13,
                            fontFamily: tokens.fonts.mono,
                            overflow: "auto",
                            maxHeight: 350,
                            margin: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          {snippets?.[activeSnippet as keyof typeof snippets] || ""}
                        </pre>
                        <div style={{ position: "absolute", top: 12, right: 12 }}>
                          <CopyButton 
                            text={snippets?.[activeSnippet as keyof typeof snippets] || ""}
                            label="Copy Code"
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 16, padding: 12, backgroundColor: theme.colors.background, borderRadius: tokens.radius.md, fontSize: 13, color: theme.colors.text.muted }}>
                        <strong>Note:</strong> Replace placeholder values with your actual data. Make sure you have the Segment SDK installed and configured.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Template Modal */}
            {showTemplateModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowTemplateModal(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.lg,
                    width: 800,
                    maxHeight: "85vh",
                    overflow: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Choose a Template</h3>
                    <button onClick={() => setShowTemplateModal(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Icons.X />
                    </button>
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ margin: "0 0 20px", fontSize: 14, color: theme.colors.text.secondary }}>
                      Start with a pre-built template to speed up your spec creation. Select a template to populate the intake form.
                    </p>
                    
                    {/* Category Groups */}
                    {["E-commerce", "SaaS", "Media", "Mobile", "Marketing"].map(category => {
                      const categoryTemplates = specTemplates.filter(t => t.category === category);
                      if (categoryTemplates.length === 0) return null;
                      
                      return (
                        <div key={category} style={{ marginBottom: 24 }}>
                          <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: theme.colors.text.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {category}
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {categoryTemplates.map(template => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setInput(template.intake);
                                  setShowTemplateModal(false);
                                  addAuditLog("Template Selected", `Selected "${template.name}" template`);
                                }}
                                style={{
                                  padding: 16,
                                  borderRadius: tokens.radius.md,
                                  border: `1px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.surface,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = tokens.colors.primary;
                                  e.currentTarget.style.backgroundColor = theme.colors.background;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = theme.colors.border;
                                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                                }}
                              >
                                <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary, marginBottom: 4 }}>
                                  {template.name}
                                </div>
                                <div style={{ fontSize: 13, color: theme.colors.text.muted }}>
                                  {template.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ==========================================================================
  // RENDER: SPECS VIEW
  // ==========================================================================
  const renderSpecsView = () => {
    const filteredSpecs = specList.filter((spec) => {
      if (specsFilter !== "all" && spec.status !== specsFilter) return false;
      if (specsSearch && !spec.title?.toLowerCase().includes(specsSearch.toLowerCase())) return false;
      return true;
    });

    return (
      <div style={{ padding: 32 }}>
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Header */}
          <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
                All Specs
              </h3>
              <button
                onClick={() => { clearAll(); setActiveNav("agent"); }}
                style={{
                  padding: "10px 20px",
                  borderRadius: tokens.radius.md,
                  border: "none",
                  backgroundColor: tokens.colors.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icons.Plus /> New Spec
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: theme.colors.text.muted,
                    pointerEvents: "none",
                  }}
                >
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  placeholder="Search specs..."
                  value={specsSearch}
                  onChange={(e) => setSpecsSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text.primary,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[
                  { key: "all", label: "All" },
                  { key: "draft", label: "Draft" },
                  { key: "pending_approval", label: "Pending" },
                  { key: "changes_requested", label: "Changes" },
                  { key: "validated", label: "Validated" },
                  { key: "approved", label: "Approved" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setSpecsFilter(filter.key as any)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: tokens.radius.md,
                      border: specsFilter === filter.key ? "none" : `1px solid ${theme.colors.border}`,
                      backgroundColor: specsFilter === filter.key ? tokens.colors.primary : theme.colors.surface,
                      color: specsFilter === filter.key ? "#fff" : theme.colors.text.secondary,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {specsLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: theme.colors.text.muted }}>
              Loading specs...
            </div>
          ) : filteredSpecs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: theme.colors.text.muted }}>
              No specs found.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: theme.colors.background }}>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Title</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Updated</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>ID</th>
                  <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, fontWeight: 600, color: theme.colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpecs.map((spec) => {
                  const statusStyle = getStatusStyle(spec.status);
                  const statusLabels: Record<string, string> = {
                    draft: "Draft",
                    pending_approval: "Pending Approval",
                    changes_requested: "Changes Requested",
                    validated: "Validated",
                    approved: "Approved",
                  };
                  return (
                    <tr
                      key={spec.id}
                      style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.background)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: theme.colors.text.primary }}>
                        {spec.title || "Untitled Spec"}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                          }}
                        >
                          {statusLabels[spec.status] || spec.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: theme.colors.text.muted }}>
                        {spec.updatedAt ? new Date(spec.updatedAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, fontFamily: tokens.fonts.mono, color: theme.colors.text.muted }}>
                        {spec.id}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <button
                          onClick={() => { setActiveNav("agent"); loadSpecById(spec.id); }}
                          style={{
                            padding: "6px 14px",
                            borderRadius: tokens.radius.md,
                            border: "none",
                            backgroundColor: tokens.colors.primary,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: SETTINGS VIEW
  // ==========================================================================
  const renderSettingsView = () => (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Specs Dashboard - Approver Only */}
        {permissions?.canApproveSpecs && (
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${theme.colors.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: theme.colors.text.primary }}>
                  Specs Dashboard
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: theme.colors.text.muted }}>
                  Review and manage all spec requests across your team
                </p>
              </div>
              <button
                onClick={loadSpecList}
                style={{
                  padding: "8px 16px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.primary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icons.Refresh /> Refresh
              </button>
            </div>

            {/* Stats Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total", value: specList.length, color: tokens.colors.primary, bg: tokens.colors.primary + "15" },
                { label: "Pending Approval", value: specList.filter(s => s.status === "pending_approval").length, color: "#2563eb", bg: "#dbeafe" },
                { label: "Changes Requested", value: specList.filter(s => s.status === "changes_requested").length, color: "#ea580c", bg: "#ffedd5" },
                { label: "Validated", value: specList.filter(s => s.status === "validated").length, color: "#8b5cf6", bg: "#ede9fe" },
                { label: "Approved", value: specList.filter(s => s.status === "approved").length, color: "#16a34a", bg: "#dcfce7" },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    borderRadius: tokens.radius.md,
                    backgroundColor: darkMode ? theme.colors.background : stat.bg,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Pending Approval Table - Only show specs awaiting review */}
            <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>
              Specs Awaiting Review ({specList.filter(s => s.status === "pending_approval").length})
            </h4>
            {specList.filter(s => s.status === "pending_approval").length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: theme.colors.text.muted, backgroundColor: theme.colors.background, borderRadius: tokens.radius.md }}>
                <Icons.CheckCircle />
                <div style={{ marginTop: 12, fontSize: 14 }}>No specs pending approval</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>All caught up! 🎉</div>
              </div>
            ) : (
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: tokens.radius.md, overflow: "hidden" }}>
                {/* Fixed Header */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr", 
                  backgroundColor: theme.colors.background,
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                  <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: theme.colors.text.secondary }}>
                    Spec Title
                  </div>
                  <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: theme.colors.text.secondary }}>
                    Created By
                  </div>
                  <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: theme.colors.text.secondary }}>
                    Status
                  </div>
                  <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: theme.colors.text.secondary }}>
                    Last Updated
                  </div>
                  <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: theme.colors.text.secondary, textAlign: "center" }}>
                    Actions
                  </div>
                </div>
                
                {/* Scrollable Body */}
                <div style={{ maxHeight: 350, overflowY: "auto" }}>
                  {specList.filter(s => s.status === "pending_approval").map((spec: any) => {
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      draft: { bg: darkMode ? "#374151" : "#f1f5f9", text: "#64748b" },
                      pending_approval: { bg: darkMode ? "#1e3a5f" : "#dbeafe", text: "#2563eb" },
                      changes_requested: { bg: darkMode ? "#431407" : "#ffedd5", text: "#ea580c" },
                      validated: { bg: darkMode ? "#422006" : "#fef3c7", text: "#d97706" },
                      approved: { bg: darkMode ? "#052e16" : "#dcfce7", text: "#16a34a" },
                    };
                    const colors = statusColors[spec.status] || statusColors.draft;
                    
                    return (
                      <div 
                        key={spec.id} 
                        style={{ 
                          display: "grid", 
                          gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr",
                          borderBottom: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.surface,
                        }}
                      >
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 500, color: theme.colors.text.primary, fontSize: 13 }}>
                            {spec.canonicalSpec?.metadata?.title || spec.title || spec.markdownSpec?.split('\n')[0]?.replace(/^#\s*/, '') || "Untitled Spec"}
                          </div>
                          <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 2 }}>
                            ID: {spec.id.substring(0, 8)}...
                          </div>
                        </div>
                        <div style={{ padding: "14px 16px", color: theme.colors.text.secondary, fontSize: 13, display: "flex", alignItems: "center" }}>
                          {spec.createdBy || "Unknown"}
                        </div>
                        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center" }}>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            backgroundColor: colors.bg,
                            color: colors.text,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}>
                            {spec.status === "pending_approval" ? "Pending" : spec.status || "draft"}
                          </span>
                        </div>
                        <div style={{ padding: "14px 16px", color: theme.colors.text.muted, fontSize: 12, display: "flex", alignItems: "center" }}>
                          {spec.updatedAt ? new Date(spec.updatedAt).toLocaleDateString() : "—"}
                        </div>
                        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => {
                                setActiveNav("agent");
                                loadSpecById(spec.id);
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: tokens.radius.sm,
                                border: "none",
                                backgroundColor: tokens.colors.primary,
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              Review
                            </button>
                            {spec.status === "draft" && (
                              <button
                                onClick={async () => {
                                  if (confirm("Validate this spec?")) {
                                    try {
                                      await fetch(`${API_BASE}/api/specpilot/review`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "X-Client-Id": CLIENT_ID },
                                        body: JSON.stringify({ id: spec.id, status: "validated", userRole: "approver", author: currentUser?.name }),
                                      });
                                      loadSpecList();
                                      addAuditLog("Quick Validate", `Validated spec from dashboard`, spec.id, spec.canonicalSpec?.metadata?.title);
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: tokens.radius.sm,
                                  border: "none",
                                  backgroundColor: "#8b5cf6",
                                  color: "#fff",
                                  fontSize: 11,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Validate
                              </button>
                            )}
                            {spec.status === "validated" && (
                              <button
                                onClick={async () => {
                                  if (confirm("Approve this spec?")) {
                                    try {
                                      await fetch(`${API_BASE}/api/specpilot/review`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "X-Client-Id": CLIENT_ID },
                                        body: JSON.stringify({ id: spec.id, status: "approved", userRole: "approver", author: currentUser?.name }),
                                      });
                                      loadSpecList();
                                      addAuditLog("Quick Approve", `Approved spec from dashboard`, spec.id, spec.canonicalSpec?.metadata?.title);
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: tokens.radius.sm,
                                  border: "none",
                                  backgroundColor: "#16a34a",
                                  color: "#fff",
                                  fontSize: 11,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Grid - 2 columns for smaller cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {/* Validation Rules Config */}
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${theme.colors.border}`,
              padding: 24,
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
              Validation Rules
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: theme.colors.text.muted }}>
              Configure governance rules for spec validation
            </p>

          {/* Naming Conventions */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary, marginBottom: 12 }}>
              Naming Conventions
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
                  Event Name Format
                </label>
                <select
                  value={validationConfig.naming.eventNameFormat}
                  onChange={(e) => setValidationConfig({
                    ...validationConfig,
                    naming: { ...validationConfig.naming, eventNameFormat: e.target.value }
                  })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: darkMode ? theme.colors.surface : "#fff",
                    color: theme.colors.text.primary,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option value="Title Case">Title Case (Add to Cart)</option>
                  <option value="snake_case">snake_case (add_to_cart)</option>
                  <option value="camelCase">camelCase (addToCart)</option>
                  <option value="PascalCase">PascalCase (AddToCart)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
                  Property Name Format
                </label>
                <select
                  value={validationConfig.naming.propertyNameFormat}
                  onChange={(e) => setValidationConfig({
                    ...validationConfig,
                    naming: { ...validationConfig.naming, propertyNameFormat: e.target.value }
                  })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: darkMode ? theme.colors.surface : "#fff",
                    color: theme.colors.text.primary,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option value="snake_case">snake_case (user_id)</option>
                  <option value="camelCase">camelCase (userId)</option>
                  <option value="PascalCase">PascalCase (UserId)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Required Fields */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary, marginBottom: 12 }}>
              Required Fields
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
                  All Events (comma-separated)
                </label>
                <input
                  type="text"
                  value={validationConfig.requiredFields.allEvents.join(", ")}
                  onChange={(e) => setValidationConfig({
                    ...validationConfig,
                    requiredFields: {
                      ...validationConfig.requiredFields,
                      allEvents: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: darkMode ? theme.colors.surface : "#fff",
                    color: theme.colors.text.primary,
                    fontSize: 14,
                    fontFamily: tokens.fonts.mono,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
                    Cart Events
                  </label>
                  <input
                    type="text"
                    value={validationConfig.requiredFields.cartEvents.join(", ")}
                    onChange={(e) => setValidationConfig({
                      ...validationConfig,
                      requiredFields: {
                        ...validationConfig.requiredFields,
                        cartEvents: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: darkMode ? theme.colors.surface : "#fff",
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontFamily: tokens.fonts.mono,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
                    Purchase Events
                  </label>
                  <input
                    type="text"
                    value={validationConfig.requiredFields.purchaseEvents.join(", ")}
                    onChange={(e) => setValidationConfig({
                      ...validationConfig,
                      requiredFields: {
                        ...validationConfig.requiredFields,
                        purchaseEvents: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: darkMode ? theme.colors.surface : "#fff",
                      color: theme.colors.text.primary,
                      fontSize: 14,
                      fontFamily: tokens.fonts.mono,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PII Fields */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary, marginBottom: 12 }}>
              PII Fields
            </div>
            <label style={{ display: "block", fontSize: 13, color: theme.colors.text.secondary, marginBottom: 6 }}>
              Fields to flag as PII (comma-separated)
            </label>
            <input
              type="text"
              value={validationConfig.piiFields.join(", ")}
              onChange={(e) => setValidationConfig({
                ...validationConfig,
                piiFields: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: darkMode ? theme.colors.surface : "#fff",
                color: theme.colors.text.primary,
                fontSize: 14,
                fontFamily: tokens.fonts.mono,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Consent Required */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text.primary }}>Require Consent for PII</div>
              <div style={{ fontSize: 13, color: theme.colors.text.muted }}>Flag validation warnings for PII without consent</div>
            </div>
            <button
              onClick={() => setValidationConfig({ ...validationConfig, consentRequired: !validationConfig.consentRequired })}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                border: "none",
                backgroundColor: validationConfig.consentRequired ? tokens.colors.validation.success : theme.colors.border,
                cursor: "pointer",
                position: "relative",
                transition: "background-color 0.2s",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: theme.colors.surface,
                  position: "absolute",
                  top: 2,
                  left: validationConfig.consentRequired ? 24 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          {/* Save Validation Config Button */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${theme.colors.border}` }}>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/validation-config`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-Client-Id": CLIENT_ID,
                    },
                    body: JSON.stringify({ config: validationConfig }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    alert("Validation config saved successfully!");
                    addAuditLog("Config Updated", "Validation rules configuration saved");
                  } else {
                    alert(data.error || "Failed to save config");
                  }
                } catch (err) {
                  alert("Error saving config");
                }
              }}
              style={{
                padding: "10px 20px",
                borderRadius: tokens.radius.md,
                border: "none",
                backgroundColor: tokens.colors.primary,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Validation Rules
            </button>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: theme.colors.text.muted }}>
              These rules will be applied when generating and validating new specs.
            </p>
          </div>
        </div>
        </div>
        {/* End of 2-column grid */}

        {/* Integrations Grid - 2 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {/* Slack Integration */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
            Slack Integration
          </h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 6 }}>
              Webhook URL
            </label>
            <input
              type="text"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookInput}
              onChange={(e) => setSlackWebhookInput(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: darkMode ? theme.colors.surface : "#fff",
                color: theme.colors.text.primary,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handleSaveSlack}
            disabled={slackSaving}
            style={{
              padding: "10px 20px",
              borderRadius: tokens.radius.md,
              border: "none",
              backgroundColor: tokens.colors.primary,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: slackSaving ? "not-allowed" : "pointer",
              opacity: slackSaving ? 0.7 : 1,
            }}
          >
            {slackSaving ? "Saving..." : "Save Slack"}
          </button>
          {slackStatus && (
            <div style={{ marginTop: 12, fontSize: 14, color: slackStatus.includes("success") ? tokens.colors.validation.success : tokens.colors.validation.error }}>
              {slackStatus}
            </div>
          )}
        </div>

        {/* Jira Integration */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
            Jira Integration
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 6 }}>
                Base URL
              </label>
              <input
                type="text"
                placeholder="https://yourcompany.atlassian.net"
                value={jiraBaseUrlInput}
                onChange={(e) => setJiraBaseUrlInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 6 }}>
                Project Key
              </label>
              <input
                type="text"
                placeholder="CDP"
                value={jiraProjectKeyInput}
                onChange={(e) => setJiraProjectKeyInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                value={jiraEmailInput}
                onChange={(e) => setJiraEmailInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 6 }}>
                API Token
              </label>
              <input
                type="password"
                placeholder="Your Jira API token"
                value={jiraApiTokenInput}
                onChange={(e) => setJiraApiTokenInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <button
            onClick={handleSaveJira}
            disabled={jiraSaving}
            style={{
              padding: "10px 20px",
              borderRadius: tokens.radius.md,
              border: "none",
              backgroundColor: tokens.colors.primary,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: jiraSaving ? "not-allowed" : "pointer",
              opacity: jiraSaving ? 0.7 : 1,
            }}
          >
            {jiraSaving ? "Saving..." : "Save Jira"}
          </button>
          {jiraStatusMsg && (
            <div style={{ marginTop: 12, fontSize: 14, color: jiraStatusMsg.includes("success") ? tokens.colors.validation.success : tokens.colors.validation.error }}>
              {jiraStatusMsg}
            </div>
          )}
        </div>
        </div>
        {/* End of Integrations Grid */}

        {/* CDP Integrations - Full Width */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 24,
          }}
        >
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: theme.colors.text.primary }}>
            CDP Integrations
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: theme.colors.text.muted }}>
            Enable or disable CDP adapters for spec generation
          </p>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {Object.entries(cdpIntegrations).map(([key, cdp]: [string, any]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  backgroundColor: theme.colors.background,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CdpIndicator type={key} size={32} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text.primary }}>
                      {cdp.name}
                      {cdp.comingSoon && (
                        <span style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 10,
                          backgroundColor: theme.colors.text.muted,
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 500,
                        }}>
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: theme.colors.text.muted }}>
                      {cdp.enabled ? "Adapter enabled" : "Adapter disabled"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (cdp.comingSoon) return;
                    const updated = {
                      ...cdpIntegrations,
                      [key]: { ...cdp, enabled: !cdp.enabled }
                    };
                    setCdpIntegrations(updated);
                    localStorage.setItem("specpilot_cdp_integrations", JSON.stringify(updated));
                    addAuditLog(
                      cdp.enabled ? "CDP Disabled" : "CDP Enabled",
                      `${cdp.name} adapter ${cdp.enabled ? "disabled" : "enabled"}`
                    );
                  }}
                  disabled={cdp.comingSoon}
                  style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    border: "none",
                    backgroundColor: cdp.comingSoon 
                      ? theme.colors.border 
                      : cdp.enabled 
                        ? tokens.colors.validation.success 
                        : theme.colors.border,
                    cursor: cdp.comingSoon ? "not-allowed" : "pointer",
                    position: "relative",
                    transition: "background-color 0.2s ease",
                    opacity: cdp.comingSoon ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    position: "absolute",
                    top: 2,
                    left: cdp.enabled ? 24 : 2,
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Logs */}
        <div
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.text.primary, display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.History /> Audit Logs
            </h3>
            {auditLogs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all audit logs?")) {
                    setAuditLogs([]);
                    localStorage.removeItem("specpilot_audit_logs");
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icons.Trash /> Clear
              </button>
            )}
          </div>
          
          {auditLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: theme.colors.text.muted }}>
              <Icons.History />
              <div style={{ marginTop: 12, fontSize: 14 }}>No audit logs yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Actions like creating specs, approvals, and exports will be logged here.</div>
            </div>
          ) : (
            <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: tokens.radius.md, overflow: "hidden" }}>
              {/* Fixed Header */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1.2fr 1.2fr 0.8fr 2fr 1fr", 
                backgroundColor: theme.colors.background,
                borderBottom: `1px solid ${theme.colors.border}`,
              }}>
                <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 12, color: theme.colors.text.secondary }}>
                  Actor
                </div>
                <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 12, color: theme.colors.text.secondary }}>
                  Action
                </div>
                <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 12, color: theme.colors.text.secondary }}>
                  Spec ID
                </div>
                <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 12, color: theme.colors.text.secondary }}>
                  Details
                </div>
                <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 12, color: theme.colors.text.secondary }}>
                  Timestamp
                </div>
              </div>
              
              {/* Scrollable Body */}
              <div style={{ maxHeight: 350, overflowY: "auto" }}>
                {auditLogs.slice(0, 50).map((log) => (
                  <div 
                    key={log.id} 
                    style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1.2fr 1.2fr 0.8fr 2fr 1fr",
                      borderBottom: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <div style={{ padding: "12px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: tokens.colors.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#fff",
                        flexShrink: 0,
                      }}>
                        {log.user?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontSize: 12, color: theme.colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.user || "Unknown"}
                      </span>
                    </div>
                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontWeight: 500, color: theme.colors.text.primary, fontSize: 13 }}>{log.action}</div>
                      {log.specTitle && (
                        <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.specTitle}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "12px", display: "flex", alignItems: "center" }}>
                      {log.specId ? (
                        <code style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text.secondary,
                          fontFamily: "monospace",
                        }}>
                          {log.specId.substring(0, 8)}...
                        </code>
                      ) : (
                        <span style={{ color: theme.colors.text.muted, fontSize: 12 }}>—</span>
                      )}
                    </div>
                    <div style={{ padding: "12px", color: theme.colors.text.secondary, fontSize: 12, display: "flex", alignItems: "center" }}>
                      {log.details}
                    </div>
                    <div style={{ padding: "12px", color: theme.colors.text.muted, whiteSpace: "nowrap", fontSize: 12, display: "flex", alignItems: "center" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              {auditLogs.length > 50 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: theme.colors.text.muted, borderTop: `1px solid ${theme.colors.border}` }}>
                  Showing 50 of {auditLogs.length} logs
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  
  // Filter nav items based on role
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.Dashboard, roles: ["approver", "user"] },
    { id: "specs", label: "Specs", icon: Icons.Specs, roles: ["approver", "user"] },
    { id: "agent", label: "Agent", icon: Icons.Agent, roles: ["approver", "user"] },
    { id: "settings", label: "Settings", icon: Icons.Settings, roles: ["approver"] },
  ].filter(item => currentUser && item.roles.includes(currentUser.role));

  // ============================================================================
  // LOGIN SCREEN
  // ============================================================================
  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          fontFamily: tokens.fonts.base,
        }}
      >
        <div
          style={{
            width: 420,
            backgroundColor: theme.colors.surface,
            borderRadius: tokens.radius.xl,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "32px 32px 24px",
              textAlign: "center",
              background: "linear-gradient(135deg, #0071dc 0%, #005bb7 100%)",
              color: "#fff",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              SP
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>SpecPilot</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.9 }}>
              CDP Intake Transformation System
            </p>
          </div>

          {/* Login Form */}
          <div style={{ padding: 32 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 8 }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 42px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: theme.colors.text.muted }}>
                  <Icons.Mail />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: theme.colors.text.secondary, marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 42px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: theme.colors.text.muted }}>
                  <Icons.Lock />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: theme.colors.text.muted,
                    padding: 0,
                  }}
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            {loginError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: tokens.radius.md,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: tokens.radius.md,
                border: "none",
                backgroundColor: tokens.colors.primary,
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Sign In
            </button>

            {/* Demo Credentials */}
            <div
              style={{
                marginTop: 24,
                padding: 16,
                backgroundColor: theme.colors.background,
                borderRadius: tokens.radius.md,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, color: theme.colors.text.primary, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Icons.Shield /> Demo Credentials
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  onClick={() => {
                    setLoginEmail("approver@specpilot.io");
                    setLoginPassword("approver123");
                  }}
                  style={{
                    padding: 12,
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: tokens.colors.primary, marginBottom: 4 }}>Approver</div>
                  <div style={{ fontSize: 11, color: theme.colors.text.muted }}>approver@specpilot.io</div>
                  <div style={{ fontSize: 11, color: theme.colors.text.muted }}>approver123</div>
                </div>
                <div
                  onClick={() => {
                    setLoginEmail("user@specpilot.io");
                    setLoginPassword("user123");
                  }}
                  style={{
                    padding: 12,
                    backgroundColor: theme.colors.surface,
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>User</div>
                  <div style={{ fontSize: 11, color: theme.colors.text.muted }}>user@specpilot.io</div>
                  <div style={{ fontSize: 11, color: theme.colors.text.muted }}>user123</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN APP (Authenticated)
  // ============================================================================
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        fontFamily: tokens.fonts.base,
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          backgroundColor: "#1e293b",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* App Name */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #334155" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>SpecPilot</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>CDP Intake Transformer</div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id as any);
                  if (item.id === "specs" || item.id === "dashboard") {
                    loadSpecList();
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  marginBottom: 4,
                  border: "none",
                  borderRadius: tokens.radius.md,
                  backgroundColor: activeNav === item.id ? tokens.colors.primary : "transparent",
                  color: activeNav === item.id ? "#fff" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <IconComponent />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: 16, borderTop: "1px solid #334155" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: currentUser.role === "approver" ? tokens.colors.primary : "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icons.User />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ 
                  padding: "1px 6px", 
                  borderRadius: 4, 
                  backgroundColor: currentUser.role === "approver" ? "rgba(0,113,220,0.2)" : "rgba(22,163,74,0.2)",
                  color: currentUser.role === "approver" ? "#60a5fa" : "#4ade80",
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}>
                  {currentUser.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <Icons.LogOut />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, backgroundColor: theme.colors.background, overflow: "auto" }}>
        {/* Header */}
        <div
          style={{
            padding: "20px 32px",
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: theme.colors.text.primary }}>
              {activeNav === "dashboard" && "Dashboard"}
              {activeNav === "specs" && "Specs"}
              {activeNav === "agent" && "Intake Agent"}
              {activeNav === "settings" && "Settings"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: theme.colors.text.secondary }}>
              {activeNav === "dashboard" && "Overview of your CDP specifications"}
              {activeNav === "specs" && "Browse and manage all specifications"}
              {activeNav === "agent" && "Transform intake requests into structured specifications"}
              {activeNav === "settings" && "Configure integrations and preferences"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Role badge in header */}
            <div
              style={{
                padding: "6px 12px",
                borderRadius: tokens.radius.md,
                backgroundColor: currentUser.role === "approver" ? "rgba(0,113,220,0.1)" : "rgba(22,163,74,0.1)",
                color: currentUser.role === "approver" ? tokens.colors.primary : "#16a34a",
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icons.Shield />
              {currentUser.role === "approver" ? "Approver" : "User"}
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: "8px 12px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text.secondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </div>

        {/* View Content */}
        {activeNav === "dashboard" && renderDashboardView()}
        {activeNav === "specs" && renderSpecsView()}
        {activeNav === "agent" && renderAgentView()}
        {activeNav === "settings" && renderSettingsView()}
      </div>

      {/* Global Styles */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }

          html, body, #root {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100vh;
            background-color: ${theme.colors.background};
          }

          * {
            box-sizing: border-box;
          }

          input:focus, textarea:focus, button:focus {
            outline: none;
            border-color: ${tokens.colors.primary};
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: ${theme.colors.background};
          }

          ::-webkit-scrollbar-thumb {
            background: ${theme.colors.border};
            border-radius: 4px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: ${theme.colors.text.muted};
          }
        `}
      </style>
    </div>
  );
}

export default App;
