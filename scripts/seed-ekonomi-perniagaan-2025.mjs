import crypto from "node:crypto";
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

const ekonomi = [
  ["Tingkatan 4 · Bab 1 Pengenalan kepada Ekonomi", "Mengapakah masalah kekurangan berlaku dalam ekonomi?", "Sumber ekonomi terhad tetapi kehendak manusia tidak terhad", "Semua barang boleh diperoleh secara percuma", "Pengguna tidak mempunyai sebarang pilihan", "Kerajaan menentukan semua harga", "A", "Kekurangan wujud kerana sumber terhad perlu memenuhi kehendak yang tidak terhad.", "基础"],
  ["Tingkatan 4 · Bab 1 Pengenalan kepada Ekonomi", "Farah memilih bekerja sambilan dan menolak peluang menghadiri kursus percuma. Apakah kos lepas pilihannya?", "Upah yang diterima", "Manfaat kursus yang dilepaskan", "Tambang ke tempat kerja", "Masa rehat selepas bekerja", "B", "Kos lepas ialah manfaat daripada alternatif terbaik yang terpaksa dilepaskan.", "中等"],
  ["Tingkatan 4 · Bab 1 Pengenalan kepada Ekonomi", "Siapakah yang menggabungkan tanah, buruh dan modal serta menanggung risiko perniagaan?", "Pemilik tanah", "Pekerja", "Usahawan", "Pengguna", "C", "Usahawan menyelaras faktor pengeluaran dan menanggung risiko.", "基础"],
  ["Tingkatan 4 · Bab 1 Pengenalan kepada Ekonomi", "Apakah yang ditunjukkan oleh titik di luar keluk kemungkinan pengeluaran?", "Pengangguran sumber", "Pengeluaran cekap", "Pilihan penggunaan semasa", "Pengeluaran belum dapat dicapai dengan sumber semasa", "D", "Titik di luar keluk memerlukan tambahan sumber atau kemajuan teknologi.", "中等"],
  ["Tingkatan 4 · Bab 1 Pengenalan kepada Ekonomi", "Pernyataan manakah merupakan pernyataan positif?", "Kadar pengangguran menurun daripada 4% kepada 3%", "Kerajaan patut menurunkan cukai", "Agihan pendapatan mestilah lebih adil", "Harga rumah terlalu mahal", "A", "Pernyataan positif boleh diuji menggunakan data dan fakta.", "中等"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Menurut hukum permintaan, apakah berlaku apabila harga barang meningkat, ceteris paribus?", "Kuantiti diminta meningkat", "Kuantiti diminta menurun", "Penawaran berkurang", "Pendapatan pengguna meningkat", "B", "Harga dan kuantiti diminta mempunyai hubungan songsang.", "基础"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Faktor manakah menyebabkan pergerakan sepanjang keluk penawaran sesuatu barang?", "Perubahan teknologi", "Perubahan kos input", "Perubahan harga barang itu sendiri", "Perubahan bilangan firma", "C", "Harga barang itu sendiri mengubah kuantiti ditawarkan sepanjang keluk yang sama.", "中等"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Pasaran berada dalam keseimbangan apabila...", "harga maksimum ditetapkan", "pengeluar memperoleh untung maksimum", "semua pengguna membeli kuantiti sama", "kuantiti diminta sama dengan kuantiti ditawarkan", "D", "Keseimbangan berlaku pada persilangan keluk permintaan dan penawaran.", "基础"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Harga maksimum ditetapkan di bawah harga keseimbangan. Apakah kesan yang paling mungkin?", "Lebihan permintaan", "Lebihan penawaran", "Harga pasaran meningkat tanpa had", "Keluk permintaan beralih ke kiri", "A", "Harga maksimum yang rendah menyebabkan kuantiti diminta melebihi kuantiti ditawarkan.", "中等"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Pekali keanjalan harga permintaan ialah 1.8. Bagaimanakah permintaan itu dikelaskan?", "Tak anjal", "Anjal", "Anjal satu", "Anjal sempurna", "B", "Nilai pekali melebihi satu menunjukkan permintaan anjal.", "基础"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Jika teh dan kopi ialah barang pengganti, kenaikan harga teh cenderung menyebabkan...", "permintaan kopi menurun", "penawaran kopi menurun", "permintaan kopi meningkat", "harga kopi mesti kekal", "C", "Pengguna beralih kepada kopi apabila harga teh meningkat.", "中等"],
  ["Tingkatan 4 · Bab 2 Pasaran", "Apakah kesan cukai tak langsung terhadap penawaran sesuatu barang?", "Keluk permintaan beralih ke kanan", "Kuantiti diminta sentiasa menjadi sifar", "Keluk penawaran beralih ke kanan", "Keluk penawaran beralih ke kiri", "D", "Cukai meningkatkan kos pengeluaran lalu mengurangkan penawaran.", "中等"],
  ["Tingkatan 4 · Bab 3 Pendapatan Individu", "Apakah ganjaran kepada faktor pengeluaran buruh?", "Upah", "Sewa", "Faedah", "Untung", "A", "Buruh menerima upah sebagai ganjaran perkhidmatan produktif.", "基础"],
  ["Tingkatan 4 · Bab 3 Pendapatan Individu", "Yang manakah merupakan bayaran pindahan?", "Gaji jururawat", "Bantuan tunai kerajaan", "Sewa bangunan", "Dividen saham", "B", "Bayaran pindahan diterima tanpa sumbangan produktif semasa.", "基础"],
  ["Tingkatan 4 · Bab 3 Pendapatan Individu", "Pendapatan boleh guna dikira sebagai...", "pendapatan individu + cukai langsung", "pendapatan individu - tabungan", "pendapatan individu - cukai langsung", "pendapatan individu + caruman wajib", "C", "Cukai langsung ditolak daripada pendapatan individu untuk memperoleh pendapatan boleh guna.", "中等"],
  ["Tingkatan 4 · Bab 3 Pendapatan Individu", "Apakah tujuan utama caruman KWSP bagi seorang pekerja?", "Membayar cukai jualan", "Membeli barang import", "Menghapuskan semua hutang semasa", "Menyediakan simpanan persaraan", "D", "KWSP membantu pekerja mengumpul simpanan untuk persaraan.", "基础"],
  ["Tingkatan 4 · Bab 4 Pengeluaran", "Bagaimanakah produktiviti buruh dikira?", "Jumlah output dibahagi jumlah input buruh", "Jumlah kos dibahagi jumlah hasil", "Kos tetap ditambah kos berubah", "Harga didarab kuantiti", "A", "Produktiviti mengukur output yang dihasilkan bagi setiap unit input.", "基础"],
  ["Tingkatan 4 · Bab 4 Pengeluaran", "Kos manakah tidak berubah apabila output berubah dalam jangka pendek?", "Kos bahan mentah", "Kos tetap", "Upah kerja lebih masa", "Kos pembungkusan", "B", "Kos tetap perlu ditanggung walaupun tingkat keluaran berubah.", "基础"],
  ["Tingkatan 4 · Bab 4 Pengeluaran", "Ekonomi bidangan dalaman berlaku apabila...", "jumlah output sentiasa menurun", "firma berhenti menggunakan modal", "kos purata menurun apabila skala pengeluaran meningkat", "harga jualan sama dengan kos berubah", "C", "Pengeluaran berskala besar boleh mengurangkan kos purata firma.", "中等"],
  ["Tingkatan 4 · Bab 4 Pengeluaran", "Jika harga seunit RM12 dan 500 unit dijual, berapakah jumlah hasil?", "RM512", "RM4,800", "RM5,000", "RM6,000", "D", "Jumlah hasil = harga × kuantiti = RM12 × 500 = RM6,000.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Apakah ciri utama barang awam?", "Tidak bersaing dan sukar mengecualikan pengguna", "Hanya boleh dikeluarkan firma asing", "Mesti dijual pada harga tinggi", "Penggunaannya menghasilkan untung peribadi sahaja", "A", "Barang awam lazimnya tidak bersaing dan tiada pengecualian pengguna.", "中等"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Asap kilang yang menjejaskan kesihatan penduduk ialah contoh...", "faedah sosial", "kos luaran", "barang merit", "hasil kerajaan", "B", "Pencemaran mengenakan kos kepada pihak ketiga yang tidak terlibat dalam urus niaga.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Pengangguran yang meningkat ketika ekonomi meleset dikenali sebagai pengangguran...", "geseran", "struktur", "kitaran", "bermusim", "C", "Pengangguran kitaran berkait dengan turun naik aktiviti ekonomi.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Apakah kesan umum inflasi terhadap pengguna jika pendapatan wang tidak berubah?", "Kuasa beli meningkat", "Tabungan mesti meningkat", "Harga umum menurun", "Kuasa beli menurun", "D", "Harga lebih tinggi mengurangkan jumlah barang yang boleh dibeli dengan pendapatan sama.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Instrumen manakah merupakan dasar fiskal?", "Perubahan perbelanjaan kerajaan dan cukai", "Perubahan nisbah rizab tunai oleh bank pusat sahaja", "Kawalan kualiti barang eksport", "Penetapan gaji oleh firma", "A", "Dasar fiskal menggunakan perbelanjaan kerajaan dan percukaian.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Apakah kesan yang diharapkan apabila OPR dinaikkan?", "Pinjaman menjadi lebih murah", "Pinjaman dan perbelanjaan cenderung berkurang", "Penawaran wang mesti meningkat", "Cukai pendapatan terus menurun", "B", "Kadar faedah lebih tinggi mengurangkan kecenderungan meminjam dan berbelanja.", "中等"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Sistem cukai manakah mengenakan kadar cukai lebih tinggi apabila pendapatan meningkat?", "Regresif", "Berkadar", "Progresif", "Tak langsung", "C", "Cukai progresif mempunyai kadar yang meningkat bersama tingkat pendapatan.", "基础"],
  ["Tingkatan 5 · Bab 1 Ekonomi dan Kerajaan", "Belanjawan kerajaan mengalami defisit apabila...", "hasil sama dengan perbelanjaan", "cukai langsung melebihi cukai tak langsung", "eksport melebihi import", "perbelanjaan melebihi hasil", "D", "Defisit berlaku apabila jumlah perbelanjaan kerajaan lebih besar daripada hasil.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Ringgit menyusut nilai berbanding dolar AS. Apakah kesan langsung kepada pembeli asing?", "Barang eksport Malaysia menjadi relatif lebih murah", "Barang import Malaysia menjadi lebih murah", "Permintaan eksport mesti menjadi sifar", "Rizab asing tidak boleh berubah", "A", "Penyusutan nilai menjadikan harga eksport dalam mata wang asing lebih rendah.", "中等"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Imbangan dagangan ialah perbezaan antara...", "aliran modal masuk dan keluar", "nilai eksport barang dengan nilai import barang", "hasil kerajaan dengan perbelanjaan kerajaan", "simpanan dengan pelaburan", "B", "Imbangan dagangan mengukur eksport barang ditolak import barang.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Sesebuah negara mempunyai faedah berbanding apabila negara itu...", "menghasilkan semua barang paling banyak", "tidak menjalankan perdagangan", "menghasilkan barang pada kos lepas lebih rendah", "mengenakan tarif paling tinggi", "C", "Faedah berbanding ditentukan oleh kos lepas relatif yang lebih rendah.", "中等"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah kesan tarif terhadap barang import?", "Kuantiti import mesti meningkat", "Harga barang tempatan mesti jatuh", "Tiada hasil diterima kerajaan", "Harga barang import cenderung meningkat", "D", "Tarif ialah cukai import yang meningkatkan kos barang dari luar negara.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah manfaat globalisasi kepada firma tempatan?", "Pasaran berpotensi menjadi lebih luas", "Persaingan antarabangsa dihapuskan", "Semua kos pengeluaran menjadi sifar", "Kadar pertukaran tidak lagi diperlukan", "A", "Globalisasi membuka akses kepada pelanggan dan pasaran antarabangsa.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah manfaat pelaburan langsung asing kepada negara penerima?", "Mengurangkan semua import", "Membawa modal, teknologi dan peluang pekerjaan", "Menghapuskan peranan tenaga kerja tempatan", "Menjamin kadar inflasi sifar", "B", "FDI boleh menambah modal, pemindahan teknologi dan pekerjaan.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Akaun semasa dalam imbangan pembayaran merekodkan...", "stok modal fizikal sahaja", "pinjaman bank domestik sahaja", "dagangan barang, perkhidmatan, pendapatan dan pindahan semasa", "belanjawan kerajaan negeri", "C", "Komponen tersebut membentuk urus niaga akaun semasa dengan negara lain.", "中等"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah tujuan utama kerjasama ekonomi ASEAN?", "Menggantikan semua mata wang negara anggota", "Menghapuskan kerajaan negara anggota", "Menyekat semua pelaburan luar", "Menggalakkan perdagangan dan kerjasama serantau", "D", "ASEAN memudahkan hubungan ekonomi dan perdagangan antara negara anggota.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Jika Ringgit Malaysia meningkat nilai, apakah kesan kepada barang import?", "Barang import menjadi relatif lebih murah", "Barang import menjadi relatif lebih mahal", "Import dilarang secara automatik", "Kuantiti eksport pasti meningkat", "A", "Mata wang lebih kukuh membeli lebih banyak mata wang asing.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah yang dimaksudkan dengan kuota import?", "Cukai atas setiap unit import", "Had kuantiti barang yang boleh diimport", "Subsidi kepada pengeksport", "Larangan penggunaan mata wang asing", "B", "Kuota mengehadkan jumlah fizikal import dalam sesuatu tempoh.", "基础"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Mengapakah kerajaan melindungi industri muda?", "Untuk menaikkan kos pengeluaran tempatan", "Untuk menghentikan semua inovasi", "Untuk memberi masa industri baharu menjadi cekap dan berdaya saing", "Untuk memastikan pengguna tiada pilihan", "C", "Perlindungan sementara membantu industri muda membina skala dan kecekapan.", "中等"],
  ["Tingkatan 5 · Bab 2 Malaysia dan Ekonomi Global", "Apakah maksud pertumbuhan ekonomi?", "Kenaikan harga umum secara berterusan", "Penurunan kadar penyertaan tenaga buruh", "Pengurangan semua perbelanjaan kerajaan", "Peningkatan keluaran benar sesebuah ekonomi", "D", "Pertumbuhan ekonomi merujuk peningkatan pengeluaran benar, lazimnya diukur melalui KDNK benar.", "基础"],
];

