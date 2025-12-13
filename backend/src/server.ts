import dotenv from "dotenv";
dotenv.config();

import express, { Request } from "express";
import cors from "cors";
import fetch from "node-fetch"; // 🔹 npm install node-fetch @types/node-fetch

import { openai } from "./aiClient";
import {
  generateSpecFromIntake,
  generateCanonicalSpecFromIntake,
} from "./specpilotService";
import { transformToSegmentTrackingPlan } from "./adapters/segmentAdapter";
import { transformToTealiumCdp } from "./adapters/tealiumAdapter";
import { transformToMParticleCdp } from "./adapters/mparticleAdapter";
import { saveSpec, updateReview, getSpec, getAllSpecs } from "./reviewState";
import { setSlackConfig, setJiraConfig, getConfig } from "./integrationStore";


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
  if (!cfg?.slack?.webhookUrl) return; // no Slack set up for this client

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
  } catch (e: any) {
    console.error("Slack notify error:", e?.message || e);
  }
}

// ---------- HEALTH / TEST ----------
app.get("/", (_req, res) => {
  res.send("SpecPilot backend is running ✅");
});

app.post("/api/test-ai", async (_req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello in one short sentence." },
      ],
    });

    const message = response.choices[0]?.message?.content || "No response";
    res.json({ ok: true, message });
  } catch (error: any) {
    console.error("OpenAI error:", error.message || error);
    res.status(500).json({ ok: false, error: "AI request failed" });
  }
});

// ---------- SPEC GENERATION ----------

// Human-readable spec (markdown-ish)
app.post("/api/specpilot/intake", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({
        ok: false,
        error: 'Missing "input" in request body',
      });
    }

    const result = await generateSpecFromIntake(input);

    // Support both { markdown } or { specText }
    const humanReadable =
      (result as any).markdown ||
      (result as any).specText ||
      "";

    res.json({
      ok: true,
      spec: humanReadable,
    });
  } catch (error: any) {
    console.error("SpecPilot error:", error.message || error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate spec",
    });
  }
});

// Canonical structured spec
app.post("/api/specpilot/canonical", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({
        ok: false,
        error: 'Missing "input" in request body',
      });
    }

    const canonicalSpec = await generateCanonicalSpecFromIntake(input);

    res.json({
      ok: true,
      canonicalSpec,
    });
  } catch (error: any) {
    console.error("Canonical spec error:", error.message || error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate canonical spec",
    });
  }
});

// Generate adapter outputs directly from intake
app.post("/api/specpilot/adapters", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({
        ok: false,
        error: 'Missing "input" in request body',
      });
    }

    const canonicalSpec = await generateCanonicalSpecFromIntake(input);

    const segmentPlan = transformToSegmentTrackingPlan(canonicalSpec);
    const tealiumView = transformToTealiumCdp(canonicalSpec);
    const mparticleView = transformToMParticleCdp(canonicalSpec);

    res.json({
      ok: true,
      segment: segmentPlan,
      tealium: tealiumView,
      mparticle: mparticleView,
    });
  } catch (error: any) {
    console.error("Adapter error:", error?.message || error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate adapter outputs",
    });
  }
});

// ---------- REVIEW STORAGE LAYER ----------

// Save canonical spec (+ optional comment + markdown) and notify Slack
app.post("/api/specpilot/save", async (req, res) => {
  try {
    const clientId = getClientId(req);
    const { canonicalSpec, status, commentText, author, markdownSpec, title, createdBy } = req.body;

    if (!canonicalSpec) {
      return res.status(400).json({
        ok: false,
        error: 'Missing "canonicalSpec" in request body',
      });
    }

    // Make sure reviewState.saveSpec supports this signature:
    // saveSpec(canonicalSpec, status?, commentText?, author?, markdownSpec?, title?, createdBy?)
    const stored = saveSpec(
      canonicalSpec,
      status || "draft",
      commentText,
      author || "system",
      markdownSpec,
      title || canonicalSpec?.metadata?.title || "Untitled Spec",
      createdBy || author || "Unknown"
    );

    if (clientId) {
      await notifySlackForSpec(clientId, {
        id: stored.id,
        title: stored.title || stored.canonicalSpec?.metadata?.title || "Untitled Spec",
        status: stored.status,
        summary: stored.canonicalSpec?.metadata?.summary || "",
      });
    }

    return res.json({ ok: true, stored });
  } catch (err: any) {
    console.error("Save spec error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Failed to save spec",
    });
  }
});

