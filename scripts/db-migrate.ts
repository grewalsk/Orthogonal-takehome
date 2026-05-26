import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured in .env.local");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool);
  const started = Date.now();
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log(`Migrations applied in ${Date.now() - started}ms`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
