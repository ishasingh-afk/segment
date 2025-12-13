import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type ReviewStatus = "draft" | "pending_approval" | "changes_requested" | "validated" | "approved";

export interface ReviewComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface StoredSpec {
  id: string;
  canonicalSpec: any;
  markdownSpec?: string;
  status: ReviewStatus;
  title?: string;
  createdBy?: string;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
}

type ClientStore = Record<string, StoredSpec>;
interface PersistedStore {
  [clientId: string]: ClientStore;
}

// Persistent storage on disk (JSON)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "specStore.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let persisted: PersistedStore = {};

function loadStore(): PersistedStore {
  ensureDataDir();
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      persisted = JSON.parse(raw) as PersistedStore;
    } catch (err) {
      console.error("Failed to read store file; starting fresh", err);
      persisted = {};
    }
  }
  return persisted;
}

function saveStore() {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(persisted, null, 2), "utf-8");
}

function getClientStore(clientId: string): ClientStore {
  if (!persisted[clientId]) {
    persisted[clientId] = {};
  }
  return persisted[clientId];
}

// Initialize from disk on module load
loadStore();

export function saveSpec(
  clientId: string,
  data: {
    id?: string;
    canonicalSpec: any;
    markdownSpec?: string;
    status?: ReviewStatus;
    title?: string;
    createdBy?: string;
  }
): StoredSpec {
  const store = getClientStore(clientId);
  const now = new Date().toISOString();

  const id = data.id || uuidv4();
  const existing = store[id];

  const spec: StoredSpec = {
    id,
    canonicalSpec: data.canonicalSpec,
    markdownSpec: data.markdownSpec,
    status: data.status || existing?.status || "draft",
    title: data.title || data.canonicalSpec?.metadata?.title || existing?.title,
    createdBy: data.createdBy || existing?.createdBy,
    comments: existing?.comments || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  store[id] = spec;
  saveStore();
  return spec;
}

export function updateReview(
  clientId: string,
  specId: string,
  update: {
    status?: ReviewStatus;
    comment?: { text: string; author: string };
  }
): StoredSpec | null {
  const store = getClientStore(clientId);
  const spec = store[specId];

  if (!spec) return null;

  const now = new Date().toISOString();

  if (update.status) {
    spec.status = update.status;
  }

  if (update.comment) {
    spec.comments.push({
      id: uuidv4(),
      text: update.comment.text,
      author: update.comment.author,
      timestamp: now,
    });
  }

  spec.updatedAt = now;
  store[specId] = spec;
  saveStore();

  return spec;
}

export function getSpec(clientId: string, specId: string): StoredSpec | null {
  const store = getClientStore(clientId);
  return store[specId] || null;
}

export function getAllSpecs(clientId: string): StoredSpec[] {
  const store = getClientStore(clientId);
  return Object.values(store).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function deleteSpec(clientId: string, specId: string): boolean {
  const store = getClientStore(clientId);
  const exists = !!store[specId];
  if (exists) {
    delete store[specId];
    saveStore();
  }
  return exists;
}
