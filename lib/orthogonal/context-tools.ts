import { tool } from "ai";
import { z } from "zod";
import { JSONPath } from "jsonpath-plus";
import { loadToolResult } from "@/lib/orthogonal/tool-result-store";

const MAX_RESULT_BYTES = 2048;

export const read_tool_result = tool({
  description:
    "Read specific fields from a previously stored tool result by its result_id (looks like 'tr_a1b2c3d4') and a JSONPath expression (e.g. '$.person.employment_history[*].title'). Use this to drill into past tool calls without re-running an Orthogonal endpoint (which costs money). Returns the matched values, truncated to 2KB if very large; refine the json_path to narrow if you hit the truncation.",
  inputSchema: z.object({
    result_id: z
      .string()
      .regex(/^tr_[a-z0-9]+$/i, "result_id must look like tr_<hex>"),
    json_path: z
      .string()
      .min(1)
      .describe(
        "JSONPath expression rooted at the raw upstream payload, e.g. '$.person.employment_history[*]' or '$.data.emails[0:5].value'",
      ),
  }),
  execute: async ({ result_id, json_path }) => {
    const record = await loadToolResult(result_id);
    if (!record) {
      return {
        result_id,
        json_path,
        error: `No tool result with id ${result_id}. The manifest should list real result_ids; re-check or re-run the source tool.`,
      };
    }
    let matches: unknown[];
    try {
      matches = JSONPath({
        path: json_path,
        json: record.output as object,
        resultType: "value",
      });
    } catch (err) {
      return {
        result_id,
        json_path,
        error: `Invalid JSONPath: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!Array.isArray(matches) || matches.length === 0) {
      return { result_id, json_path, matches: [], total_matches: 0 };
    }

    const serialized = JSON.stringify(matches);
    if (serialized.length <= MAX_RESULT_BYTES) {
      return { result_id, json_path, total_matches: matches.length, matches };
    }

    const firstPreview =
      typeof matches[0] === "string"
        ? (matches[0] as string).slice(0, 1500)
        : JSON.stringify(matches[0]).slice(0, 1500);

    return {
      result_id,
      json_path,
      truncated: true,
      total_matches: matches.length,
      first_match_preview: firstPreview,
      hint: "Result exceeded 2KB. Refine json_path to narrow (add an index like [0:5] to slice arrays, or descend deeper).",
    };
  },
});
