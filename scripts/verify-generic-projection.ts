// Sanity check for lib/orthogonal/projections/generic.ts.
// Feeds three representative response shapes (Tomba scalar nesting, LinkUp
// list shape, Apollo deeply nested) through genericProject and prints
// summary + available_paths so we can eyeball whether the fallback is
// reasonable enough to ship.
//
// Run: pnpm exec tsx scripts/verify-generic-projection.ts

import "@/lib/env";
import { genericProject, buildInputSchema } from "@/lib/orthogonal/projections/generic";
import type { CatalogEndpoint } from "@/lib/orthogonal/catalog.generated";

const tombaShape = {
  data: {
    email: {
      email: "support@vercel.com",
      status: "valid",
      result: "deliverable",
      score: 99,
      smtp_provider: "google.com",
      disposable: false,
      webmail: false,
      mx: { records: [{ host: "aspmx.l.google.com", priority: 1 }] },
      smtp_check: true,
      whois: "Domain registered with Mark Monitor",
      sources: [{ uri: "https://vercel.com/contact", extracted_on: "2024-01-01" }],
    },
  },
};

const linkupShape = {
  query: "stripe ceo",
  results: [
    { type: "page", name: "About Stripe", url: "https://stripe.com/about", content: "Stripe was founded by Patrick and John Collison." },
    { type: "page", name: "Forbes", url: "https://forbes.com/x", content: "CEO Patrick Collison turned 36 last year." },
  ],
  answer: null,
};

const apolloShape = {
  organization: {
    id: "abc123",
    name: "Stripe",
    website_url: "https://stripe.com",
    primary_domain: "stripe.com",
    industry: "Financial Services",
    estimated_num_employees: 8000,
    founded_year: 2010,
    annual_revenue: 14000000000,
    short_description: "Online payment processing for internet businesses.",
    headquarters_location: { city: "San Francisco", state: "CA", country: "United States" },
    funding_events: [
      { date: "2023-03-01", amount: 6500000000, round: "Series I" },
    ],
    primary_phone: { number: "+1 415 555 0100", source: "Apollo" },
  },
};

function print(label: string, raw: unknown) {
  const proj = genericProject(raw, "tr_test01", 0.01, label);
  console.log(`\n--- ${label} ---`);
  console.log("summary:");
  for (const [k, v] of Object.entries(proj.summary)) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
  console.log("available_paths:");
  for (const p of proj.available_paths) console.log(`  ${p}`);
}

print("tomba /v1/email-verifier", tombaShape);
print("linkup /search", linkupShape);
print("apollo /organizations/enrich", apolloShape);

const fakeEndpoint: CatalogEndpoint = {
  slug: "demo",
  api: "demo",
  path: "/v1/demo",
  method: "POST",
  description: "Demo endpoint",
  priceCents: 0,
  pathParams: [],
  queryParams: [],
  bodyParams: [
    { name: "domain", type: "string", required: true, description: "Domain to enrich" },
    { name: "include_news", type: "boolean", required: false, description: "Include news events" },
    { name: "page", type: "integer", required: false, description: "Page number" },
  ],
  verified: true,
};
const inputSchema = buildInputSchema(fakeEndpoint);
console.log("\n--- buildInputSchema(demo) ---");
console.log("required parse({domain: 'stripe.com'}):", inputSchema.safeParse({ domain: "stripe.com" }).success);
console.log("missing parse({}):", inputSchema.safeParse({}).success);
console.log("with optional parse({domain: 'x', include_news: true, page: 2}):", inputSchema.safeParse({ domain: "x", include_news: true, page: 2 }).success);
