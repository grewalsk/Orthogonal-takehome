import { stepCountIs, streamText, type UIMessage } from "ai";
import { mainModel } from "@/lib/llm";
import { buildToolPalette, specialistPool } from "@/lib/orthogonal/tools.generated";
import { memory_read, memory_write, read_tool_result } from "@/lib/orthogonal/context-tools";
import { runWithRequestContext } from "@/lib/orthogonal/context";
import { buildModelMessages } from "@/lib/build-model-messages";
import { maybeTriggerEviction } from "@/lib/eviction";
import { routeTools } from "@/lib/orthogonal/router";
import {
  createPendingAssistantMessage,
  ensureConversation,
  finalizeAssistantMessage,
  saveUserMessage,
} from "@/lib/messages";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatRequestBody {
  id: string;
  messages: UIMessage[];
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const conversationId = body.id;
  const uiMessages = body.messages;
  if (!conversationId || !Array.isArray(uiMessages) || uiMessages.length === 0) {
    return Response.json({ error: "id and non-empty messages[] required" }, { status: 400 });
  }
  const lastUserMessage = uiMessages.at(-1);
  if (!lastUserMessage || lastUserMessage.role !== "user") {
    return Response.json({ error: "last message must be from user" }, { status: 400 });
  }

  await ensureConversation(conversationId);
  await saveUserMessage(conversationId, lastUserMessage);

  const assistantMessageId = await createPendingAssistantMessage(conversationId, "claude-sonnet-4-6");

  // Run the specialist router in parallel with prompt assembly. Router
  // latency (~1.5s mean) hides behind the database reads inside
  // buildModelMessages, so the user does not pay it sequentially. The
  // palette hint is rendered inside the latest user message content
  // (with manifest + memory) so anchor 2 on the historical tail stays
  // stable across turns.
  const userText = extractText(lastUserMessage);
  const recentContextText = recentContext(uiMessages);
  const routerPromise = routeTools({
    userMessage: userText,
    specialists: specialistPool(),
    recentContext: recentContextText,
    k: 6,
  }).then((r) => ({ selected: r.selected, reasoning: r.reasoning }));

  const [modelMessages, routerResult] = await Promise.all([
    buildModelMessages(conversationId, uiMessages, { paletteHintPromise: routerPromise }),
    routerPromise,
  ]);

  const palette = buildToolPalette(routerResult.selected);
  const tools = { ...palette, read_tool_result, memory_write, memory_read };

  return runWithRequestContext({ conversationId, messageId: assistantMessageId }, async () => {
    const result = streamText({
      model: mainModel,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(8),
      experimental_telemetry: { isEnabled: true },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      generateMessageId: () => assistantMessageId,
      onFinish: async ({ responseMessage }) => {
        const parts = responseMessage.parts;
        const totalUsage = await result.totalUsage;
        await finalizeAssistantMessage({
          messageId: assistantMessageId,
          conversationId,
          parts,
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            cachedInputTokens: totalUsage.inputTokenDetails?.cacheReadTokens,
            cacheCreationInputTokens: totalUsage.inputTokenDetails?.cacheWriteTokens,
          },
        });
        maybeTriggerEviction(conversationId).catch((err) =>
          console.error("eviction job failed:", err instanceof Error ? err.message : err),
        );
      },
    });
  });
}

function extractText(message: UIMessage): string {
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => (p as { type?: string }).type === "text")
    .map((p) => p.text)
    .join("\n");
}

function recentContext(uiMessages: UIMessage[]): string {
  // Last assistant message and the second-to-last user message, if any.
  // Gives the router enough context for follow-up queries like "what about
  // their funding" without bloating the router prompt.
  const tail = uiMessages.slice(-5, -1);
  const lines: string[] = [];
  for (const m of tail) {
    const text = extractText(m);
    if (!text) continue;
    lines.push(`${m.role.toUpperCase()}: ${text.slice(0, 400)}`);
  }
  return lines.join("\n");
}

