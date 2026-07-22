import { Octokit } from "octokit";
import * as fs from "fs";
import * as path from "path";

export interface SyncOptions {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  commitMessage?: string;
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

  const octokit = new Octokit({ auth: token });

  console.log(`[GitHub Sync] Starting sync for ${owner}/${repo} on branch ${branch}...`);

  let latestCommitSha: string | null = null;
  let baseTreeSha: string | null = null;

  try {
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    latestCommitSha = refData.object.sha;
    
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });
    baseTreeSha = commitData.tree.sha;
    console.log(`[GitHub Sync] Found existing branch ${branch}. Base commit: ${latestCommitSha}`);
  } catch (err: any) {
    console.log(`[GitHub Sync] Branch ${branch} might be new or empty. Creating initial commit structure...`);
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
    mode: "100644" | "100755" | "040000" | "160000" | "120000";
    type: "blob" | "tree" | "commit";
    sha?: string;
  }> = [];

  for (const relPath of allFiles) {
    const absPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(absPath);
    const isBinary = relPath.endsWith(".png") || relPath.endsWith(".jpg") || relPath.endsWith(".ico") || relPath.endsWith(".pdf");
    
    let blobData: { sha: string };
    if (isBinary) {
      const base64Content = content.toString("base64");
      const { data } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: "base64",
      });
      blobData = data;
    } else {
      const textContent = content.toString("utf8");
      const { data } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: textContent,
        encoding: "utf-8",
      });
      blobData = data;
    }

    treeItems.push({
      path: relPath.replace(/\\/g, "/"),
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
  }

  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha || undefined,
    tree: treeItems as any,
  });
  console.log(`[GitHub Sync] Created Git tree: ${newTree.sha}`);

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: latestCommitSha ? [latestCommitSha] : [],
  });
  console.log(`[GitHub Sync] Created commit: ${newCommit.sha}`);

  if (latestCommitSha) {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
      force: true,
    });
  } else {
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
      });
    } catch {
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
        force: true,
      });
    }
  }

  console.log(`[GitHub Sync] Successfully pushed ${allFiles.length} files to ${owner}/${repo} (${branch})!`);
  return { success: true, filesCount: allFiles.length, commitSha: newCommit.sha };
}
