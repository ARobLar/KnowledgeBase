import Link from "next/link";
import { CHANGELOG } from "@/lib/changelog";

export const metadata = { title: "Patch Notes — KnowledgeBase" };

export default function PatchesPage() {
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
  const formattedBuild = buildTime
    ? new Date(buildTime).toLocaleString("sv-SE", {
        timeZone: "Europe/Stockholm",
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface border-b border-surface-3 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <div>
              <h1 className="text-base font-bold text-text leading-tight">KnowledgeBase</h1>
              {formattedBuild && (
                <p className="text-xs text-text-muted leading-tight">
                  Deployed {formattedBuild}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/"
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-text">Patch Notes</h2>

        {CHANGELOG.map((entry) => (
          <div
            key={entry.version}
            className="rounded-2xl bg-surface border border-surface-3 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20 text-xs font-mono font-semibold">
                  v{entry.version}
                </span>
                <span className="text-sm font-semibold text-text">{entry.title}</span>
              </div>
              <span className="text-xs text-text-muted">{entry.date}</span>
            </div>
            <ul className="px-4 py-3 space-y-1.5">
              {entry.changes.map((change, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-muted">
                  <span className="text-accent mt-0.5 shrink-0">·</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
