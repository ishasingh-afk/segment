import { v4 as uuidv4 } from "uuid";

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

// In-memory storage per client
const specStore: Map<string, Map<string, StoredSpec>> = new Map();

function getClientStore(clientId: string): Map<string, StoredSpec> {
  if (!specStore.has(clientId)) {
    specStore.set(clientId, new Map());
  }
  return specStore.get(clientId)!;
}

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
  const existing = store.get(id);

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

  store.set(id, spec);
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
  const spec = store.get(specId);

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
  store.set(specId, spec);

  return spec;
}

export function getSpec(clientId: string, specId: string): StoredSpec | null {
  const store = getClientStore(clientId);
  return store.get(specId) || null;
}

export function getAllSpecs(clientId: string): StoredSpec[] {
  const store = getClientStore(clientId);
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function deleteSpec(clientId: string, specId: string): boolean {
  const store = getClientStore(clientId);
  return store.delete(specId);
}
