import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase production credentials are unavailable.");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const sourceLabels = {
  Fizik:
    "老师供题｜来源文件：FIZIK_K1_TERENGGANU_2026_question_bank.xlsx（原卷年份与图片待核实）",
  Kimia:
    "老师供题｜来源文件：Kimia_SPM_Trial_Melaka_2026.xlsx（原卷年份与图片待核实）",
  Biologi:
    "老师供题｜来源文件：SBP_2026_BIO1_question_bank.xlsx（汇编来源；原卷年份与图片待核实）",
};

const physicsByNumber = new Map([
  [1, "Tingkatan 4 · Bab 1 Pengukuran"],
  [2, "Tingkatan 4 · Bab 1 Pengukuran"],
  ...[3, 4, 5, 6, 7, 8, 9].map((number) => [number, "Tingkatan 4 · Bab 2 Daya dan Gerakan I"]),
  ...[10, 11, 12].map((number) => [number, "Tingkatan 4 · Bab 3 Kegravitian"]),
  ...[13, 14, 15].map((number) => [number, "Tingkatan 4 · Bab 4 Haba"]),
  [16, "Tingkatan 4 · Bab 5 Gelombang"],
  [17, "Tingkatan 4 · Bab 6 Cahaya dan Optik"],
  [18, "Tingkatan 4 · Bab 5 Gelombang"],
  [19, "Tingkatan 4 · Bab 5 Gelombang"],
  ...[20, 21, 22].map((number) => [number, "Tingkatan 4 · Bab 6 Cahaya dan Optik"]),
  ...[23, 24, 25].map((number) => [number, "Tingkatan 5 · Bab 1 Daya dan Gerakan II"]),
  ...[26, 27, 28, 29].map((number) => [number, "Tingkatan 5 · Bab 2 Tekanan"]),
  [30, "Tingkatan 5 · Bab 3 Elektrik"],
  [31, "Tingkatan 5 · Bab 3 Elektrik"],
  ...[32, 33, 34].map((number) => [number, "Tingkatan 5 · Bab 4 Keelektromagnetan"]),
  [35, "Tingkatan 5 · Bab 5 Elektronik"],
  [36, "Tingkatan 5 · Bab 5 Elektronik"],
  [37, "Tingkatan 5 · Bab 6 Fizik Nuklear"],
  [38, "Tingkatan 5 · Bab 6 Fizik Nuklear"],
  [39, "Tingkatan 5 · Bab 7 Fizik Kuantum"],
  [40, "Tingkatan 5 · Bab 7 Fizik Kuantum"],
]);

