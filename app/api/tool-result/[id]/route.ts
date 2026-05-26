import { loadToolResult } from "@/lib/orthogonal/tool-result-store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^tr_[a-z0-9]+$/i.test(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const record = await loadToolResult(id);
  if (!record) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(record);
}
