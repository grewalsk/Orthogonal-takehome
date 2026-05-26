import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { mainModel } from "@/lib/llm";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { orthogonalTools } from "@/lib/orthogonal/tools.generated";
import { memory_read, memory_write, read_tool_result } from "@/lib/orthogonal/context-tools";
import { runWithRequestContext } from "@/lib/orthogonal/context";
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

  const modelMessages = await convertToModelMessages(uiMessages);

  return runWithRequestContext({ conversationId, messageId: assistantMessageId }, async () => {
    const result = streamText({
      model: mainModel,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { ...orthogonalTools, read_tool_result, memory_write, memory_read },
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
            cachedInputTokens: totalUsage.cachedInputTokens,
          },
        });
      },
    });
  });
}
