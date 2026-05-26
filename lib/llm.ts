import "@/lib/env";
import { createAnthropic } from "@ai-sdk/anthropic";

// Construct the provider explicitly so ANTHROPIC_BASE_URL from a parent
// process cannot redirect us to the wrong endpoint. Some shells (notably
// Claude Code's harness) export ANTHROPIC_BASE_URL=https://api.anthropic.com
// without the /v1 suffix, which makes @ai-sdk/anthropic POST /messages
// (404) instead of /v1/messages.
const provider = createAnthropic({
  baseURL: "https://api.anthropic.com/v1",
});

export const mainModel = provider("claude-sonnet-4-6");
export const extractionModel = provider("claude-haiku-4-5-20251001");
