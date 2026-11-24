import express from "express";
import path from "path";
import dotenv from "dotenv";
import { syncProjectToGitHub } from "./scripts/github-sync";
import analyzeChartHandler from "./api/analyze-chart";
import chatBotHandler from "./api/chat-bot";
import generateEducationalImageHandler from "./api/generate-educational-image";
import debriefTradeHandler from "./api/debrief-trade";

dotenv.config();

export const app = express();
const PORT = 3000;

// Body parser limits to support base64 chart screenshots + quantContext telemetry
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// CORS & Preflight middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-key, Cache-Control, Pragma");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Anti-caching middleware
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// ----------------------------------------------------
// API ENDPOINTS (Single Source of Truth shared with Vercel /api/* handlers)
// ----------------------------------------------------

app.get(["/api/health", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    engine: "QuantSMC Hybrid Quant + Gemini 4 Hydrogen",
    time: new Date().toISOString(),
  });
});

app.post(["/api/analyze-chart", "/analyze-chart"], async (req, res) => {
  await analyzeChartHandler(req, res);
});

app.post(["/api/chat-bot", "/chat-bot"], async (req, res) => {
  await chatBotHandler(req, res);
});

app.post(["/api/generate-educational-image", "/generate-educational-image"], async (req, res) => {
  await generateEducationalImageHandler(req, res);
});

app.post(["/api/debrief-trade", "/debrief-trade"], async (req, res) => {
  await debriefTradeHandler(req, res);
});

// GitHub Auto-Sync API Endpoint
app.post(["/api/github-sync", "/github-sync"], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { token, owner, repo, branch, commitMessage } = req.body;

    const githubToken = token || process.env.GITHUB_TOKEN;
    const githubOwner = owner || process.env.GITHUB_OWNER;
    const githubRepo = repo || process.env.GITHUB_REPO;

    if (!githubToken || !githubOwner || !githubRepo) {
      res.status(400).json({
        success: false,
        error: "Missing GitHub credentials. Provide GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.",
      });
      return;
    }

    const result = await syncProjectToGitHub({
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
      branch: branch || "main",
      commitMessage: commitMessage || "feat: QuantSMC Brain Upgrade + Chart SMC Overlays",
    });

    res.json(result);
  } catch (error: any) {
    console.error("GitHub Sync API Exception:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to push files to GitHub repository.",
    });
  }
});

// ----------------------------------------------------
// VITE OR STATIC SERVING INTEGRATION
// ----------------------------------------------------

async function mountFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[QuantSMC] Server running in ${process.env.NODE_ENV || "development"} mode at http://localhost:${PORT}`
    );
  });
}

if (!process.env.VERCEL) {
  mountFrontend();
}
