import { NextResponse } from "next/server";

// No route-level cache — status must always be fresh
export const dynamic = "force-dynamic";

type DeployState = "ready" | "building" | "error";

export async function GET() {
  const token = process.env.VERCEL_TOKEN;
  const projectName = process.env.VERCEL_PROJECT_NAME ?? "knowledge-base";

  if (!token) {
    return NextResponse.json({ state: "ready" as DeployState });
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?app=${encodeURIComponent(projectName)}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ state: "ready" as DeployState });

    const data = await res.json() as { deployments?: { state?: string }[] };
    const latest = data.deployments?.[0];
    const raw = latest?.state?.toUpperCase() ?? "";

    let state: DeployState = "ready";
    if (["ERROR", "CANCELED"].includes(raw)) state = "error";
    else if (["BUILDING", "INITIALIZING", "QUEUED"].includes(raw)) state = "building";

    return NextResponse.json({ state });
  } catch {
    return NextResponse.json({ state: "ready" as DeployState });
  }
}