const perniagaan = [
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Apakah tujuan asas sesebuah perniagaan?", "Menawarkan barang atau perkhidmatan untuk memenuhi keperluan dan kehendak", "Menghapuskan semua persaingan", "Menentukan dasar kerajaan", "Mengehadkan pilihan pengguna", "A", "Perniagaan menyediakan barang dan perkhidmatan bagi memenuhi keperluan dan kehendak pengguna.", "基础"],
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Bentuk pemilikan manakah mempunyai liabiliti terhad dan syernya tidak ditawarkan kepada orang awam?", "Milikan tunggal", "Syarikat sendirian berhad", "Perkongsian biasa", "Koperasi", "B", "Syarikat sendirian berhad mempunyai liabiliti terhad dan pindah milik syer yang terkawal.", "基础"],
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Aktiviti memproses kelapa sawit menjadi minyak masak tergolong dalam sektor...", "utama", "ketiga", "kedua", "awam", "C", "Sektor kedua melibatkan pemprosesan bahan mentah menjadi barang siap atau separuh siap.", "基础"],
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Peniaga menggunakan jenama, sistem operasi dan sokongan milik syarikat induk dengan membayar fi. Apakah bentuk perniagaan ini?", "Usaha sama", "Koperasi", "Perkongsian", "Francais", "D", "Francaisi mendapat hak menggunakan jenama dan sistem francaisor berdasarkan perjanjian.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Apakah peranan kerajaan pusat dalam aspek perundangan perniagaan?", "Melindungi hak pengguna", "Menentukan jadual kerja setiap firma", "Mengurus semua stok peniaga", "Menetapkan keuntungan setiap syarikat", "A", "Kerajaan menggubal dan menguatkuasakan undang-undang untuk melindungi pengguna dan pihak berkepentingan.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Apakah kesan inflasi yang berterusan terhadap perniagaan?", "Kos input sentiasa menurun", "Kos operasi cenderung meningkat", "Kuasa beli wang meningkat", "Permintaan semua barang mesti meningkat", "B", "Kenaikan tingkat harga umum biasanya meningkatkan kos bahan dan operasi.", "基础"],
  ["Tingkatan 4 · Bab 3 Penetapan Visi, Misi dan Objektif Perniagaan", "Objektif 'meningkatkan jualan 10% dalam enam bulan' memenuhi ciri SMART yang manakah?", "Munasabah sahaja", "Boleh dicapai sahaja", "Boleh diukur dan mempunyai jangka masa", "Tidak khusus", "C", "Angka 10% boleh diukur dan tempoh enam bulan menetapkan jangka masa.", "基础"],
  ["Tingkatan 4 · Bab 3 Penetapan Visi, Misi dan Objektif Perniagaan", "Apakah fungsi pernyataan misi?", "Menerangkan harga setiap produk", "Menyenaraikan semua pekerja", "Menunjukkan sasaran jualan harian sahaja", "Menerangkan tujuan utama dan aktiviti organisasi", "D", "Misi menjelaskan sebab organisasi wujud dan kegiatan utamanya.", "基础"],
  ["Tingkatan 4 · Bab 4 Bahagian-bahagian Fungsian Utama", "Apakah tugas utama bahagian pembelian?", "Memilih pembekal dan membuat pesanan", "Menjalankan temu duga pekerja", "Membayar dividen pemegang saham", "Mereka kempen pengiklanan", "A", "Bahagian pembelian mendapatkan input yang diperlukan daripada pembekal sesuai.", "基础"],
  ["Tingkatan 4 · Bab 4 Bahagian-bahagian Fungsian Utama", "Bahagian manakah mengkaji keperluan pelanggan dan merancang promosi?", "Pengeluaran", "Pemasaran", "Pentadbiran", "Kewangan", "B", "Pemasaran mengenal pasti pasaran sasaran serta merancang produk, harga, promosi dan pengedaran.", "基础"],
  ["Tingkatan 4 · Bab 4 Bahagian-bahagian Fungsian Utama", "Aktiviti manakah dilaksanakan oleh bahagian sumber manusia?", "Mengawal stok bahan mentah", "Membina prototaip produk", "Merekrut dan melatih pekerja", "Menyediakan invois jualan sahaja", "C", "Pengambilan dan pembangunan pekerja ialah fungsi sumber manusia.", "基础"],
  ["Tingkatan 4 · Bab 4 Bahagian-bahagian Fungsian Utama", "Apakah tanggungjawab bahagian teknologi maklumat?", "Menentukan kadar cukai", "Membekalkan bahan mentah", "Mengurus pengangkutan awam", "Melindungi data dan menyelenggara sistem maklumat", "D", "Bahagian teknologi maklumat menjaga sistem, keselamatan data dan sokongan digital.", "基础"],
  ["Tingkatan 5 · Bab 1 Pengurusan Sumber Manusia", "Mengapakah latihan pekerja penting?", "Meningkatkan pengetahuan dan kemahiran kerja", "Menghapuskan keperluan penilaian prestasi", "Mengurangkan semua tanggungjawab pekerja", "Menjamin semua pekerja dinaikkan pangkat", "A", "Latihan membantu pekerja menjalankan tugas dengan lebih cekap dan selamat.", "基础"],
  ["Tingkatan 5 · Bab 1 Pengurusan Sumber Manusia", "Apakah tujuan penilaian prestasi pekerja?", "Menentukan harga produk", "Menilai pencapaian dan keperluan pembangunan", "Mengira stok akhir", "Memilih pembekal baharu", "B", "Penilaian prestasi memberi maklum balas dan mengenal pasti keperluan latihan.", "基础"],
  ["Tingkatan 5 · Bab 2 Pengurusan Sumber Fizikal dan Teknologi", "Mengapakah mesin perlu diselenggara secara berkala?", "Untuk menambah kadar cukai", "Untuk mengurangkan semua inventori", "Untuk memastikan operasi berjalan lancar", "Untuk menukar pemilikan perniagaan", "C", "Penyelenggaraan mengurangkan kerosakan dan gangguan operasi.", "基础"],
  ["Tingkatan 5 · Bab 2 Pengurusan Sumber Fizikal dan Teknologi", "Hak eksklusif terhadap suatu ciptaan baharu dilindungi melalui...", "lesen perniagaan", "hak cipta pekerja", "cap dagangan", "paten", "D", "Paten melindungi ciptaan dan memberi pemilik hak eksklusif untuk tempoh tertentu.", "基础"],
  ["Tingkatan 5 · Bab 3 Sumber Pembiayaan Perniagaan", "Yang manakah sumber pembiayaan dalaman?", "Untung tertahan", "Overdraf bank", "Sewa beli", "Pemfaktoran", "A", "Untung tertahan berasal daripada keuntungan perniagaan sendiri.", "基础"],
  ["Tingkatan 5 · Bab 3 Sumber Pembiayaan Perniagaan", "Kemudahan manakah sesuai untuk keperluan tunai jangka pendek yang berubah-ubah?", "Syer biasa", "Overdraf", "Debentur", "Modal teroka", "B", "Overdraf membolehkan akaun semasa dikeluarkan melebihi baki sehingga had diluluskan.", "基础"],
  ["Tingkatan 5 · Bab 4 Penyata Kewangan Perniagaan", "Apakah kegunaan utama penyata kewangan kepada peniaga?", "Menentukan undang-undang negara", "Menghapuskan semua hutang", "Menilai prestasi dan kedudukan kewangan", "Menetapkan kadar pertukaran asing", "C", "Penyata kewangan membantu peniaga menilai untung, aset, liabiliti dan aliran tunai.", "基础"],
  ["Tingkatan 5 · Bab 4 Penyata Kewangan Perniagaan", "Jualan RM80,000 dan kos jualan RM50,000. Berapakah untung kasar?", "RM20,000", "RM50,000", "RM80,000", "RM30,000", "D", "Untung kasar = jualan - kos jualan = RM30,000.", "基础"],
  ["Tingkatan 5 · Bab 4 Penyata Kewangan Perniagaan", "Bagaimanakah nisbah semasa dikira?", "Aset semasa ÷ liabiliti semasa", "Untung kasar ÷ jualan", "Kos jualan ÷ inventori purata", "Liabiliti semasa ÷ aset bukan semasa", "A", "Nisbah semasa membandingkan aset semasa dengan liabiliti semasa.", "基础"],
  ["Tingkatan 5 · Bab 4 Penyata Kewangan Perniagaan", "Kos tetap RM60,000, harga jualan RM25 dan kos berubah RM15 seunit. Berapakah titik pulang modal?", "2,400 unit", "6,000 unit", "10,000 unit", "15,000 unit", "B", "Sumbangan seunit RM10; titik pulang modal = RM60,000 ÷ RM10 = 6,000 unit.", "中等"],
  ["Tingkatan 5 · Bab 5 Persediaan Menjadi Usahawan", "Ciri usahawan manakah ditunjukkan apabila seseorang sanggup menerima kemungkinan kerugian selepas menilai maklumat?", "Kreatif", "Berpandangan jauh", "Berani mengambil risiko", "Fleksibel", "C", "Usahawan mengambil risiko yang telah dipertimbangkan untuk mengejar peluang.", "基础"],
  ["Tingkatan 5 · Bab 5 Persediaan Menjadi Usahawan", "Dalam analisis SWOT, peningkatan permintaan pasaran ialah...", "kelemahan", "kekuatan", "ancaman", "peluang", "D", "Peluang ialah faktor luaran positif yang boleh dimanfaatkan perniagaan.", "基础"],
  ["Tingkatan 5 · Bab 6 Persediaan Memulakan Perniagaan", "Di Malaysia, pendaftaran perniagaan lazimnya dibuat dengan...", "Suruhanjaya Syarikat Malaysia", "Bank Negara Malaysia", "Jabatan Perangkaan Malaysia", "Kumpulan Wang Simpanan Pekerja", "A", "SSM mengendalikan pendaftaran entiti perniagaan yang berkaitan.", "基础"],
  ["Tingkatan 5 · Bab 7 Merancang Pengendalian Perniagaan", "Mengapakah rancangan perniagaan disediakan sebelum memohon pembiayaan?", "Untuk menyembunyikan risiko", "Untuk menunjukkan daya maju dan keperluan kewangan", "Untuk menggantikan semua lesen", "Untuk menghapuskan persaingan", "B", "Pemberi dana menilai idea, pasaran, operasi, risiko dan unjuran kewangan melalui rancangan perniagaan.", "基础"],
  ["Tingkatan 5 · Bab 7 Merancang Pengendalian Perniagaan", "Elemen 4P pemasaran ialah...", "pekerja, proses, prestasi, produktiviti", "produk, pekerja, perolehan, pembayaran", "produk, harga, pengedaran dan promosi", "pasaran, pesaing, pembekal dan pelanggan", "C", "Campuran pemasaran asas merangkumi product, price, place dan promotion.", "基础"],
  ["Tingkatan 5 · Bab 7 Merancang Pengendalian Perniagaan", "Baki tunai awal RM8,000, penerimaan RM25,000 dan pembayaran RM21,000. Berapakah baki akhir?", "RM4,000", "RM8,000", "RM29,000", "RM12,000", "D", "Baki akhir = RM8,000 + RM25,000 - RM21,000 = RM12,000.", "基础"],
  ["Tingkatan 5 · Bab 6 Persediaan Memulakan Perniagaan", "Dokumen manakah menjadi bukti jualan barang secara kredit?", "Invois", "Resit tunai", "Cek", "Slip bank", "A", "Invois dikeluarkan bagi jualan kredit dan menyatakan butiran amaun terhutang.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Apakah contoh tanggungjawab sosial terhadap pekerja?", "Menaikkan harga tanpa sebab", "Menyediakan tempat kerja selamat", "Mengurangkan maklumat produk", "Mengelakkan bayaran cukai", "B", "Keselamatan dan kebajikan pekerja ialah tanggungjawab sosial organisasi.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Apakah manfaat utama e-dagang kepada peniaga kecil?", "Waktu operasi menjadi lebih pendek", "Semua risiko siber hilang", "Capaian pasaran menjadi lebih luas", "Kos penghantaran sentiasa sifar", "C", "Platform digital membolehkan peniaga mencapai pelanggan di luar kawasan fizikal.", "基础"],
  ["Tingkatan 5 · Bab 2 Pengurusan Sumber Fizikal dan Teknologi", "Perniagaan memindahkan risiko kebakaran kepada syarikat insurans melalui...", "paten", "francais", "sewa beli", "perlindungan insurans", "D", "Premium dibayar supaya risiko kewangan tertentu dipindahkan kepada penanggung insurans.", "基础"],
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Apakah kelemahan utama milikan tunggal?", "Liabiliti pemilik tidak terhad", "Keputusan perlu diluluskan pemegang saham awam", "Untung mesti dibahagi sama rata", "Penubuhan memerlukan modal minimum yang besar", "A", "Pemilik menanggung liabiliti tidak terhad terhadap hutang perniagaan.", "基础"],
  ["Tingkatan 4 · Bab 1 Tujuan Perniagaan dan Pemilikan Perniagaan", "Apakah matlamat utama koperasi?", "Memaksimumkan dividen pelabur luar", "Menjaga kebajikan anggota", "Mengawal dasar monetari", "Mengeluarkan semua barang awam", "B", "Koperasi ditubuhkan untuk memenuhi kepentingan dan kebajikan anggotanya.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Kenaikan kadar faedah merupakan perubahan dalam faktor...", "dalaman", "teknologi dalaman", "ekonomi luaran", "sumber manusia", "C", "Kadar faedah ialah unsur persekitaran ekonomi yang berada di luar kawalan firma.", "基础"],
  ["Tingkatan 4 · Bab 2 Trend Semasa dalam Perniagaan", "Penggunaan mesin automatik yang menggantikan tugas rutin boleh menyebabkan pengangguran...", "bermusim", "geseran", "kitaran", "teknologi", "D", "Pengangguran teknologi berlaku apabila pekerja diganti oleh kaedah atau mesin baharu.", "基础"],
  ["Tingkatan 5 · Bab 4 Penyata Kewangan Perniagaan", "Mengapakah analisis titik pulang modal penting?", "Membantu merancang output untuk mencapai keuntungan sasaran", "Menentukan kadar cukai pendapatan", "Menghapuskan kos tetap", "Menjamin semua produk terjual", "A", "Analisis TPM menunjukkan jualan minimum dan membantu perancangan keuntungan.", "中等"],
  ["Tingkatan 5 · Bab 2 Pengurusan Sumber Fizikal dan Teknologi", "Apakah tujuan utama pengurusan stok?", "Memastikan semua stok dipamerkan", "Memastikan stok mencukupi tanpa lebihan tidak perlu", "Menggantikan fungsi pemasaran", "Menghapuskan keperluan rekod", "B", "Tahap stok yang sesuai mengelakkan kehabisan dan kos penyimpanan berlebihan.", "基础"],
  ["Tingkatan 4 · Bab 3 Penetapan Visi, Misi dan Objektif Perniagaan", "Apakah yang diterangkan oleh visi organisasi?", "Tugas harian setiap pekerja", "Harga jualan semasa", "Aspirasi jangka panjang yang ingin dicapai", "Senarai aset semasa", "C", "Visi menggambarkan arah dan keadaan masa hadapan yang diingini.", "基础"],
  ["Tingkatan 5 · Bab 7 Merancang Pengendalian Perniagaan", "Bahagian ringkasan eksekutif dalam rancangan perniagaan memberi...", "senarai penuh transaksi bank", "rekod kehadiran pekerja", "huraian teknikal setiap mesin", "gambaran menyeluruh dan ringkas tentang rancangan", "D", "Ringkasan eksekutif membolehkan pembaca memahami inti pati rancangan dengan cepat.", "基础"],
];

