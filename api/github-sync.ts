import { syncProjectToGitHub } from "../scripts/github-sync";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-key, Cache-Control, Pragma");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { token, owner, repo, branch, commitMessage } = req.body || {};

    const githubToken = token || process.env.GITHUB_TOKEN;
    const githubOwner = owner || process.env.GITHUB_OWNER;
    const githubRepo = repo || process.env.GITHUB_REPO;

    if (!githubToken || !githubOwner || !githubRepo) {
      res.status(400).json({
        success: false,
        error: "Missing GitHub credentials. Please provide GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in the request body or environment variables.",
      });
      return;
    }

    const result = await syncProjectToGitHub({
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
      branch: branch || "main",
      commitMessage: commitMessage || "feat: automatic push of AI trading workstation to GitHub repository",
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error("GitHub Sync API Exception:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to push files to GitHub repository.",
    });
  }
}
