"use client";

import { useEffect, useRef, useState } from "react";

interface GHStatus {
  connected: boolean;
  login?: string;
  name?: string;
}

export function GitHubButton() {
  const [status, setStatus] = useState<GHStatus | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/github/status")
      .then((r) => r.json())
      .then((d) => setStatus(d as GHStatus))
      .catch(() => setStatus({ connected: false }));
  }, []);

  // Handle ?gh_connected=1 after OAuth redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gh_connected")) {
      fetch("/api/auth/github/status")
        .then((r) => r.json())
        .then((d) => setStatus(d as GHStatus));
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/auth/github/disconnect", { method: "POST" });
    setStatus({ connected: false });
    setShowMenu(false);
    setDisconnecting(false);
  }

  if (status === null) return null; // loading

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          if (status.connected) {
            setShowMenu((v) => !v);
          } else {
            window.location.href = "/api/auth/github/connect";
          }
        }}
        className={`relative p-2 rounded-lg transition-colors ${
          status.connected
            ? "text-text hover:bg-surface-2"
            : "text-text-muted hover:text-text hover:bg-surface-2"
        }`}
        aria-label={status.connected ? `GitHub: @${status.login}` : "Connect GitHub"}
        title={status.connected ? `GitHub: @${status.login}` : "Connect GitHub"}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        {/* Green dot when connected */}
        {status.connected && (
          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-success border border-background" />
        )}
      </button>

      {/* Connected menu */}
      {showMenu && status.connected && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-surface border border-surface-3 shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-surface-3">
            <p className="text-xs font-semibold text-text">@{status.login}</p>
            {status.name && <p className="text-xs text-text-muted">{status.name}</p>}
          </div>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="w-full px-3 py-2.5 text-left text-xs text-error hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect GitHub"}
          </button>
        </div>
      )}
    </div>
  );
}
