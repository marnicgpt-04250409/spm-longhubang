import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is required");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const sql = await readFile(new URL("../supabase/migrations/0001_spm_longhubang.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("Supabase schema is ready.");
} finally {
  await client.end();
}
