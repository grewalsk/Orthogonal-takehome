// Sanity check for lib/orthogonal/router.ts.
//
// Feeds 7 canonical queries through the Haiku router with the full
// specialist pool (catalog minus core-tier) and prints what got selected.
// Looks for sensible matches and notes whether cache writes happen on the
// first call and reads on the second.
//
// Run: pnpm exec tsx scripts/verify-router.ts
// Costs roughly $0.005-0.02 in Haiku spend.

import "@/lib/env";
import { catalog } from "@/lib/orthogonal/catalog.generated";
import { routeTools, type SpecialistEndpoint } from "@/lib/orthogonal/router";

const CORE_SLUGS = new Set([
  "apollo_organizations_enrich",
  "apollo_people_match",
  "apollo_mixed_people_search",
  "hunter_domain_search",
  "hunter_email_finder",
  "hunter_companies_find",
  "tomba_email_verifier",
  "linkup_search",
  "olostep_scrapes",
]);

const specialists: SpecialistEndpoint[] = catalog
  .filter((e) => !CORE_SLUGS.has(e.slug))
  .map((e) => ({ slug: e.slug, description: e.description, api: e.api }));

console.log(`Specialist pool size: ${specialists.length} of ${catalog.length}`);

const queries: Array<{ label: string; q: string; expectAtLeastOneOf: string[] }> = [
  {
    label: "tech detection",
    q: "what tech stack does shopify use",
    expectAtLeastOneOf: ["tomba_technology", "predictleads_technologies", "predictleads_discover_companies"],
  },
  {
    label: "funding",
    q: "show me recent funding rounds for AI startups",
    expectAtLeastOneOf: ["predictleads_discover_financing_events", "fundable_company_search", "fundable_investors_search"],
  },
  {
    label: "google news",
    q: "google news about openai this week",
    expectAtLeastOneOf: ["serper_news", "serper_search", "predictleads_discover_news_events"],
  },
  {
    label: "weather flex",
    q: "how much rain did Seattle get in the last 48 hours",
    expectAtLeastOneOf: ["precip_last_48", "precip_daily"],
  },
  {
    label: "brand colors",
    q: "what are stripe brand colors and logo",
    expectAtLeastOneOf: ["branddev_retrieve", "branddev_fonts", "logo_search"],
  },
  {
    label: "voice models",
    q: "list available eleven labs voices",
    expectAtLeastOneOf: ["elevenlabs_voices", "elevenlabs_models"],
  },
  {
    label: "identity verify",
    q: "verify if this person id and address are valid in the US database",
    expectAtLeastOneOf: ["didit_database_validation"],
  },
];

async function main() {
  let pass = 0;
  let totalMs = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  for (const tc of queries) {
    const r = await routeTools({ userMessage: tc.q, specialists, k: 6 });
    const hit = tc.expectAtLeastOneOf.some((s) => r.selected.includes(s));
    pass += hit ? 1 : 0;
    totalMs += r.routerMs;
    totalCacheRead += r.cacheReadTokens;
    totalCacheWrite += r.cacheWriteTokens;
    console.log(
      `\n[${hit ? "PASS" : "FAIL"}] ${tc.label}  (${r.routerMs}ms, cache R=${r.cacheReadTokens} W=${r.cacheWriteTokens})`,
    );
    console.log(`  query:    ${tc.q}`);
    console.log(`  expected: ${tc.expectAtLeastOneOf.join(" OR ")}`);
    console.log(`  selected: ${r.selected.join(", ") || "(empty)"}`);
    console.log(`  reason:   ${r.reasoning}`);
  }
  console.log(
    `\nSummary: ${pass}/${queries.length} passes, total ${totalMs}ms, cache reads=${totalCacheRead}, cache writes=${totalCacheWrite}`,
  );
  if (totalCacheRead > 0) {
    console.log("Cache reads observed after turn 1: prompt cache anchor is working.");
  }
  process.exit(pass === queries.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
