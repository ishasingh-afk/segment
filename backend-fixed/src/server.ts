import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";

import { openai } from "./aiClient.js";
import {
  generateSpecFromIntake,
  generateCanonicalSpecFromIntake,
} from "./specpilotService.js";
import { transformToSegmentTrackingPlan } from "./adapters/segmentAdapter.js";
import { transformToTealiumCdp } from "./adapters/tealiumAdapter.js";
import { transformToMParticleCdp } from "./adapters/mparticleAdapter.js";
import { saveSpec, updateReview, getSpec, getAllSpecs } from "./reviewState.js";
import { setSlackConfig, setJiraConfig, getConfig } from "./integrationStore.js";

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

// ---------- HELPERS ----------
function getClientId(req: Request): string | null {
  const header = req.header("X-Client-Id");
  return header && typeof header === "string" ? header : null;
}

async function notifySlackForSpec(
  clientId: string,
  opts: { id: string; title: string; status: string; summary: string }
) {
  const cfg = getConfig(clientId);
  if (!cfg?.slack?.webhookUrl) return;

  const { webhookUrl } = cfg.slack;

  const text =
    `📄 *SpecPilot Update*\n` +
    `• *Title:* ${opts.title}\n` +
    `• *Status:* ${opts.status}\n` +
    `• *Spec ID:* ${opts.id}\n` +
    (opts.summary ? `• *Summary:* ${opts.summary}` : "");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Slack notify failed:", err);
  }
}

// ---------- ROUTES ----------

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Generate markdown spec from intake
app.post("/api/specpilot/intake", async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ ok: false, error: "Missing input" });
    }
    const spec = await generateSpecFromIntake(input);
    res.json({ ok: true, spec });
  } catch (err: any) {
    console.error("Intake error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate canonical spec from intake
app.post("/api/specpilot/canonical", async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ ok: false, error: "Missing input" });
    }
    const canonicalSpec = await generateCanonicalSpecFromIntake(input);
    res.json({ ok: true, canonicalSpec });
  } catch (err: any) {
    console.error("Canonical error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate CDP adapters from canonical spec
app.post("/api/specpilot/adapters-from-canonical", async (req: Request, res: Response) => {
  try {
    const { canonicalSpec } = req.body;
    if (!canonicalSpec) {
      return res.status(400).json({ ok: false, error: "Missing canonicalSpec" });
    }

    const segment = transformToSegmentTrackingPlan(canonicalSpec);
    const tealium = transformToTealiumCdp(canonicalSpec);
    const mparticle = transformToMParticleCdp(canonicalSpec);

    res.json({
      ok: true,
      adapters: { segment, tealium, mparticle },
    });
  } catch (err: any) {
    console.error("Adapters error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Save spec
app.post("/api/specpilot/save", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { id, canonicalSpec, markdownSpec, status, title, createdBy, commentText, author } = req.body;

    if (!canonicalSpec) {
      return res.status(400).json({ ok: false, error: "Missing canonicalSpec" });
    }

    const stored = saveSpec(clientId, {
      id,
      canonicalSpec,
      markdownSpec,
      status: status || "draft",
      title,
      createdBy,
    });

    // Add comment if provided
    if (commentText && stored) {
      updateReview(clientId, stored.id, {
        comment: { text: commentText, author: author || "Unknown" },
      });
    }

    res.json({ ok: true, stored, specId: stored?.id });
  } catch (err: any) {
    console.error("Save error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update review status
app.post("/api/specpilot/review", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { specId, status, comment } = req.body;

    if (!specId) {
      return res.status(400).json({ ok: false, error: "Missing specId" });
    }

    const updated = updateReview(clientId, specId, { status, comment });

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Spec not found" });
    }

    // Notify Slack if configured
    const spec = getSpec(clientId, specId);
    if (spec) {
      await notifySlackForSpec(clientId, {
        id: specId,
        title: spec.canonicalSpec?.metadata?.title || "Untitled",
        status: status || spec.status,
        summary: comment?.text || "",
      });
    }

    res.json({ ok: true, stored: updated });
  } catch (err: any) {
    console.error("Review error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get single spec
app.get("/api/specpilot/spec/:id", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { id } = req.params;

    const spec = getSpec(clientId, id);

    if (!spec) {
      return res.status(404).json({ ok: false, error: "Spec not found" });
    }

    res.json({ ok: true, spec });
  } catch (err: any) {
    console.error("Get spec error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List all specs
app.get("/api/specpilot/specs", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const specs = getAllSpecs(clientId);
    res.json({ ok: true, specs });
  } catch (err: any) {
    console.error("List specs error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Set Slack config
app.post("/api/specpilot/config/slack", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { webhookUrl, channel } = req.body;

    setSlackConfig(clientId, { webhookUrl, channel });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Slack config error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Set Jira config
app.post("/api/specpilot/config/jira", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { baseUrl, email, apiToken, projectKey } = req.body;

    setJiraConfig(clientId, { baseUrl, email, apiToken, projectKey });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Jira config error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get config
app.get("/api/specpilot/config", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const config = getConfig(clientId);

    // Don't expose sensitive data
    res.json({
      ok: true,
      config: {
        slack: config?.slack ? { channel: config.slack.channel, configured: !!config.slack.webhookUrl } : null,
        jira: config?.jira ? { projectKey: config.jira.projectKey, configured: !!config.jira.apiToken } : null,
      },
    });
  } catch (err: any) {
    console.error("Get config error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