const biologyByNumber = new Map([
  [1, "Tingkatan 4 · Bab 1 Pengenalan kepada Biologi dan Peraturan Makmal"],
  [2, "Tingkatan 4 · Bab 2 Biologi Sel dan Organisasi Sel"],
  [3, "Tingkatan 4 · Bab 3 Pergerakan Bahan Merentasi Membran Plasma"],
  [4, "Tingkatan 4 · Bab 3 Pergerakan Bahan Merentasi Membran Plasma"],
  [5, "Tingkatan 4 · Bab 4 Komposisi Kimia dalam Sel"],
  [6, "Tingkatan 4 · Bab 5 Metabolisme dan Enzim"],
  [7, "Tingkatan 4 · Bab 5 Metabolisme dan Enzim"],
  [8, "Tingkatan 4 · Bab 6 Pembahagian Sel"],
  [9, "Tingkatan 4 · Bab 6 Pembahagian Sel"],
  [10, "Tingkatan 4 · Bab 7 Respirasi Sel"],
  [11, "Tingkatan 4 · Bab 8 Sistem Respirasi dalam Manusia dan Haiwan"],
  [12, "Tingkatan 4 · Bab 9 Nutrisi dan Sistem Pencernaan Manusia"],
  [13, "Tingkatan 4 · Bab 10 Pengangkutan dalam Manusia dan Haiwan"],
  [14, "Tingkatan 4 · Bab 10 Pengangkutan dalam Manusia dan Haiwan"],
  [15, "Tingkatan 4 · Bab 11 Keimunan Manusia"],
  [16, "Tingkatan 4 · Bab 11 Keimunan Manusia"],
  [17, "Tingkatan 4 · Bab 12 Koordinasi dan Gerak Balas dalam Manusia"],
  [18, "Tingkatan 4 · Bab 13 Homeostasis dan Sistem Urinari Manusia"],
  [19, "Tingkatan 4 · Bab 13 Homeostasis dan Sistem Urinari Manusia"],
  [20, "Tingkatan 4 · Bab 14 Sokongan dan Pergerakan dalam Manusia dan Haiwan"],
  [21, "Tingkatan 4 · Bab 15 Pembiakan Seks, Perkembangan dan Pertumbuhan"],
  [22, "Tingkatan 5 · Bab 1 Organisasi Tisu Tumbuhan dan Pertumbuhan"],
  [23, "Tingkatan 5 · Bab 2 Struktur dan Fungsi Daun"],
  [24, "Tingkatan 5 · Bab 9 Ekosistem"],
  [25, "Tingkatan 5 · Bab 3 Nutrisi dalam Tumbuhan"],
  [26, "Tingkatan 5 · Bab 4 Pengangkutan dalam Tumbuhan"],
  [27, "Tingkatan 5 · Bab 5 Gerak Balas dalam Tumbuhan"],
  [28, "Tingkatan 5 · Bab 6 Pembiakan Seks dalam Tumbuhan Berbunga"],
  [29, "Tingkatan 5 · Bab 6 Pembiakan Seks dalam Tumbuhan Berbunga"],
  [30, "Tingkatan 5 · Bab 7 Penyesuaian Tumbuhan pada Habitat"],
  [31, "Tingkatan 5 · Bab 8 Biodiversiti"],
  [32, "Tingkatan 5 · Bab 9 Ekosistem"],
  [33, "Tingkatan 5 · Bab 9 Ekosistem"],
  [34, "Tingkatan 5 · Bab 10 Kelestarian Alam Sekitar"],
  [35, "Tingkatan 5 · Bab 11 Pewarisan"],
  [36, "Tingkatan 5 · Bab 11 Pewarisan"],
  [37, "Tingkatan 5 · Bab 12 Variasi"],
  [38, "Tingkatan 5 · Bab 12 Variasi"],
  [39, "Tingkatan 5 · Bab 13 Teknologi Genetik"],
  [40, "Tingkatan 5 · Bab 10 Kelestarian Alam Sekitar"],
]);

const biologyRepairTopics = new Map([
  ["Biologi sel", "Tingkatan 4 · Bab 2 Biologi Sel dan Organisasi Sel"],
  ["Pergerakan bahan", "Tingkatan 4 · Bab 3 Pergerakan Bahan Merentasi Membran Plasma"],
  ["Enzim", "Tingkatan 4 · Bab 5 Metabolisme dan Enzim"],
  ["Pembahagian sel", "Tingkatan 4 · Bab 6 Pembahagian Sel"],
  ["Respirasi", "Tingkatan 4 · Bab 7 Respirasi Sel"],
  ["Fotosintesis", "Tingkatan 5 · Bab 2 Struktur dan Fungsi Daun"],
  ["Nutrisi", "Tingkatan 4 · Bab 9 Nutrisi dan Sistem Pencernaan Manusia"],
  ["Pengangkutan manusia", "Tingkatan 4 · Bab 10 Pengangkutan dalam Manusia dan Haiwan"],
  ["Sistem peredaran", "Tingkatan 4 · Bab 10 Pengangkutan dalam Manusia dan Haiwan"],
  ["Homeostasis", "Tingkatan 4 · Bab 13 Homeostasis dan Sistem Urinari Manusia"],
  ["Koordinasi", "Tingkatan 4 · Bab 12 Koordinasi dan Gerak Balas dalam Manusia"],
  ["Pembiakan", "Tingkatan 4 · Bab 15 Pembiakan Seks, Perkembangan dan Pertumbuhan"],
  ["Genetik", "Tingkatan 5 · Bab 11 Pewarisan"],
  ["Ekologi", "Tingkatan 5 · Bab 9 Ekosistem"],
  ["Bioteknologi", "Tingkatan 5 · Bab 13 Teknologi Genetik"],
  ["Variasi", "Tingkatan 5 · Bab 12 Variasi"],
]);