const banks = [
  {
    subject: "Ekonomi",
    rows: ekonomi,
    filename: "MyGuru_Ekonomi_2025_Negeri_Sembilan_Adapted_40.json",
    storagePath: "generated/myguru-ekonomi-2025-negeri-sembilan-adapted-40.json",
    sourceLabel: "MyGuru 原创改编练习｜参考考点：2025 Negeri Sembilan Ekonomi Trial Kertas 1",
    sourcePrefix: "myguru:2025:negeri-sembilan:ekonomi:adapted",
  },
  {
    subject: "Perniagaan",
    rows: perniagaan,
    filename: "MyGuru_Perniagaan_2025_Melaka_Adapted_40.json",
    storagePath: "generated/myguru-perniagaan-2025-melaka-adapted-40.json",
    sourceLabel: "MyGuru 原创改编练习｜参考考点：2025 Melaka Perniagaan Trial Kertas 1",
    sourcePrefix: "myguru:2025:melaka:perniagaan:adapted",
  },
];

function hashQuestion(subject, row) {
  return crypto.createHash("sha256").update([subject, ...row.slice(1, 6)].join("\n").toLowerCase()).digest("hex");
}

function validateBank(bank) {
  if (bank.rows.length !== 40) throw new Error(`${bank.subject}: expected 40 questions, got ${bank.rows.length}`);
  const prompts = new Set();
  const distribution = { A: 0, B: 0, C: 0, D: 0 };
  bank.rows.forEach((row, index) => {
    const [topic, prompt, a, b, c, d, answer, explanation, difficulty] = row;
    if (![topic, prompt, a, b, c, d, explanation, difficulty].every((value) => typeof value === "string" && value.trim())) {
      throw new Error(`${bank.subject} row ${index + 1}: missing field`);
    }
    if (!Object.hasOwn(distribution, answer)) throw new Error(`${bank.subject} row ${index + 1}: invalid answer`);
    if (new Set([a, b, c, d]).size !== 4) throw new Error(`${bank.subject} row ${index + 1}: duplicate options`);
    if (prompts.has(prompt)) throw new Error(`${bank.subject} row ${index + 1}: duplicate prompt`);
    prompts.add(prompt);
    distribution[answer] += 1;
  });
  if (Object.values(distribution).some((count) => count !== 10)) {
    throw new Error(`${bank.subject}: answers are not balanced ${JSON.stringify(distribution)}`);
  }
}

