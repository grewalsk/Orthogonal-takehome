import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("New chat"),
  memory: jsonb("memory").notNull().default({}),
  manifest: jsonb("manifest").notNull().default([]),
  windowEvictedThroughAt: timestamp("window_evicted_through_at"),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    parts: jsonb("parts").notNull(),
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    costCents: integer("cost_cents").notNull().default(0),
    evicted: boolean("evicted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("messages_conv_created_idx").on(t.conversationId, t.createdAt),
    index("messages_hot_idx").on(t.conversationId, t.evicted, t.createdAt),
  ],
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    input: jsonb("input").notNull(),
    inputHash: text("input_hash").notNull(),
    output: jsonb("output"),
    outputProjection: jsonb("output_projection"),
    priceCents: integer("price_cents"),
    upstreamRequestId: text("upstream_request_id"),
    status: text("status", {
      enum: ["pending", "success", "error", "timeout", "cache_hit", "coalesced"],
    }).notNull(),
    errorCode: text("error_code"),
    cacheHit: boolean("cache_hit").notNull().default(false),
    coalesced: boolean("coalesced").notNull().default(false),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    index("tool_calls_conv_idx").on(t.conversationId, t.startedAt),
    index("tool_calls_input_hash_idx").on(t.toolName, t.inputHash),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
