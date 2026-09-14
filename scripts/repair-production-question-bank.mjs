import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase production credentials are unavailable.");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const biology = [
  ["Biologi sel", "Organel manakah menjadi tapak utama respirasi aerob dalam sel eukariot?", "Mitokondrion", "Ribosom", "Lisosom", "Jasad Golgi", "A", "Mitokondrion menghasilkan ATP melalui respirasi aerob."],
  ["Biologi sel", "Apakah fungsi utama ribosom?", "Mengawal pergerakan bahan", "Mensintesis protein", "Menyimpan air", "Menghasilkan lipid", "B", "Ribosom ialah tapak sintesis protein."],
  ["Pergerakan bahan", "Proses pergerakan molekul air merentasi membran separa telap disebut sebagai...", "Resapan", "Pengangkutan aktif", "Osmosis", "Fagositosis", "C", "Osmosis ialah pergerakan air melalui membran separa telap."],
  ["Enzim", "Apakah yang berlaku kepada kebanyakan enzim manusia pada suhu yang terlalu tinggi?", "Aktiviti meningkat tanpa had", "Enzim bertukar menjadi lipid", "Bilangan tapak aktif bertambah", "Enzim ternyahasli", "D", "Suhu terlalu tinggi mengubah bentuk tapak aktif enzim."],
  ["Pembahagian sel", "Apakah kepentingan mitosis kepada organisma multisel?", "Pertumbuhan dan pembaikan tisu", "Menghasilkan variasi genetik", "Mengurangkan bilangan kromosom", "Membentuk gamet", "A", "Mitosis menghasilkan sel anak seiras untuk pertumbuhan dan pembaikan."],
  ["Pembahagian sel", "Pada peringkat meiosis manakah pindah silang berlaku?", "Profasa mitosis", "Profasa I", "Metafasa II", "Telofasa II", "B", "Pindah silang berlaku antara kromatid bukan seiras semasa profasa I."],
  ["Respirasi", "Apakah hasil akhir respirasi anaerob dalam sel otot manusia?", "Etanol dan karbon dioksida", "Air dan karbon dioksida", "Asid laktik", "Glukosa", "C", "Sel otot menghasilkan asid laktik apabila oksigen tidak mencukupi."],
  ["Fotosintesis", "Pigmen utama yang menyerap tenaga cahaya untuk fotosintesis ialah...", "Hemoglobin", "Melanin", "Keratin", "Klorofil", "D", "Klorofil menyerap tenaga cahaya dalam kloroplas."],
  ["Nutrisi", "Enzim manakah menghidrolisis kanji kepada maltosa?", "Amilase", "Pepsin", "Lipase", "Tripsin", "A", "Amilase memecahkan kanji kepada maltosa."],
  ["Pengangkutan manusia", "Komponen darah manakah terlibat secara langsung dalam pembekuan darah?", "Eritrosit", "Platlet", "Limfosit", "Plasma sahaja", "B", "Platlet memulakan pembentukan bekuan darah."],
  ["Sistem peredaran", "Salur darah manakah membawa darah beroksigen dari peparu ke jantung?", "Arteri pulmonari", "Vena kava", "Vena pulmonari", "Aorta", "C", "Vena pulmonari membawa darah beroksigen ke atrium kiri."],
  ["Homeostasis", "Hormon manakah menurunkan aras glukosa darah?", "Adrenalina", "Glukagon", "Tiroksina", "Insulin", "D", "Insulin merangsang pengambilan glukosa dan pembentukan glikogen."],
  ["Koordinasi", "Bahagian otak manakah mengawal keseimbangan dan koordinasi pergerakan?", "Serebelum", "Medula oblongata", "Hipotalamus", "Serebrum", "A", "Serebelum menyelaras pergerakan otot dan keseimbangan."],
  ["Pembiakan", "Di manakah persenyawaan manusia biasanya berlaku?", "Uterus", "Tiub Falopio", "Serviks", "Ovari", "B", "Persenyawaan lazimnya berlaku di tiub Falopio."],
  ["Genetik", "Individu yang mempunyai dua alel berbeza bagi satu gen dikenali sebagai...", "Homozigot dominan", "Homozigot resesif", "Heterozigot", "Mutan", "C", "Heterozigot mempunyai dua alel yang berlainan."],
  ["Genetik", "Apakah jenis asid nukleik yang membawa kod genetik dari DNA ke ribosom?", "tRNA", "rRNA", "ATP", "mRNA", "D", "mRNA membawa maklumat genetik untuk translasi di ribosom."],
  ["Ekologi", "Organisma yang menghasilkan bahan organik sendiri dalam ekosistem disebut...", "Pengeluar", "Pengguna primer", "Pengurai", "Parasit", "A", "Pengeluar membuat makanan sendiri, biasanya melalui fotosintesis."],
  ["Ekologi", "Hubungan apabila kedua-dua organisma mendapat manfaat dikenali sebagai...", "Parasitisme", "Mutualisme", "Komensalisme", "Persaingan", "B", "Dalam mutualisme kedua-dua spesies memperoleh manfaat."],
  ["Bioteknologi", "Enzim manakah digunakan untuk memotong DNA pada urutan tertentu dalam kejuruteraan genetik?", "DNA ligase", "DNA polimerase", "Enzim pembatas", "Amilase", "C", "Enzim pembatas mengenal dan memotong urutan DNA tertentu."],
  ["Variasi", "Variasi yang menunjukkan julat nilai tanpa kategori yang jelas ialah...", "Variasi tak selanjar", "Mutasi gen", "Pewarisan seks terangkai", "Variasi selanjar", "D", "Ketinggian dan jisim ialah contoh variasi selanjar."],
];

