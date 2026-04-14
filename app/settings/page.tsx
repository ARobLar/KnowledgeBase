"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface GHStatus {
  connected: boolean;
  login?: string;
  name?: string;
}

interface ActiveRepo {
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

interface GHRepo {
  full_name: string;
  html_url: string;
  private: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [ghStatus, setGhStatus] = useState<GHStatus | null>(null);
  const [ghToken, setGhToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(null);
  const [repos, setRepos] = useState<GHRepo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);

  // Load GitHub status + active repo on mount
  useEffect(() => {
    fetch("/api/auth/github/status")
      .then((r) => r.json())
      .then((d) => setGhStatus(d as GHStatus))
      .catch(() => setGhStatus({ connected: false }));

    fetch("/api/github/active-repo")
      .then((r) => r.json())
      .then((d: { repo?: ActiveRepo }) => setActiveRepo(d.repo ?? null))
      .catch(() => {});
  }, []);

  async function handleConnect() {
    if (!ghToken.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/github/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ghToken.trim() }),
      });
      const data = await res.json() as { login?: string; name?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Invalid token");
      setGhStatus({ connected: true, login: data.login, name: data.name });
      setGhToken("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/auth/github/disconnect", { method: "POST" });
    setGhStatus({ connected: false });
    setActiveRepo(null);
    setRepos(null);
    setShowRepoPicker(false);
  }

  async function loadRepos() {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json() as { repos?: GHRepo[] };
      setRepos(data.repos ?? []);
    } catch {
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }

  async function selectRepo(repo: GHRepo) {
    const r: ActiveRepo = { fullName: repo.full_name, private: repo.private, htmlUrl: repo.html_url };
    await fetch("/api/github/active-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    setActiveRepo(r);
    setShowRepoPicker(false);
  }

  async function clearActiveRepo() {
    await fetch("/api/github/active-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setActiveRepo(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface border-b border-surface-3 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h1 className="text-base font-bold text-text">Settings</h1>
          </div>
          <Link href="/" className="text-sm text-text-muted hover:text-text transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">

        {/* GitHub connection */}
        <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-3">
            <svg className="w-4 h-4 text-text" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <h2 className="text-sm font-semibold text-text">GitHub</h2>
            {ghStatus?.connected && (
              <span className="ml-auto text-xs text-success font-medium">Connected</span>
            )}
          </div>

          <div className="px-4 py-4 space-y-3">
            {ghStatus === null ? (
              <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
            ) : ghStatus.connected ? (
              <>
                <div className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3">
                  <svg className="w-5 h-5 text-text-muted shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-text">@{ghStatus.login}</p>
                    {ghStatus.name && <p className="text-xs text-text-muted">{ghStatus.name}</p>}
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  The agent can create repos, push files, and manage branches on your behalf.
                </p>
                <button
                  onClick={handleDisconnect}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors"
                >
                  Disconnect GitHub
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-text-muted">
                  Paste a Personal Access Token to connect GitHub. Your token is encrypted and stored in your Google Drive.
                </p>
                <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                  <li>Go to <strong className="text-text">github.com/settings/tokens/new</strong></li>
                  <li>Select scopes: <code className="bg-surface-2 px-1 rounded">repo</code> and <code className="bg-surface-2 px-1 rounded">workflow</code></li>
                  <li>Generate and paste below</li>
                </ol>
                <input
                  type="password"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="ghp_..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm font-mono focus:outline-none focus:border-accent transition-colors"
                />
                {error && <p className="text-error text-xs">{error}</p>}
                <button
                  onClick={handleConnect}
                  disabled={!ghToken.trim() || saving}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Verifying..." : saved ? "Connected!" : "Connect GitHub"}
                </button>
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t border-surface-3" />
                  <span className="text-xs text-text-muted">or</span>
                  <div className="flex-1 border-t border-surface-3" />
                </div>
                <a
                  href="/api/auth/github/connect"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-surface-3 hover:bg-surface-2 text-text text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Connect via GitHub OAuth
                </a>
              </>
            )}
          </div>
        </div>

        {/* Active coding repo */}
        {ghStatus?.connected && (
          <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
              <h2 className="text-sm font-semibold text-text">Dev Mode Repository</h2>
              {activeRepo && (
                <button
                  onClick={() => { setShowRepoPicker(true); if (!repos) loadRepos(); }}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Change
                </button>
              )}
            </div>
            <div className="px-4 py-4 space-y-3">
              {activeRepo ? (
                <div className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{activeRepo.fullName}</p>
                    <a href={activeRepo.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-accent transition-colors">
                      {activeRepo.htmlUrl}
                    </a>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${activeRepo.private ? "bg-surface-3 text-text-muted border-surface-3" : "bg-success/10 text-success border-success/20"}`}>
                    {activeRepo.private ? "Private" : "Public"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No active repository. Select one to use with Dev Mode.</p>
              )}

              {!showRepoPicker ? (
                <button
                  onClick={() => { setShowRepoPicker(true); if (!repos) loadRepos(); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors"
                >
                  {activeRepo ? "Change repository" : "Select repository"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-text-muted">Your repositories</p>
                    <button onClick={() => setShowRepoPicker(false)} className="text-xs text-text-muted hover:text-text">
                      Cancel
                    </button>
                  </div>
                  {loadingRepos ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}
                    </div>
                  ) : repos && repos.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-surface-3 p-1">
                      {repos.map((r) => (
                        <button
                          key={r.full_name}
                          onClick={() => selectRepo(r)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text truncate">{r.full_name}</p>
                          </div>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs border ${r.private ? "bg-surface-3 text-text-muted border-surface-3" : "bg-success/10 text-success border-success/20"}`}>
                            {r.private ? "Private" : "Public"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">No repositories found. Create one in Dev Mode.</p>
                  )}
                  {activeRepo && (
                    <button onClick={clearActiveRepo} className="w-full text-xs text-error hover:underline py-1">
                      Clear active repository
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Google Account */}
        <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-3">
            <h2 className="text-sm font-semibold text-text">Google Account</h2>
          </div>
          <div className="px-4 py-4">
            {session?.user ? (
              <div className="flex items-center gap-3">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} className="w-8 h-8 rounded-full" alt="" />
                )}
                <div>
                  <p className="text-sm font-medium text-text">{session.user.name}</p>
                  <p className="text-xs text-text-muted">{session.user.email}</p>
                </div>
                <span className="ml-auto text-xs text-success font-medium">Connected</span>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Not signed in.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
