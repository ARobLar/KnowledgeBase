"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const GH_TOKEN_KEY = "kb_github_token";
const GH_USER_KEY = "kb_github_user";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [ghToken, setGhToken] = useState("");
  const [ghUser, setGhUser] = useState<{ login: string; name: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(GH_TOKEN_KEY);
    const storedUser = localStorage.getItem(GH_USER_KEY);
    if (stored) setGhToken(stored);
    if (storedUser) setGhUser(JSON.parse(storedUser));
  }, []);

  async function handleConnect() {
    if (!ghToken.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/github/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ghToken.trim() }),
      });
      const data = await res.json() as { login?: string; name?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Invalid token");
      const user = { login: data.login!, name: data.name! };
      localStorage.setItem(GH_TOKEN_KEY, ghToken.trim());
      localStorage.setItem(GH_USER_KEY, JSON.stringify(user));
      setGhUser(user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify");
    } finally {
      setVerifying(false);
    }
  }

  function handleDisconnect() {
    localStorage.removeItem(GH_TOKEN_KEY);
    localStorage.removeItem(GH_USER_KEY);
    setGhUser(null);
    setGhToken("");
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

        {/* GitHub */}
        <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-3">
            <svg className="w-4 h-4 text-text" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <h2 className="text-sm font-semibold text-text">GitHub</h2>
            {ghUser && (
              <span className="ml-auto text-xs text-success font-medium">Connected</span>
            )}
          </div>

          <div className="px-4 py-4 space-y-3">
            {ghUser ? (
              <>
                <div className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3">
                  <svg className="w-5 h-5 text-text-muted shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-text">@{ghUser.login}</p>
                    {ghUser.name && <p className="text-xs text-text-muted">{ghUser.name}</p>}
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  The agent can now create repos, push files, and manage branches on your behalf.
                  Say things like <em>"create a new repo called my-project"</em> or <em>"push this to GitHub"</em>.
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
                  Connect a GitHub Personal Access Token to let the agent create repositories, push files, and create branches.
                </p>
                <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                  <li>Go to <strong className="text-text">github.com/settings/tokens/new</strong></li>
                  <li>Select scopes: <code className="bg-surface-2 px-1 rounded">repo</code> and <code className="bg-surface-2 px-1 rounded">workflow</code></li>
                  <li>Generate and paste the token below</li>
                </ol>
                <input
                  type="password"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm font-mono focus:outline-none focus:border-accent transition-colors"
                />
                {error && <p className="text-error text-xs">{error}</p>}
                <button
                  onClick={handleConnect}
                  disabled={!ghToken.trim() || verifying}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? "Verifying..." : saved ? "Connected!" : "Connect GitHub"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Account info */}
        <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-3">
            <h2 className="text-sm font-semibold text-text">Google Account</h2>
          </div>
          <div className="px-4 py-4">
            {session?.user ? (
              <div className="flex items-center gap-3">
                {session.user.image && (
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
