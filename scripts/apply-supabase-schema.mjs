import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is required");
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: true },
});
await client.connect();
try {
  for (const migration of migrationFiles) {
    await client.query(await readFile(new URL(migration, migrationDirectory), "utf8"));
    console.log(`Applied ${migration}`);
  }
  console.log("Supabase schema is ready.");
} finally {
  await client.end();
}
