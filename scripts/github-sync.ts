import * as fs from "fs";
import * as path from "path";

export interface SyncOptions {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  commitMessage?: string;
}

async function githubRequest(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `Bearer ${token}`,
    "User-Agent": "Noroya-Ai-Sync",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || `GitHub API error: HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function syncProjectToGitHub(options: SyncOptions) {
  const {
    token,
    owner,
    repo,
    branch = "main",
    commitMessage = "feat: sync AI trading workstation project files from AI Studio",
  } = options;

  if (!token) throw new Error("GitHub Personal Access Token (GITHUB_TOKEN) is required.");
  if (!owner) throw new Error("GitHub Owner / Username (GITHUB_OWNER) is required.");
  if (!repo) throw new Error("GitHub Repository Name (GITHUB_REPO) is required.");

  console.log(`[GitHub Sync] Starting sync for ${owner}/${repo} on branch ${branch}...`);

  let latestCommitSha: string | null = null;

  try {
    const refData = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      token
    );
    latestCommitSha = refData.object?.sha || null;
    console.log(`[GitHub Sync] Found branch ${branch}. Latest commit: ${latestCommitSha}`);
  } catch (err: any) {
    console.log(`[GitHub Sync] Branch ${branch} might be new or empty:`, err.message);
  }

  const rootDir = process.cwd();
  const ignoreDirs = ["node_modules", "dist", ".git", ".DS_Store"];
  const ignoreFiles = [".env", ".env.local"];

  function walkDir(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (ignoreDirs.includes(file)) continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath, fileList);
      } else {
        const relativePath = path.relative(rootDir, filePath);
        if (ignoreFiles.some((f) => relativePath.endsWith(f))) continue;
        fileList.push(relativePath);
      }
    }
    return fileList;
  }

  const allFiles = walkDir(rootDir);
  console.log(`[GitHub Sync] Found ${allFiles.length} files to sync.`);

  const treeItems: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }> = [];

  for (const relPath of allFiles) {
    const absPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(absPath);
    const isBinary =
      relPath.endsWith(".png") ||
      relPath.endsWith(".jpg") ||
      relPath.endsWith(".ico") ||
      relPath.endsWith(".pdf");

    let blobData: { sha: string };
    if (isBinary) {
      blobData = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            content: content.toString("base64"),
            encoding: "base64",
          }),
        }
      );
    } else {
      blobData = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            content: content.toString("utf8"),
            encoding: "utf-8",
          }),
        }
      );
    }

    treeItems.push({
      path: relPath.replace(/\\/g, "/"),
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
  }

  // Create new tree with exactly the walked files (omitting base_tree purges deleted files)
  const newTree = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        tree: treeItems,
      }),
    }
  );
  console.log(`[GitHub Sync] Created Git tree: ${newTree.sha}`);

  const newCommit = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: latestCommitSha ? [latestCommitSha] : [],
      }),
    }
  );
  console.log(`[GitHub Sync] Created commit: ${newCommit.sha}`);

  if (latestCommitSha) {
    await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: newCommit.sha,
          force: true,
        }),
      }
    );
  } else {
    try {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: newCommit.sha,
          }),
        }
      );
    } catch {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: newCommit.sha,
            force: true,
          }),
        }
      );
    }
  }

  console.log(`[GitHub Sync] Successfully pushed ${allFiles.length} files to ${owner}/${repo} (${branch})!`);
  return { success: true, filesCount: allFiles.length, commitSha: newCommit.sha };
}