// Update review status + append comment + notify Slack
app.post("/api/specpilot/review", async (req, res) => {
  try {
    const clientId = getClientId(req);
    const { id, status, commentText, author, userRole } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        ok: false,
        error: 'Missing "id" or "status" in request body',
      });
    }

    // Backend permission enforcement: Only approvers can validate/approve
    if ((status === "validated" || status === "approved") && userRole !== "approver") {
      return res.status(403).json({
        ok: false,
        error: "PERMISSION_DENIED",
        message: "Only Approvers can validate or approve specs",
      });
    }

    const updated = updateReview(
      id,
      status,
      commentText,
      author || "reviewer"
    );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: "Spec not found",
      });
    }

    if (clientId) {
      await notifySlackForSpec(clientId, {
        id: updated.id,
        title: updated.canonicalSpec?.metadata?.title || "Untitled Spec",
        status: updated.status,
        summary: updated.canonicalSpec?.metadata?.summary || "",
      });
    }

    res.json({ ok: true, stored: updated });
  } catch (error: any) {
    console.error("Review update error:", error?.message || error);
    res.status(500).json({
      ok: false,
      error: "Failed to update review",
    });
  }
});

// GET one stored spec by id (+ rebuild adapter views)
app.get("/api/specpilot/spec/:id", (req, res) => {
  const { id } = req.params;
  const stored = getSpec(id);

  if (!stored) {
    return res.status(404).json({
      ok: false,
      error: "Spec not found",
    });
  }

  let segmentPlan = null;
  let tealiumView = null;
  let mparticleView = null;

  try {
    if (stored.canonicalSpec) {
      segmentPlan = transformToSegmentTrackingPlan(stored.canonicalSpec);
      tealiumView = transformToTealiumCdp(stored.canonicalSpec);
      mparticleView = transformToMParticleCdp(stored.canonicalSpec);
    }
  } catch (e: any) {
    console.error("Adapter build error on load:", e?.message || e);
  }

  return res.json({
    ok: true,
    stored: {
      ...stored,
      segment: segmentPlan,
      tealium: tealiumView,
      mparticle: mparticleView,
    },
  });
});

// Build adapters directly from canonical spec (used on Load Spec)
app.post("/api/specpilot/adapters-from-canonical", (req, res) => {
  try {
    const { canonicalSpec } = req.body;

    if (!canonicalSpec) {
      return res.status(400).json({
        ok: false,
        error: 'Missing "canonicalSpec" in request body',
      });
    }

    const segmentPlan = transformToSegmentTrackingPlan(canonicalSpec);
    const tealiumView = transformToTealiumCdp(canonicalSpec);
    const mparticleView = transformToMParticleCdp(canonicalSpec);

    res.json({
      ok: true,
      segment: segmentPlan,
      tealium: tealiumView,
      mparticle: mparticleView,
    });
  } catch (error: any) {
    console.error("Adapter-from-canonical error:", error?.message || error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate adapter outputs from canonical spec",
    });
  }
});

// Get all specs (for Specs list and Recent Requests)
app.get("/api/specpilot/specs", (req, res) => {
  const specs = getAllSpecs().map((s) => ({
    id: s.id,
    status: s.status,
    title: s.canonicalSpec?.metadata?.title || "Untitled",
    summary: s.canonicalSpec?.metadata?.summary || "",
    updatedAt: s.updatedAt,
  }));

  res.json({ ok: true, specs });
});

// ---------- INTEGRATIONS: SLACK & JIRA ----------

// Save Slack config for a given client
app.post("/api/integrations/slack", async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "Missing X-Client-Id" });
  }

  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ ok: false, error: "Missing webhookUrl" });
  }

  // Optional: test ping
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "✅ SpecPilot Slack integration connected." }),
    });
  } catch (e: any) {
    console.error("Slack test failed:", e?.message || e);
    return res.status(400).json({
      ok: false,
      error: "Slack webhook URL seems invalid or unreachable",
    });
  }

  setSlackConfig(clientId, { webhookUrl });
  return res.json({ ok: true });
});

