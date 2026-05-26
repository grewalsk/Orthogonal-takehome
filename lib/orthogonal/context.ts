import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  conversationId: string;
  messageId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requireRequestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "Request context (conversationId + messageId) is missing. Wrap streamText in runWithRequestContext().",
    );
  }
  return ctx;
}
