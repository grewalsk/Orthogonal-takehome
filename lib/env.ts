// Force-load .env.local with override:true so values in this file always win
// over inherited process env. Necessary because Claude Code's harness exports
// empty ANTHROPIC_API_KEY and a no-/v1 ANTHROPIC_BASE_URL, and Next.js does
// not override existing env vars from .env files by default.

import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}