// Send a spec summary to Slack (share card)
app.post("/api/specpilot/slack-share", async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "Missing X-Client-Id" });
  }

  const cfg = getConfig(clientId);
  if (!cfg?.slack?.webhookUrl) {
    return res.status(400).json({ 
      ok: false, 
      error: "Slack not configured. Please add your Slack webhook URL in Settings." 
    });
  }

  const { specId, title, summary, status, eventCount, validationScore } = req.body;

  if (!specId || !title) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  const { webhookUrl } = cfg.slack;

  // Build a rich Slack message using Block Kit
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📋 SpecPilot Specification",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${process.env.FRONTEND_URL || 'http://localhost:5173'}?spec=${specId}|${title}>*\n${summary || '_No summary provided_'}`
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status:*\n${status.charAt(0).toUpperCase() + status.slice(1)}`
        },
        {
          type: "mrkdwn",
          text: `*Events:*\n${eventCount}`
        },
        {
          type: "mrkdwn",
          text: `*Validation Score:*\n${validationScore}/100`
        },
        {
          type: "mrkdwn",
          text: `*Spec ID:*\n\`${specId}\``
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Shared via SpecPilot • ${new Date().toLocaleString()}`
        }
      ]
    }
  ];

  try {
    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!slackRes.ok) {
      const text = await slackRes.text();
      console.error("Slack share failed:", slackRes.status, text);
      return res.status(400).json({
        ok: false,
        error: "Failed to send to Slack",
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("Slack share error:", e?.message || e);
    return res.status(500).json({
      ok: false,
      error: "Error sending to Slack",
    });
  }
});

// Save Jira config for a given client
app.post("/api/integrations/jira", async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "Missing X-Client-Id" });
  }

  const { baseUrl, email, apiToken, projectKey } = req.body;
  if (!baseUrl || !email || !apiToken || !projectKey) {
    return res.status(400).json({
      ok: false,
      error: "Missing baseUrl/email/apiToken/projectKey",
    });
  }

  // Optional: basic connectivity test
  try {
    const testRes = await fetch(`${baseUrl}/rest/api/3/project/${projectKey}`, {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
        Accept: "application/json",
      },
    });

    if (!testRes.ok) {
      return res.status(400).json({
        ok: false,
        error: "Jira config test failed (project not reachable)",
        status: testRes.status,
      });
    }
  } catch (e: any) {
    console.error("Jira test failed:", e?.message || e);
    return res.status(400).json({
      ok: false,
      error: "Jira URL/token seems invalid or unreachable",
    });
  }

  setJiraConfig(clientId, { baseUrl, email, apiToken, projectKey });
  return res.json({ ok: true });
});

// (Optional) Fetch current integration status for a client
app.get("/api/integrations/me", (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "Missing X-Client-Id" });
  }

  const cfg = getConfig(clientId) || {};
  // Never return secrets; just booleans / metadata
  return res.json({
    ok: true,
    slack: !!cfg.slack,
    jira: !!cfg.jira,
  });
});


// Create a Jira issue from a stored spec
app.post("/api/specpilot/jira-ticket/:id", async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "Missing X-Client-Id" });
  }

  const { id } = req.params;
  const stored = getSpec(id);

  if (!stored) {
    return res.status(404).json({ ok: false, error: "Spec not found" });
  }

  const cfg = getConfig(clientId);
  if (!cfg?.jira) {
    return res
      .status(400)
      .json({ ok: false, error: "Jira not configured for this workspace" });
  }

  const { baseUrl, email, apiToken, projectKey } = cfg.jira;

  // Build Jira issue payload from spec
  const title =
    stored.canonicalSpec?.metadata?.title || `Spec ${stored.id}`;
  const summary =
    stored.canonicalSpec?.metadata?.summary ||
    "Spec generated from SpecPilot.";
  const statusLine = `Status: ${stored.status}`;

  const description =
    (stored.markdownSpec || "") +
    `\n\n---\nGenerated by SpecPilot\nSpec ID: ${stored.id}\n${statusLine}`;

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: description,
      issuetype: { name: "Task" }, // or "Story" if you prefer
    },
  };

  try {
    const jiraRes = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!jiraRes.ok) {
      const text = await jiraRes.text();
      console.error("Jira issue create failed:", jiraRes.status, text);
      return res.status(400).json({
        ok: false,
        error: "Failed to create Jira issue",
        status: jiraRes.status,
      });
    }

    const jiraData = await jiraRes.json(); // { key, id, self, ... }

    return res.json({
      ok: true,
      issueKey: jiraData.key,
      issueId: jiraData.id,
      url: `${baseUrl}/browse/${jiraData.key}`,
    });
  } catch (e: any) {
    console.error("Jira issue error:", e?.message || e);
    return res.status(500).json({
      ok: false,
      error: "Error calling Jira API",
    });
  }
});

// ---------- URL CONTEXT FETCH ----------
// Fetch content from a URL for business context
app.post("/api/fetch-url", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false, error: "URL is required" });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid URL format" });
  }

  try {
    // Fetch the URL content
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "SpecPilot/1.0 (Context Fetcher)",
        "Accept": "text/html,text/plain,application/json,*/*",
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      return res.status(400).json({
        ok: false,
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    let content = await response.text();

    // If HTML, try to extract meaningful text content
    if (contentType.includes("text/html")) {
      // Simple HTML to text conversion
      // Remove script and style tags with their content
      content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
      // Remove HTML tags
      content = content.replace(/<[^>]+>/g, " ");
      // Decode HTML entities
      content = content.replace(/&nbsp;/g, " ");
      content = content.replace(/&amp;/g, "&");
      content = content.replace(/&lt;/g, "<");
      content = content.replace(/&gt;/g, ">");
      content = content.replace(/&quot;/g, '"');
      content = content.replace(/&#39;/g, "'");
      // Clean up whitespace
      content = content.replace(/\s+/g, " ").trim();
    }

    // Truncate if too long (max 50KB)
    const maxLength = 50000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + "\n\n[Content truncated...]";
    }

    return res.json({
      ok: true,
      content,
      contentType,
      url,
      length: content.length,
    });
  } catch (e: any) {
    console.error("URL fetch error:", e?.message || e);
    return res.status(500).json({
      ok: false,
      error: e?.message || "Error fetching URL",
    });
  }
});

// ---------- VALIDATION CONFIG ----------
// Store validation config per client
const validationConfigs: Record<string, any> = {};

app.post("/api/validation-config", (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "X-Client-Id header required" });
  }

  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ ok: false, error: "Config is required" });
  }

  validationConfigs[clientId] = config;
  
  return res.json({ ok: true, message: "Validation config saved" });
});

app.get("/api/validation-config", (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "X-Client-Id header required" });
  }

  const config = validationConfigs[clientId] || null;
  
  return res.json({ ok: true, config });
});

// ---------- AI IMPROVE INTAKE ----------
// Rewrites vague intake to be more specific and structured
app.post("/api/specpilot/improve", async (req, res) => {
  const { input } = req.body;

  if (!input || typeof input !== "string") {
    return res.status(400).json({ ok: false, error: "Input is required" });
  }

  const improvePrompt = `You are a writing assistant that improves CDP (Customer Data Platform) tracking requests.

