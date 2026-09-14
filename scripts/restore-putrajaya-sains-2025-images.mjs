import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "..");
const envText = fs.readFileSync(path.join(root, ".env.local"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]])
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase production credentials are unavailable.");
const supabase = createClient(url, key, { auth: { persistSession: false } });
const bucket = "question-images";

const questions = [
  {
    id: "01fc2890-9587-4418-8cee-5e13b8479825",
    file: "sains-putrajaya-2025-q04-rajah1.png",
    storagePath: "verified-trial/2025-putrajaya-sains-k1/q04-rajah1.png",
    topic: "Tingkatan 4 · Bab 2 Bantuan Kecemasan",
    alt: "Rajah 1 kaedah Heimlich Manoeuvre daripada Trial SPM Sains Putrajaya 2025 Kertas 1, soalan 4.",
  },
  {
    id: "1cb51c83-42c4-43f4-a206-1c7b7badef1e",
    file: "sains-putrajaya-2025-q23-rajah9.png",
    storagePath: "verified-trial/2025-putrajaya-sains-k1/q23-rajah9.png",
    topic: "Tingkatan 4 · Bab 11 Daya dan Gerakan",
    alt: "Rajah 9 motosikal daripada Trial SPM Sains Putrajaya 2025 Kertas 1, soalan 23.",
  },
  {
    id: "887127fc-e1c1-4f48-9c33-1c6003b597be",
    file: "sains-putrajaya-2025-q27-rajah10.png",
    storagePath: "verified-trial/2025-putrajaya-sains-k1/q27-rajah10.png",
    topic: "Tingkatan 5 · Bab 1 Mikroorganisma",
    alt: "Rajah 10 pertumbuhan kulat pada roti daripada Trial SPM Sains Putrajaya 2025 Kertas 1, soalan 27.",
  },
];

for (const item of questions) {
  const image = fs.readFileSync(path.join(root, "assets", "question-images", item.file));
  const uploaded = await supabase.storage.from(bucket).upload(item.storagePath, image, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: true,
  });
  if (uploaded.error) throw uploaded.error;

  const updated = await supabase
    .from("questions")
    .update({
      image_path: item.storagePath,
      image_alt: item.alt,
      topic: item.topic,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .select("id,subject,topic,status,image_path")
    .single();
  if (updated.error) throw updated.error;
  console.log(JSON.stringify(updated.data));
}

const { data: verified, error } = await supabase
  .from("questions")
  .select("id,topic,status,image_path,image_alt")
  .in("id", questions.map((item) => item.id));
if (error) throw error;
if (
  verified?.length !== questions.length ||
  verified.some((item) => item.status !== "published" || !item.image_path || !item.topic)
) throw new Error("Production verification failed.");
console.log(JSON.stringify({ restored: verified.length, verified }, null, 2));
