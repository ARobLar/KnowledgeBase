const BASE = "https://api.github.com";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export interface GHRepo {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

export interface GHBranch {
  name: string;
  sha: string;
}

export interface GHFile {
  path: string;
  html_url: string;
  sha: string;
}

export async function getAuthenticatedUser(token: string): Promise<{ login: string; name: string }> {
  const res = await fetch(`${BASE}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub auth failed: ${res.status}`);
  return res.json();
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<GHRepo> {
  const res = await fetch(`${BASE}/user/repos`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `GitHub error ${res.status}`);
  }
  return res.json();
}

export async function listRepos(token: string): Promise<GHRepo[]> {
  const res = await fetch(`${BASE}/user/repos?per_page=50&sort=updated`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`Failed to list repos: ${res.status}`);
  return res.json();
}

export async function getDefaultBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`Failed to get branch SHA: ${res.status}`);
  const data = await res.json();
  return data.object.sha as string;
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string
): Promise<GHBranch> {
  const sha = await getDefaultBranchSha(token, owner, repo, fromBranch);
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `GitHub error ${res.status}`);
  }
  return { name: branchName, sha };
}

export async function pushFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
): Promise<GHFile> {
  // Check if file exists to get its SHA (needed for updates)
  let existingSha: string | undefined;
  const existing = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: headers(token),
  });
  if (existing.ok) {
    const data = await existing.json();
    existingSha = data.sha;
  }

  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `GitHub error ${res.status}`);
  }
  const data = await res.json();
  return {
    path,
    html_url: data.content.html_url,
    sha: data.content.sha,
  };
}

export async function getRepoInfo(
  token: string,
  owner: string,
  repo: string
): Promise<GHRepo> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Repo not found: ${res.status}`);
  return res.json();
}
