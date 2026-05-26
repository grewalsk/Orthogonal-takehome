import { randomBytes } from "node:crypto";

export interface ToolResultRecord {
  slug: string;
  api: string;
  path: string;
  input: unknown;
  output: unknown;
  priceCents: number;
  upstreamRequestId?: string;
  cacheHit: boolean;
  storedAt: number;
}

export interface ToolResultInput {
  slug: string;
  api: string;
  path: string;
  input: unknown;
  output: unknown;
  priceCents: number;
  upstreamRequestId?: string;
  cacheHit: boolean;
}

const mockStore = new Map<string, ToolResultRecord>();

export async function storeToolResult(record: ToolResultInput): Promise<string> {
  const id = `tr_${randomBytes(4).toString("hex")}`;
  mockStore.set(id, { ...record, storedAt: Date.now() });
  return id;
}

export async function loadToolResult(id: string): Promise<ToolResultRecord | null> {
  return mockStore.get(id) ?? null;
}

export function __resetForTests(): void {
  mockStore.clear();
}
