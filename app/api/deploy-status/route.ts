import { NextResponse } from "next/server";

export const revalidate = 30; // cache for 30s

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
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 30 } }
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