const { data: teachers, error: teacherError } = await supabase.from("profiles").select("id").eq("role", "teacher").limit(2);
if (teacherError) throw teacherError;
if (!teachers || teachers.length !== 1) throw new Error("Expected exactly one teacher account.");

const visualSubjects = new Set(["Biologi", "Fizik", "Kimia", "Matematik", "Sains"]);
const visualPattern = /\b(rajah|diagram|figure|jadual|graf)\b/i;
const visualIds = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from("questions").select("id,subject,prompt,image_path,status").eq("status", "published").range(from, from + 999);
  if (error) throw error;
  visualIds.push(...(data ?? []).filter((item) => visualSubjects.has(item.subject) && !item.image_path && visualPattern.test(item.prompt)).map((item) => item.id));
  if ((data?.length ?? 0) < 1000) break;
}
for (let index = 0; index < visualIds.length; index += 100) {
  const { error } = await supabase.from("questions").update({ status: "draft", published_at: null }).in("id", visualIds.slice(index, index + 100));
  if (error) throw error;
}

const sourcePrefix = "myguru:2026:biology:text-repair";
const { data: existing, error: existingError } = await supabase.from("questions").select("source_key").like("source_key", `${sourcePrefix}:%`);
if (existingError) throw existingError;
const existingKeys = new Set((existing ?? []).map((item) => item.source_key));
const distribution = biology.reduce((counts, row) => ({ ...counts, [row[6]]: (counts[row[6]] || 0) + 1 }), {});
if (biology.length !== 20 || Object.values(distribution).some((count) => count !== 5)) throw new Error("Biology replacement bank validation failed.");
const now = new Date().toISOString();
const payload = biology.map((row, index) => {
  const [topic, prompt, option_a, option_b, option_c, option_d, correct_option, explanation] = row;
  const source_key = `${sourcePrefix}:q${String(index + 1).padStart(2, "0")}`;
  return {
    author_id: teachers[0].id,
    subject: "Biologi",
    topic,
    prompt,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
    difficulty: "中等",
    status: "published",
    answer_confirmed: true,
    source_type: "myguru_original",
    source_label: "MyGuru 原创文字型练习｜缺图题替代组 2026",
    source_key,
    content_hash: crypto.createHash("sha256").update(["Biologi", prompt, option_a, option_b, option_c, option_d].join("\n").toLowerCase()).digest("hex"),
    published_at: now,
  };
}).filter((item) => !existingKeys.has(item.source_key));
if (payload.length) {
  const { error } = await supabase.from("questions").insert(payload);
  if (error) throw error;
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 86400000));
const { data: staleProfiles, error: staleError } = await supabase.from("profiles").select("id,last_checkin_date,streak_days").eq("role", "student").gt("streak_days", 0);
if (staleError) throw staleError;
const staleIds = (staleProfiles ?? []).filter((item) => item.last_checkin_date !== today && item.last_checkin_date !== yesterday).map((item) => item.id);
if (staleIds.length) {
  const { error } = await supabase.from("profiles").update({ streak_days: 0 }).in("id", staleIds);
  if (error) throw error;
}

const publishedBySubject = {};
for (let from = 0; ; from += 1000) {
  const { data: counts, error: countError } = await supabase.from("questions").select("subject,status").range(from, from + 999);
  if (countError) throw countError;
  for (const item of counts ?? []) if (item.status === "published") publishedBySubject[item.subject] = (publishedBySubject[item.subject] || 0) + 1;
  if ((counts?.length ?? 0) < 1000) break;
}
console.log(JSON.stringify({ visualQuestionsMovedToDraft: visualIds.length, biologyQuestionsInserted: payload.length, staleStreaksReset: staleIds.length, publishedBySubject }, null, 2));
