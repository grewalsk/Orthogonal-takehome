CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"memory" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"window_evicted_through_at" timestamp,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"model_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"evicted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"output" jsonb,
	"output_projection" jsonb,
	"price_cents" integer,
	"upstream_request_id" text,
	"status" text NOT NULL,
	"error_code" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"coalesced" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_hot_idx" ON "messages" USING btree ("conversation_id","evicted","created_at");--> statement-breakpoint
CREATE INDEX "tool_calls_conv_idx" ON "tool_calls" USING btree ("conversation_id","started_at");--> statement-breakpoint
CREATE INDEX "tool_calls_input_hash_idx" ON "tool_calls" USING btree ("tool_name","input_hash");