async function seedBank(bank, teacherId) {
  validateBank(bank);
  let { data: upload, error: uploadReadError } = await supabase
    .from("uploads")
    .select("id")
    .eq("storage_path", bank.storagePath)
    .maybeSingle();
  if (uploadReadError) throw uploadReadError;
  if (!upload) {
    const created = await supabase.from("uploads").insert({
      user_id: teacherId,
      filename: bank.filename,
      storage_path: bank.storagePath,
      subject: bank.subject,
      status: "processing",
    }).select("id").single();
    if (created.error) throw created.error;
    upload = created.data;
  }

  const { data: existing, error: existingError } = await supabase
    .from("questions")
    .select("source_key")
    .like("source_key", `${bank.sourcePrefix}:%`);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing ?? []).map((item) => item.source_key));
  const now = new Date().toISOString();
  const payload = bank.rows.map((row, index) => {
    const [topic, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty] = row;
    return {
      upload_id: upload.id,
      author_id: teacherId,
      subject: bank.subject,
      topic,
      prompt,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      difficulty,
      status: "published",
      answer_confirmed: true,
      source_type: "myguru_original",
      source_label: bank.sourceLabel,
      source_key: `${bank.sourcePrefix}:q${String(index + 1).padStart(2, "0")}`,
      content_hash: hashQuestion(bank.subject, row),
      published_at: now,
    };
  }).filter((item) => !existingKeys.has(item.source_key));

  for (let index = 0; index < payload.length; index += 20) {
    const { error } = await supabase.from("questions").insert(payload.slice(index, index + 20));
    if (error) throw error;
  }
  const { error: uploadError } = await supabase.from("uploads").update({ status: "published" }).eq("id", upload.id);
  if (uploadError) throw uploadError;

  const { data: verified, error: verifyError } = await supabase
    .from("questions")
    .select("id,prompt,correct_option,status,answer_confirmed,source_key,topic")
    .like("source_key", `${bank.sourcePrefix}:%`);
  if (verifyError) throw verifyError;
  const invalid = (verified ?? []).filter((item) =>
    item.status !== "published" || !item.answer_confirmed || !/^[ABCD]$/.test(item.correct_option) || !item.topic
  );
  const uniquePrompts = new Set((verified ?? []).map((item) => item.prompt));
  if ((verified ?? []).length !== 40 || uniquePrompts.size !== 40 || invalid.length) {
    throw new Error(`${bank.subject}: production verification failed`);
  }
  return { subject: bank.subject, inserted: payload.length, published: verified.length, invalid: invalid.length };
}

const { data: teachers, error: teacherError } = await supabase.from("profiles").select("id").eq("role", "teacher").limit(2);
if (teacherError) throw teacherError;
if (!teachers || teachers.length !== 1) throw new Error("Expected exactly one teacher account for bank ownership.");

for (const bank of banks) validateBank(bank);
const results = [];
for (const bank of banks) results.push(await seedBank(bank, teachers[0].id));
console.log(JSON.stringify(results, null, 2));