Your job is to take a vague or incomplete request and make it clearer and more specific - BUT keep it as natural prose, not a structured document.

RULES:
1. Keep the same casual/natural writing style as the original
2. Add missing details inline (e.g., "track checkout" → "track when a user completes checkout, including order total and items purchased")
3. Make it 1-3 sentences max - be concise
4. DO NOT use bullet points, headers, or structured formatting
5. DO NOT list properties with data types
6. DO NOT add sections like "Properties:", "Identity:", "Destinations:"
7. Just write a better, clearer version of what they asked for
8. Output ONLY the improved text, nothing else

EXAMPLES:
- Input: "track checkout"
  Output: "Track when a logged-in user completes checkout, including the order ID, total amount, payment method, and items purchased."

- Input: "we need signup tracking"  
  Output: "Track when a new user signs up, capturing their signup method (email, Google, etc.), referral source, and marketing UTM parameters."

- Input: "add cart events"
  Output: "Track add-to-cart events when users add products to their shopping cart, including the product ID, name, price, quantity, and category."

ORIGINAL INTAKE:
${input}

IMPROVED INTAKE (1-3 sentences, natural prose only):`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: improvePrompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const improved = response.choices[0]?.message?.content?.trim() || input;

    return res.json({
      ok: true,
      original: input,
      improved,
    });
  } catch (e: any) {
    console.error("Improve intake error:", e?.message || e);
    return res.status(500).json({
      ok: false,
      error: "Error improving intake",
    });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SpecPilot backend running on http://localhost:${PORT}`);
});