import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createRepo,
  createBranch,
  pushFile,
  listRepos,
  getRepoInfo,
} from "@/lib/github/github-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action: string;
    token: string;
    owner?: string;
    repo?: string;
    branch?: string;
    fromBranch?: string;
    path?: string;
    content?: string;
    message?: string;
    name?: string;
    description?: string;
    private?: boolean;
  };

  const { action, token } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    switch (action) {
      case "create_repo":
        return NextResponse.json(await createRepo(token, body.name!, body.description ?? "", body.private ?? true));

      case "list_repos":
        return NextResponse.json(await listRepos(token));

      case "create_branch":
        return NextResponse.json(await createBranch(token, body.owner!, body.repo!, body.branch!, body.fromBranch ?? "main"));

      case "push_file":
        return NextResponse.json(await pushFile(token, body.owner!, body.repo!, body.path!, body.content!, body.message ?? "Update via KnowledgeBase", body.branch ?? "main"));

      case "get_repo":
        return NextResponse.json(await getRepoInfo(token, body.owner!, body.repo!));

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "GitHub error" }, { status: 500 });
  }
}
