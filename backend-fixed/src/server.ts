import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";

import { openai } from "./aiClient.js";
import {
  generateSpecFromIntake,
  generateCanonicalSpecFromIntake,
  normalizeCanonicalSpec,
} from "./specpilotService.js";
import { transformToSegmentTrackingPlan } from "./adapters/segmentAdapter.js";
import { transformToTealiumCdp } from "./adapters/tealiumAdapter.js";
import { transformToMParticleCdp } from "./adapters/mparticleAdapter.js";
import { saveSpec, updateReview, getSpec, getAllSpecs } from "./reviewState.js";
import { setSlackConfig, setJiraConfig, getConfig } from "./integrationStore.js";

const app = express();

// In-memory validation config per client (keep it simple for now)
const validationConfigs: Map<string, any> = new Map();
const defaultValidationConfig = {
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
};

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

// Fetch URL content (used by frontend context loader)
app.post("/api/fetch-url", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ ok: false, error: "Missing url" });
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return res.status(400).json({ ok: false, error: "Only http/https URLs are allowed" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ ok: false, error: `Failed to fetch URL (status ${response.status})` });
    }

    const content = await response.text();
    res.json({ ok: true, content });
  } catch (err: any) {
    console.error("Fetch URL error:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch URL" });
  }
});

// Validation config (read-only default for now)
app.get("/api/validation-config", (req: Request, res: Response) => {
  const clientId = getClientId(req) || "default";
  const config = validationConfigs.get(clientId) || defaultValidationConfig;
  validationConfigs.set(clientId, config);
  res.json({ ok: true, config });
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

// Generate adapters directly from intake (helper wrapper)
app.post("/api/specpilot/adapters", async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ ok: false, error: "Missing input" });
    }

    const canonicalSpec = normalizeCanonicalSpec(await generateCanonicalSpecFromIntake(input));
    const segment = transformToSegmentTrackingPlan(canonicalSpec);
    const tealium = transformToTealiumCdp(canonicalSpec);
    const mparticle = transformToMParticleCdp(canonicalSpec);

    res.json({
      ok: true,
      segment,
      tealium,
      mparticle,
      canonicalSpec,
    });
  } catch (err: any) {
    console.error("Adapters from intake error:", err);
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

    const normalized = normalizeCanonicalSpec(canonicalSpec);
    const segment = transformToSegmentTrackingPlan(normalized);
    const tealium = transformToTealiumCdp(normalized);
    const mparticle = transformToMParticleCdp(normalized);

    res.json({
      ok: true,
      segment,
      tealium,
      mparticle,
    });
  } catch (err: any) {
    console.error("Adapters error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Slack share a spec (uses stored Slack webhook)
app.post("/api/specpilot/slack-share", async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { specId, text } = req.body;

    if (!specId || !text) {
      return res.status(400).json({ ok: false, error: "Missing specId or text" });
    }

    const cfg = getConfig(clientId);
    const webhook = cfg?.slack?.webhookUrl;
    if (!webhook) {
      return res.status(400).json({ ok: false, error: "Slack is not configured" });
    }

    const payload = {
      text: `Spec ${specId}\n${text}`,
    };

    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return res.status(400).json({ ok: false, error: "Failed to send to Slack" });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Slack share error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Jira ticket creation placeholder (does not call Jira Cloud APIs)
app.post("/api/specpilot/jira-ticket/:specId", async (req: Request, res: Response) => {
  const clientId = getClientId(req) || "default";
  const { specId } = req.params;
  const cfg = getConfig(clientId)?.jira;

  if (!cfg) {
    return res.status(400).json({ ok: false, error: "Jira is not configured" });
  }

  // In a real implementation we would call Jira here. For now, return a fake URL.
  const issueUrl = `${cfg.baseUrl.replace(/\/$/, "")}/browse/${cfg.projectKey}-${specId}`;
  res.json({ ok: true, issueUrl });
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
      canonicalSpec: normalizeCanonicalSpec(canonicalSpec),
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

    res.json({ ok: true, stored: spec });
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

// Slack integration settings
app.post("/api/integrations/slack", (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { webhookUrl, channel } = req.body || {};

    if (!webhookUrl) {
      return res.status(400).json({ ok: false, error: "Missing webhookUrl" });
    }

    setSlackConfig(clientId, { webhookUrl, channel });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Slack integration error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Jira integration settings
app.post("/api/integrations/jira", (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req) || "default";
    const { baseUrl, email, apiToken, projectKey } = req.body || {};

    if (!baseUrl || !email || !apiToken || !projectKey) {
      return res.status(400).json({ ok: false, error: "Missing Jira config fields" });
    }

    setJiraConfig(clientId, { baseUrl, email, apiToken, projectKey });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Jira integration error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Push to Segment Tracking Plan API
app.post("/api/specpilot/push/segment", async (req: Request, res: Response) => {
  try {
    const { apiToken, trackingPlanId, rules } = req.body;

    if (!apiToken) {
      return res.status(400).json({ ok: false, error: "Missing API token" });
    }
    if (!trackingPlanId) {
      return res.status(400).json({ ok: false, error: "Missing Tracking Plan ID" });
    }
    if (!rules) {
      return res.status(400).json({ ok: false, error: "Missing rules" });
    }

    // Call Segment API
    const segmentRes = await fetch(
      `https://api.segmentapis.com/tracking-plans/${trackingPlanId}/rules`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rules),
      }
    );

    const segmentData = await segmentRes.json();

    if (!segmentRes.ok) {
      return res.status(segmentRes.status).json({
        ok: false,
        error: segmentData.error?.message || segmentData.message || "Segment API error",
        details: segmentData,
      });
    }

    res.json({ ok: true, data: segmentData });
  } catch (err: any) {
    console.error("Segment push error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
