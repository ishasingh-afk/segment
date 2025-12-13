// backend/src/reviewState.ts
// Persistent file-based storage for specs (survives server restarts)

import { CanonicalSpec } from "./models/canonicalSpec";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ReviewStatus = "draft" | "validated" | "approved";

export interface ReviewComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface StoredSpec {
  id: string;
  canonicalSpec: CanonicalSpec;
  markdownSpec?: string;        // Human-readable spec (markdown)
  status: ReviewStatus;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// File-based persistent storage
// ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const SPECS_FILE = path.join(DATA_DIR, "specs.json");

// In-memory cache (backed by file)
let store = new Map<string, StoredSpec>();

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Storage] Created data directory: ${DATA_DIR}`);
  }
}

/**
 * Load specs from file into memory
 */
function loadFromFile(): void {
  ensureDataDir();
  
  if (fs.existsSync(SPECS_FILE)) {
    try {
      const data = fs.readFileSync(SPECS_FILE, "utf-8");
      const specs: StoredSpec[] = JSON.parse(data);
      store = new Map(specs.map((spec) => [spec.id, spec]));
      console.log(`[Storage] Loaded ${specs.length} specs from ${SPECS_FILE}`);
    } catch (err) {
      console.error("[Storage] Error loading specs file:", err);
      store = new Map();
    }
  } else {
    console.log("[Storage] No existing specs file, starting fresh");
    store = new Map();
  }
}

/**
 * Save all specs to file
 */
function saveToFile(): void {
  ensureDataDir();
  
  try {
    const specs = Array.from(store.values());
    fs.writeFileSync(SPECS_FILE, JSON.stringify(specs, null, 2), "utf-8");
    // Don't log every save to reduce noise
  } catch (err) {
    console.error("[Storage] Error saving specs file:", err);
  }
}

// Load specs on module initialization
loadFromFile();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  // Use crypto.randomUUID if available (Node 19+), else fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

/**
 * Save a new spec to the store
 */
export function saveSpec(
  canonicalSpec: CanonicalSpec,
  status: ReviewStatus = "draft",
  commentText?: string,
  author: string = "system",
  markdownSpec?: string
): StoredSpec {
  const id = generateId();
  const now = new Date().toISOString();

  const comments: ReviewComment[] = [];
  if (commentText && commentText.trim()) {
    comments.push({
      id: generateId(),
      author,
      text: commentText.trim(),
      createdAt: now,
    });
  }

  const stored: StoredSpec = {
    id,
    canonicalSpec,
    markdownSpec,
    status,
    comments,
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, stored);
  saveToFile(); // Persist to disk
  
  console.log(`[Storage] Saved new spec: ${id} - ${canonicalSpec.metadata?.title || "Untitled"}`);
  return stored;
}

/**
 * Update review status and optionally add a comment
 */
export function updateReview(
  id: string,
  status: ReviewStatus,
  commentText?: string,
  author: string = "reviewer"
): StoredSpec | null {
  const existing = store.get(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  existing.status = status;
  existing.updatedAt = now;

  if (commentText && commentText.trim()) {
    existing.comments.push({
      id: generateId(),
      author,
      text: commentText.trim(),
      createdAt: now,
    });
  }

  store.set(id, existing);
  saveToFile(); // Persist to disk
  
  return existing;
}

/**
 * Get a single spec by ID
 */
export function getSpec(id: string): StoredSpec | null {
  return store.get(id) ?? null;
}

/**
 * Get all specs, sorted by most recently updated
 */
export function getAllSpecs(): StoredSpec[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Update an existing spec's canonical data (for re-generation)
 */
export function updateSpec(
  id: string,
  canonicalSpec: CanonicalSpec,
  markdownSpec?: string
): StoredSpec | null {
  const existing = store.get(id);
  if (!existing) return null;

  existing.canonicalSpec = canonicalSpec;
  if (markdownSpec !== undefined) {
    existing.markdownSpec = markdownSpec;
  }
  existing.updatedAt = new Date().toISOString();

  store.set(id, existing);
  saveToFile(); // Persist to disk
  
  return existing;
}

/**
 * Delete a spec by ID
 */
export function deleteSpec(id: string): boolean {
  const result = store.delete(id);
  if (result) {
    saveToFile(); // Persist to disk
  }
  return result;
}

/**
 * Force reload from file (useful for debugging)
 */
export function reloadFromDisk(): void {
  loadFromFile();
}

/**
 * Get storage stats
 */
export function getStorageStats(): { count: number; filePath: string; fileExists: boolean } {
  return {
    count: store.size,
    filePath: SPECS_FILE,
    fileExists: fs.existsSync(SPECS_FILE),
  };
}