const chemistryTopics = [
  "Tingkatan 4 · Bab 7 Kadar Tindak Balas",
  "Tingkatan 4 · Bab 3 Konsep Mol, Formula dan Persamaan Kimia",
  "Tingkatan 5 · Bab 3 Termokimia",
  "Tingkatan 5 · Bab 5 Kimia Konsumer dan Industri",
  "Tingkatan 4 · Bab 2 Jirim dan Struktur Atom",
  "Tingkatan 4 · Bab 4 Jadual Berkala Unsur",
  "Tingkatan 4 · Bab 5 Ikatan Kimia",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 4 · Bab 3 Konsep Mol, Formula dan Persamaan Kimia",
  "Tingkatan 4 · Bab 8 Bahan Buatan dalam Industri",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 4 · Bab 8 Bahan Buatan dalam Industri",
  "Tingkatan 5 · Bab 1 Keseimbangan Redoks",
  "Tingkatan 5 · Bab 5 Kimia Konsumer dan Industri",
  "Tingkatan 5 · Bab 1 Keseimbangan Redoks",
  "Tingkatan 4 · Bab 3 Konsep Mol, Formula dan Persamaan Kimia",
  "Tingkatan 4 · Bab 5 Ikatan Kimia",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
  "Tingkatan 4 · Bab 5 Ikatan Kimia",
  "Tingkatan 4 · Bab 2 Jirim dan Struktur Atom",
  "Tingkatan 5 · Bab 4 Polimer",
  "Tingkatan 5 · Bab 1 Keseimbangan Redoks",
  "Tingkatan 4 · Bab 4 Jadual Berkala Unsur",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 5 · Bab 1 Keseimbangan Redoks",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 5 · Bab 3 Termokimia",
  "Tingkatan 4 · Bab 4 Jadual Berkala Unsur",
  "Tingkatan 4 · Bab 2 Jirim dan Struktur Atom",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
  "Tingkatan 5 · Bab 1 Keseimbangan Redoks",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 5 · Bab 5 Kimia Konsumer dan Industri",
  "Tingkatan 4 · Bab 7 Kadar Tindak Balas",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
  "Tingkatan 5 · Bab 2 Sebatian Karbon",
  "Tingkatan 4 · Bab 3 Konsep Mol, Formula dan Persamaan Kimia",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
  "Tingkatan 4 · Bab 6 Asid, Bes dan Garam",
];

function numberFromPrompt(prompt) {
  const match = prompt.match(/^\s*(\d+)\./);
  return match ? Number(match[1]) : null;
}

function groupUpdates(updates) {
  const groups = new Map();
  for (const update of updates) {
    const key = JSON.stringify({ topic: update.topic, source_label: update.source_label });
    const group = groups.get(key) ?? { values: JSON.parse(key), ids: [] };
    group.ids.push(update.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const before = {};
for (const subject of ["Fizik", "Kimia", "Biologi"]) {
  const { data, error } = await supabase
    .from("questions")
    .select("id,prompt,topic,status,source_label,source_key,created_at")
    .eq("subject", subject)
    .order("created_at");
  if (error) throw error;
  before[subject] = {
    total: data.length,
    drafts: data.filter((question) => question.status === "draft").length,
  };

  const updates = data.map((question, index) => {
    let topic;
    let sourceLabel = question.source_label;
    if (subject === "Fizik") {
      topic = physicsByNumber.get(numberFromPrompt(question.prompt));
      sourceLabel = sourceLabels.Fizik;
    } else if (subject === "Kimia") {
      topic = chemistryTopics[index];
      sourceLabel = sourceLabels.Kimia;
    } else if (question.source_key?.startsWith("myguru:2026:biology:text-repair:")) {
      topic = biologyRepairTopics.get(question.topic);
    } else {
      topic = biologyByNumber.get(numberFromPrompt(question.prompt));
      sourceLabel = sourceLabels.Biologi;
    }
    if (!topic) throw new Error(`No chapter mapping for ${subject}: ${question.prompt}`);
    return { id: question.id, topic, source_label: sourceLabel };
  });

  for (const group of groupUpdates(updates)) {
    const { error: updateError } = await supabase
      .from("questions")
      .update(group.values)
      .in("id", group.ids);
    if (updateError) throw updateError;
  }
}

const verified = {};
for (const subject of ["Fizik", "Kimia", "Biologi"]) {
  const { data, error } = await supabase
    .from("questions")
    .select("id,topic,status,source_label")
    .eq("subject", subject);
  if (error) throw error;
  verified[subject] = {
    total: data.length,
    drafts: data.filter((question) => question.status === "draft").length,
    missingTopics: data.filter((question) => !question.topic).length,
    mappedTopics: new Set(data.map((question) => question.topic)).size,
  };
  if (verified[subject].total !== before[subject].total) {
    throw new Error(`${subject}: total question count changed unexpectedly.`);
  }
  if (verified[subject].drafts !== before[subject].drafts) {
    throw new Error(`${subject}: draft status changed unexpectedly.`);
  }
  if (verified[subject].missingTopics !== 0) {
    throw new Error(`${subject}: chapter mapping is incomplete.`);
  }
}

console.log(JSON.stringify({ before, verified }, null, 2));
