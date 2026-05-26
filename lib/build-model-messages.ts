import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { loadManifest, renderManifest } from "@/lib/manifest";
import { readMemorySnapshot, type MemoryValue } from "@/lib/memory";

export async function buildModelMessages(
  conversationId: string,
  uiMessages: UIMessage[],
): Promise<ModelMessage[]> {
  const [manifest, memory, baseMessages] = await Promise.all([
    loadManifest(conversationId),
    readMemorySnapshot(conversationId),
    convertToModelMessages(uiMessages),
  ]);

  const systemBlocks: ModelMessage[] = [];

  const manifestText = renderManifest(manifest);
  if (manifestText) {
    systemBlocks.push({ role: "system", content: manifestText });
  }

  const memoryText = renderMemorySnapshot(memory);
  if (memoryText) {
    systemBlocks.push({ role: "system", content: memoryText });
  }

  return [...systemBlocks, ...baseMessages];
}

function renderMemorySnapshot(memory: Record<string, MemoryValue>): string {
  const entries = Object.entries(memory);
  if (entries.length === 0) return "";
  const lines = entries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
  return [
    "# Structured memory",
    "",
    "Facts persisted across conversation compactions. Each line is key = value. Use memory_read to verify before quoting a value (these may be stale).",
    "",
    ...lines,
  ].join("\n");
}
