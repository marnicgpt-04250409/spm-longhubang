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

const addMath = [
  ["Indeks", "Selesaikan 2^(x+1) = 8^(x-1). / Solve 2^(x+1) = 8^(x-1).", "x = 2", "x = 1", "x = 3", "x = 4", "A", "Tulis 8 sebagai 2³. Maka x + 1 = 3x - 3 dan x = 2.", "中等"],
  ["Logaritma", "Selesaikan log₂(x − 1) + log₂(x + 1) = 3. / Solve log₂(x − 1) + log₂(x + 1) = 3.", "x = −3", "x = 3", "x = 1", "x = 9", "B", "Domain memerlukan x > 1. (x − 1)(x + 1) = 8 memberi x = 3.", "中等"],
  ["Persamaan kuadratik", "Jika α dan β ialah punca 2x² − 5x − 3 = 0, cari α² + β². / If α and β are the roots, find α² + β².", "25/4", "31/4", "37/4", "43/4", "C", "α + β = 5/2 dan αβ = −3/2. Jadi α² + β² = (α + β)² − 2αβ = 37/4.", "进阶"],
  ["Persamaan kuadratik", "Persamaan x² + (k − 1)x + k = 0 mempunyai dua punca sama. Cari k. / The equation has equal roots. Find k.", "1 ± √2", "2 ± √3", "3 ± √2", "3 ± 2√2", "D", "Gunakan diskriminan sifar: (k − 1)² − 4k = 0, lalu k = 3 ± 2√2.", "进阶"],
  ["Fungsi", "Diberi f(x) = (2x − 1)/(x + 3). Cari f⁻¹(1). / Given f(x), find f⁻¹(1).", "4", "3", "2", "1", "A", "Selesaikan f(x) = 1: 2x − 1 = x + 3, maka x = 4.", "中等"],
  ["Fungsi gubahan", "Diberi f(x) = 3x − 2 dan g(x) = x² + 1. Cari gf(2). / Find gf(2).", "9", "17", "25", "37", "B", "f(2) = 4 dan g(4) = 17.", "中等"],
  ["Ubahan", "y berubah secara langsung dengan x² dan secara songsang dengan √z. Jika y = 12 apabila x = 2 dan z = 4, cari y apabila x = 3 dan z = 9.", "12", "15", "18", "27", "C", "y = kx²/√z. Daripada keadaan pertama k = 6, lalu y = 6(9)/3 = 18.", "中等"],
  ["Fungsi", "Nyatakan domain bagi h(x) = √(5 − 2x). / State the domain of h(x) = √(5 − 2x).", "x ≥ 5/2", "x < 5/2", "x > 5/2", "x ≤ 5/2", "D", "Ungkapan dalam punca mesti tidak negatif: 5 − 2x ≥ 0.", "中等"],
  ["Geometri koordinat", "Titik persilangan 2x + y = 7 dan x − y = 2 dilalui satu garis yang serenjang dengan 3x − y = 4. Cari persamaan garis itu.", "x + 3y − 6 = 0", "3x + y − 10 = 0", "x − 3y = 0", "3x − y − 8 = 0", "A", "Persilangan ialah (3,1). Kecerunan garis diberi 3, jadi kecerunan serenjang −1/3.", "进阶"],
  ["Geometri koordinat", "Cari jarak serenjang titik (4, −1) dari garis 3x + 4y − 5 = 0. / Find the perpendicular distance.", "1/5", "3/5", "4/5", "7/5", "B", "Jarak = |3(4)+4(−1)−5|/√(3²+4²) = 3/5.", "中等"],
  ["Bulatan", "Cari jejari bulatan x² + y² − 6x + 4y − 12 = 0. / Find the radius of the circle.", "3", "4", "5", "6", "C", "Lengkapkan kuasa dua: (x−3)² + (y+2)² = 25.", "中等"],
  ["Lokus", "Cari lokus titik yang sama jarak dari A(2,1) dan B(−4,5). / Find the locus of points equidistant from A and B.", "3x + 2y − 9 = 0", "2x − 3y + 9 = 0", "3x + 2y + 9 = 0", "3x − 2y + 9 = 0", "D", "Samakan kuasa dua jarak dari A dan B lalu ringkaskan kepada 3x − 2y + 9 = 0.", "进阶"],
  ["Janjang aritmetik", "Dalam satu janjang aritmetik, T₅ = 18 dan T₁₂ = 46. Cari S₂₀. / In an AP, find S₂₀.", "800", "760", "840", "880", "A", "7d = 28, maka d = 4 dan a = 2. S₂₀ = 10[2a + 19d] = 800.", "进阶"],
  ["Janjang geometri", "Dalam satu janjang geometri, T₂ = 6 dan T₅ = 162 dengan nisbah positif. Cari S₆. / Find S₆.", "364", "728", "730", "1456", "B", "r³ = 27, jadi r = 3 dan a = 2. S₆ = 2(3⁶−1)/(3−1) = 728.", "进阶"],
  ["Janjang geometri", "Sebuah janjang geometri tak terhingga mempunyai sebutan pertama 12 dan hasil tambah 18. Cari nisbah sepunya. / Find the common ratio.", "1/2", "2/3", "1/3", "3/4", "C", "18 = 12/(1−r), maka r = 1/3.", "中等"],
  ["Matematik kewangan", "RM5,000 dilaburkan pada kadar faedah kompaun 4% setahun selama 3 tahun. Cari nilai matang. / Find the maturity value.", "RM5,400.00", "RM5,600.00", "RM5,612.00", "RM5,624.32", "D", "Nilai matang = 5000(1.04)³ = RM5,624.32.", "中等"],
  ["Pembezaan", "Diberi y = (x² + 1)(2x − 3). Cari dy/dx. / Find dy/dx.", "6x² − 6x + 2", "6x² − 3x + 2", "4x² − 6x + 2", "6x² − 6x − 2", "A", "Gunakan petua hasil darab dan ringkaskan.", "中等"],
  ["Titik pegun", "Bagi y = x³ − 6x² + 9x, titik pegun manakah merupakan maksimum tempatan? / Which stationary point is a local maximum?", "(3,0)", "(1,4)", "(1,0)", "(3,4)", "B", "dy/dx = 3(x−1)(x−3). Pada x=1, d²y/dx²<0 dan y=4.", "进阶"],
  ["Pembezaan tersirat", "Diberi x² + xy + y² = 7. Cari dy/dx pada (1,2). / Find dy/dx at (1,2).", "−5/4", "4/5", "−4/5", "5/4", "C", "dy/dx = −(2x+y)/(x+2y). Gantikan (1,2) untuk mendapat −4/5.", "进阶"],
  ["Kadar perubahan", "Jejari bulatan bertambah pada 0.3 cm s⁻¹. Cari kadar pertambahan luas apabila jejari 10 cm. / Find dA/dt.", "3π cm² s⁻¹", "5π cm² s⁻¹", "10π cm² s⁻¹", "6π cm² s⁻¹", "D", "dA/dt = 2πr(dr/dt) = 2π(10)(0.3) = 6π.", "进阶"],
  ["Pengamiran", "Cari ∫(3x² − 4x + 1) dx. / Evaluate the integral.", "x³ − 2x² + x + C", "x³ − 4x² + x + C", "6x − 4 + C", "x³ − 2x + C", "A", "Kamirkan setiap sebutan secara berasingan.", "中等"],
  ["Pengamiran tentu", "Hitung ∫₁³(2x + 1) dx. / Evaluate the definite integral.", "8", "10", "12", "14", "B", "[x²+x]₁³ = 12 − 2 = 10.", "中等"],
  ["Luas di bawah lengkung", "Cari luas di bawah y = 4x − x² dari x = 0 hingga x = 4. / Find the area.", "16/3", "8", "32/3", "16", "C", "∫₀⁴(4x−x²)dx = [2x²−x³/3]₀⁴ = 32/3.", "进阶"],
  ["Isi padu kisaran", "Kawasan di bawah y = √x, 0 ≤ x ≤ 4, diputarkan 360° pada paksi-x. Cari isi padu. / Find the volume of revolution.", "4π", "6π", "16π", "8π", "D", "V = π∫₀⁴y²dx = π∫₀⁴x dx = 8π.", "进阶"],
  ["Trigonometri", "Selesaikan cos 2x = 0 bagi 0 ≤ x ≤ 2π. / Solve cos 2x = 0.", "π/4, 3π/4, 5π/4, 7π/4", "π/2, 3π/2", "0, π, 2π", "π/6, 5π/6, 7π/6, 11π/6", "A", "2x = π/2, 3π/2, 5π/2, 7π/2 dalam julat 0 hingga 4π.", "进阶"],
  ["Identiti trigonometri", "Jika tan θ = 3/4 dan θ sudut tirus, cari sin 2θ. / Find sin 2θ.", "7/25", "24/25", "12/25", "3/5", "B", "sin 2θ = 2tanθ/(1+tan²θ) = 24/25.", "中等"],
  ["Persamaan trigonometri", "Selesaikan 2sin²x − 3sin x + 1 = 0 bagi 0° ≤ x ≤ 360°. / Solve the equation.", "30°, 150°", "90°, 270°", "30°, 90°, 150°", "0°, 180°, 360°", "C", "Faktorkan kepada (2sin x−1)(sin x−1)=0.", "进阶"],
  ["Hukum kosinus", "Dua sisi segi tiga ialah 7 cm dan 9 cm, dengan sudut kandung 60°. Cari sisi ketiga. / Find the third side.", "√46 cm", "7 cm", "8 cm", "√67 cm", "D", "c² = 7² + 9² − 2(7)(9)cos60° = 67.", "中等"],
  ["Pilih atur", "Berapa susunan berlainan boleh dibentuk daripada semua huruf MATEMATIK? / How many distinct arrangements?", "45,360", "90,720", "181,440", "362,880", "A", "Terdapat 9 huruf dengan M, A dan T masing-masing berulang dua kali: 9!/(2!2!2!).", "进阶"],
  ["Gabungan", "Satu jawatankuasa 3 orang dipilih daripada 5 lelaki dan 4 perempuan. Berapa cara jika sekurang-kurangnya seorang perempuan?", "64", "74", "80", "84", "B", "Jumlah C(9,3) tolak semua lelaki C(5,3) = 84 − 10 = 74.", "进阶"],
  ["Taburan binomial", "Jika X ~ B(5, 0.4), cari P(X = 2). / Find P(X = 2).", "0.2304", "0.2592", "0.3456", "0.4096", "C", "P(X=2)=C(5,2)(0.4)²(0.6)³=0.3456.", "中等"],
  ["Taburan binomial", "Jika X ~ B(20, 0.35), cari nilai jangkaan X. / Find E(X).", "5", "6", "8", "7", "D", "E(X)=np=20(0.35)=7.", "中等"],
  ["Vektor", "Cari magnitud vektor 3i + 4j. / Find the magnitude of 3i + 4j.", "5", "6", "7", "25", "A", "Magnitud = √(3²+4²)=5.", "中等"],
  ["Vektor", "Cari vektor unit dalam arah 6i + 8j. / Find the unit vector.", "(4/5)i + (3/5)j", "(3/5)i + (4/5)j", "6i + 8j", "(6/5)i + (8/5)j", "B", "Magnitud ialah 10, jadi bahagikan setiap komponen dengan 10.", "中等"],
  ["Hasil darab skalar", "Vektor (k,2) berserenjang dengan (3,−6). Cari k. / The vectors are perpendicular. Find k.", "2", "3", "4", "6", "C", "Hasil darab skalar sifar: 3k − 12 = 0.", "中等"],
  ["Matriks", "Cari songsangan matriks [[2,1],[5,3]]. / Find the inverse matrix.", "[[2,−1],[−5,3]]", "[[3,1],[5,2]]", "[[−3,1],[5,−2]]", "[[3,−1],[−5,2]]", "D", "Penentu ialah 1. Tukar kedudukan unsur pepenjuru dan songsangkan tanda unsur lain.", "中等"],
  ["Persamaan serentak", "Selesaikan 2x + 3y = 13 dan x − y = 1. Cari x. / Solve and find x.", "16/5", "11/5", "3", "4", "A", "Daripada x=y+1, 5y=11 dan x=16/5.", "中等"],
  ["Pengaturcaraan linear", "Satu rantau mempunyai bucu (0,0), (0,4), (3,3) dan (5,0). Cari nilai maksimum P = 2x + 3y. / Find the maximum value.", "12", "15", "14", "10", "B", "Nilai P pada bucu ialah 0, 12, 15 dan 10. Maksimum ialah 15.", "进阶"],
  ["Sukatan membulat", "Satu sektor berjejari 4 cm mempunyai panjang lengkok 10 cm. Cari luas sektor. / Find the sector area.", "10 cm²", "16 cm²", "20 cm²", "40 cm²", "C", "Luas sektor = 1/2 × jejari × panjang lengkok = 20 cm².", "中等"],
  ["Kinematik", "Halaju zarah ialah v = 6t² − 4t. Cari sesaran dari t = 1 hingga t = 3. / Find the displacement.", "28", "30", "32", "36", "D", "Sesaran = ∫₁³(6t²−4t)dt = [2t³−2t²]₁³ = 36.", "进阶"],
];

const accounting = [
  ["Pengenalan perakaunan", "Subbidang perakaunan manakah menyediakan maklumat untuk perancangan dan kawalan dalaman?", "Perakaunan pengurusan", "Perakaunan kewangan", "Pengauditan", "Percukaian", "A", "Perakaunan pengurusan membantu pihak dalaman membuat perancangan dan kawalan.", "中等"],
  ["Andaian perakaunan", "Pemilik membayar sewa rumah peribadi menggunakan wang perniagaan dan merekodkannya sebagai ambilan. Andaian manakah dipatuhi?", "Usaha berterusan", "Entiti berasingan", "Wang sebagai ukuran", "Tempoh perakaunan", "B", "Pemilik dan perniagaan dianggap dua entiti yang berasingan.", "中等"],
  ["Persamaan perakaunan", "Perniagaan membeli alatan RM8,000 secara tunai. Apakah kesan terhadap jumlah aset?", "Bertambah RM8,000", "Berkurang RM8,000", "Tidak berubah", "Bertambah RM16,000", "C", "Tunai berkurang dan alatan bertambah pada jumlah yang sama.", "中等"],
  ["Dokumen sumber", "Dokumen manakah menjadi bukti utama pembelian barang niaga secara kredit?", "Memo", "Resit", "Bil tunai", "Invois", "D", "Invois digunakan bagi urus niaga jual beli secara kredit.", "中等"],
  ["Diskaun niaga", "Harga senarai barang ialah RM10,000 dan diskaun niaga 10%. Berapakah nilai yang direkod dalam buku akaun?", "RM9,000", "RM9,100", "RM9,900", "RM10,000", "A", "Diskaun niaga tidak direkod berasingan; nilai bersih ialah RM9,000.", "中等"],
  ["Diskaun tunai", "Hutang RM5,000 dijelaskan dalam tempoh diskaun tunai 2%. Berapakah bayaran dan diskaun diterima?", "RM5,000 dan RM100", "RM4,900 dan RM100", "RM4,800 dan RM200", "RM4,900 dan RM200", "B", "Diskaun 2% ialah RM100, maka bayaran bersih RM4,900.", "中等"],
  ["Catatan bergu", "Pemilik membawa masuk sebuah kenderaan bernilai RM30,000 sebagai modal. Catatan manakah betul?", "Debit Modal, Kredit Kenderaan", "Debit Bank, Kredit Modal", "Debit Kenderaan, Kredit Modal", "Debit Kenderaan, Kredit Bank", "C", "Aset kenderaan bertambah di debit dan modal bertambah di kredit.", "中等"],
  ["Catatan bergu", "Jualan kredit RM3,000 kepada Hana Trading direkod sebagai...", "Debit Jualan, Kredit Akaun Belum Terima", "Debit Bank, Kredit Jualan", "Debit Jualan, Kredit Bank", "Debit Akaun Belum Terima, Kredit Jualan", "D", "Jualan dikreditkan dan penghutang didebitkan.", "中等"],
  ["Buku Tunai", "Baki bank debit RM4,200. Perniagaan mengeluarkan cek RM900 dan menerima pindahan terus RM600. Cari baki baharu.", "RM3,900 debit", "RM3,300 debit", "RM4,500 debit", "RM5,700 debit", "A", "RM4,200 − RM900 + RM600 = RM3,900.", "中等"],
  ["Buku Tunai Runcit", "Di bawah sistem panjar, wang runcit ditetapkan RM500 dan perbelanjaan bulan itu RM360. Berapakah bayaran balik?", "RM140", "RM360", "RM500", "RM860", "B", "Bayaran balik menyamai jumlah yang dibelanjakan, iaitu RM360.", "中等"],
  ["Jurnal khas", "Jumlah Jurnal Jualan diposkan ke lejar sebagai...", "Debit Jualan dan kredit Akaun Kawalan Belum Terima", "Debit Bank dan kredit Jualan", "Debit Akaun Kawalan Belum Terima dan kredit Jualan", "Debit Belian dan kredit Akaun Belum Bayar", "C", "Jualan kredit menambah Akaun Belum Terima dan hasil jualan.", "中等"],
  ["Dokumen sumber", "Pembeli memulangkan barang niaga rosak kepada pembekal. Dokumen manakah disediakan oleh pembeli?", "Penyata akaun", "Nota kredit", "Invois tambahan", "Nota debit", "D", "Pembeli menghantar nota debit untuk memberitahu akaun pembekal didebitkan.", "中等"],
  ["Akaun kawalan", "Akaun Kawalan Belum Terima mempunyai baki awal RM5,000, jualan kredit RM20,000, penerimaan RM18,000 dan pulangan jualan RM1,000. Cari baki akhir.", "RM6,000", "RM7,000", "RM8,000", "RM24,000", "A", "RM5,000 + RM20,000 − RM18,000 − RM1,000 = RM6,000.", "进阶"],
  ["Imbangan duga", "Butiran manakah lazimnya mempunyai baki kredit dalam Imbangan Duga?", "Inventori", "Akaun Belum Bayar", "Ambilan", "Belanja sewa", "B", "Liabiliti Akaun Belum Bayar mempunyai baki kredit.", "中等"],
  ["Akaun perdagangan", "Jualan RM50,000; inventori awal RM8,000; belian RM30,000; angkutan masuk RM2,000; inventori akhir RM10,000. Cari untung kasar.", "RM18,000", "RM19,000", "RM20,000", "RM22,000", "C", "Kos jualan = 8,000 + 30,000 + 2,000 − 10,000 = 30,000; untung kasar RM20,000.", "进阶"],
  ["Akaun Untung Rugi", "Untung kasar RM25,000, hasil lain RM2,000 dan jumlah belanja RM19,000. Cari untung bersih.", "RM4,000", "RM6,000", "RM7,000", "RM8,000", "D", "Untung bersih = RM25,000 + RM2,000 − RM19,000 = RM8,000.", "中等"],
  ["Pelarasan", "Apakah kesan merekod belanja belum bayar pada akhir tempoh?", "Belanja dan liabiliti bertambah", "Belanja berkurang dan aset bertambah", "Aset dan hasil bertambah", "Liabiliti berkurang dan hasil bertambah", "A", "Belanja terakru menambah belanja tempoh semasa serta liabiliti semasa.", "中等"],
  ["Pelarasan", "Insurans prabayar pada akhir tempoh dilaporkan sebagai...", "Hasil", "Aset semasa", "Liabiliti semasa", "Belanja modal", "B", "Bayaran bagi tempoh akan datang ialah aset semasa.", "中等"],
  ["Susut nilai", "Aset berharga RM50,000, nilai skrap RM5,000 dan usia guna 5 tahun. Cari susut nilai tahunan kaedah garis lurus.", "RM5,000", "RM8,000", "RM9,000", "RM10,000", "C", "(RM50,000 − RM5,000) ÷ 5 = RM9,000.", "中等"],
  ["Susut nilai", "Nilai buku awal mesin RM51,200. Kadar susut nilai baki berkurangan ialah 20%. Cari susut nilai tahun semasa.", "RM8,000", "RM9,600", "RM10,000", "RM10,240", "D", "20% × RM51,200 = RM10,240.", "中等"],
  ["Pelupusan aset", "Nilai buku kenderaan semasa pelupusan ialah RM30,000 dan hasil jualan RM34,000. Apakah hasil pelupusan?", "Untung RM4,000", "Rugi RM4,000", "Untung RM30,000", "Rugi RM34,000", "A", "Harga jualan melebihi nilai buku sebanyak RM4,000.", "中等"],
  ["Hutang lapuk", "Akaun Belum Terima RM50,000. Hutang lapuk RM2,000 dihapus kira dan peruntukan baharu 5% atas baki bersih. Cari peruntukan baharu.", "RM2,000", "RM2,400", "RM2,500", "RM2,600", "B", "Baki bersih RM48,000; 5% ialah RM2,400.", "进阶"],
  ["Peruntukan hutang ragu", "Peruntukan hutang ragu lama RM1,800 dan peruntukan baharu RM2,400. Apakah pelarasan dalam Akaun Untung Rugi?", "Hasil RM600", "Belanja RM1,800", "Belanja RM600", "Hasil RM2,400", "C", "Pertambahan peruntukan RM600 diiktiraf sebagai belanja.", "进阶"],
  ["Pembetulan kesilapan", "Belanja membaiki kenderaan RM8,000 tersalah debit Akaun Kenderaan. Catatan pembetulan ialah...", "Debit Kenderaan, kredit Belanja Membaiki", "Debit Bank, kredit Kenderaan", "Debit Belanja Membaiki, kredit Bank", "Debit Belanja Membaiki, kredit Kenderaan", "D", "Pindahkan jumlah daripada aset kepada belanja: debit belanja, kredit kenderaan.", "进阶"],
  ["Akaun Tergantung", "Jumlah debit Imbangan Duga melebihi jumlah kredit sebanyak RM450. Baki Akaun Tergantung sementara ialah...", "Kredit RM450", "Debit RM450", "Debit RM900", "Kredit RM900", "A", "Kredit RM450 diperlukan untuk menyamakan kedua-dua jumlah.", "中等"],
  ["Analisis nisbah", "Aset semasa RM60,000 dan liabiliti semasa RM30,000. Cari nisbah semasa.", "1:2", "2:1", "3:1", "30:60", "B", "Nisbah semasa = 60,000 : 30,000 = 2 : 1.", "中等"],
  ["Analisis nisbah", "Kos jualan RM120,000 dan inventori purata RM20,000. Cari kadar pusing ganti inventori.", "4 kali", "5 kali", "6 kali", "8 kali", "C", "RM120,000 ÷ RM20,000 = 6 kali.", "中等"],
  ["Analisis nisbah", "Untung bersih RM30,000 dan modal digunakan RM150,000. Cari pulangan atas modal.", "10%", "15%", "18%", "20%", "D", "RM30,000 ÷ RM150,000 × 100% = 20%.", "中等"],
  ["Rekod tak lengkap", "Modal awal RM50,000, modal akhir RM80,000, ambilan RM12,000 dan modal tambahan RM10,000. Cari untung bersih.", "RM32,000", "RM30,000", "RM28,000", "RM52,000", "A", "Untung = modal akhir + ambilan − modal tambahan − modal awal = RM32,000.", "进阶"],
  ["Penyesuaian bank", "Baki debit Buku Tunai RM4,000, cek belum dikemukakan RM1,200 dan deposit belum dikreditkan RM700. Cari baki kredit Penyata Bank.", "RM4,000", "RM4,500", "RM4,900", "RM5,200", "B", "RM4,000 + RM1,200 − RM700 = RM4,500.", "进阶"],
  ["Perkongsian", "Untung bersih perkongsian RM60,000. Faedah modal A RM4,000, B RM2,000 dan gaji A RM12,000. Baki untung dibahagi 2:1. Berapakah bahagian baki untung B?", "RM10,000", "RM12,000", "RM14,000", "RM16,000", "C", "Baki untung = RM42,000. Bahagian B = 1/3 × RM42,000 = RM14,000.", "进阶"],
  ["Perkongsian", "Di bawah kaedah modal tetap, pernyataan manakah betul tentang Akaun Semasa pekongsi?", "Sentiasa berbaki kredit", "Merekod aset bukan semasa", "Menggantikan Akaun Realisasi", "Tidak merekod modal asal yang ditetapkan", "D", "Modal asal kekal dalam Akaun Modal; pelarasan berkala direkod dalam Akaun Semasa.", "中等"],
  ["Pembubaran perkongsian", "Aset perkongsian dijual secara tunai RM20,000 ketika pembubaran. Catatan dalam Akaun Realisasi ialah...", "Debit Bank, kredit Realisasi", "Debit Realisasi, kredit Bank", "Debit Modal, kredit Bank", "Debit Bank, kredit Modal", "A", "Tunai diterima di Bank dan hasil realisasi dikreditkan.", "中等"],
  ["Syarikat berhad", "Apakah hak utama pemegang syer keutamaan?", "Dividen tidak tetap selepas syer biasa", "Keutamaan menerima dividen pada kadar ditetapkan", "Mengurus operasi harian syarikat", "Liabiliti tidak terhad", "B", "Syer keutamaan biasanya menerima dividen berkadar tetap sebelum syer biasa.", "中等"],
  ["Modal syer", "Syarikat menerbitkan 100,000 syer biasa bernilai RM1 sesyer dan semuanya dibayar penuh. Cari modal diterbitkan dan berbayar penuh.", "RM1,000", "RM10,000", "RM100,000", "RM1,000,000", "C", "100,000 × RM1 = RM100,000.", "中等"],
  ["Akaun Pengeluaran", "Bahan langsung RM40,000, buruh langsung RM25,000 dan belanja langsung RM5,000. Cari kos prima.", "RM45,000", "RM60,000", "RM65,000", "RM70,000", "D", "Kos prima ialah jumlah semua kos langsung: RM70,000.", "中等"],
  ["Overhed kilang", "Bahan tak langsung RM3,000, sewa kilang RM12,000 dan gaji penyelia kilang RM8,000. Cari jumlah overhed kilang.", "RM23,000", "RM20,000", "RM15,000", "RM11,000", "A", "Ketiga-tiga butiran ialah overhed kilang; jumlah RM23,000.", "中等"],
  ["Titik pulang modal", "Kos tetap RM60,000, harga jualan seunit RM25 dan kos berubah seunit RM15. Cari titik pulang modal dalam unit.", "4,000 unit", "6,000 unit", "10,000 unit", "15,000 unit", "B", "Sumbangan seunit RM10; RM60,000 ÷ RM10 = 6,000 unit.", "进阶"],
  ["Analisis kos-volum-untung", "Sumbangan seunit RM12, jualan 8,000 unit dan kos tetap RM70,000. Cari untung.", "RM12,000", "RM16,000", "RM26,000", "RM96,000", "C", "Jumlah sumbangan RM96,000; tolak kos tetap RM70,000 memberi untung RM26,000.", "进阶"],
  ["Belanjawan tunai", "Baki tunai awal RM10,000, jumlah penerimaan RM45,000 dan pembayaran RM38,000. Cari baki tunai akhir.", "RM7,000", "RM10,000", "RM15,000", "RM17,000", "D", "RM10,000 + RM45,000 − RM38,000 = RM17,000.", "中等"],
];

const banks = [
  {
    subject: "Matematik Tambahan",
    filename: "MyGuru_F5_Matematik_Tambahan_2025_Kedah_Trial_Adapted_40.json",
    storagePath: "generated/myguru-f5-matematik-tambahan-2025-kedah-adapted-40.json",
    sourceLabel: "MyGuru 原创改编练习｜参考考点：2025 Kedah Matematik Tambahan Trial Kertas 1",
    sourcePrefix: "myguru:2025:kedah:addmath:adapted",
    rows: addMath,
  },
  {
    subject: "Prinsip Perakaunan",
    filename: "MyGuru_F5_Prinsip_Perakaunan_2025_Selangor_PINTAS_Adapted_40.json",
    storagePath: "generated/myguru-f5-prinsip-perakaunan-2025-selangor-pintas-adapted-40.json",
    sourceLabel: "MyGuru 原创改编练习｜参考考点：2025 Selangor PINTAS Prinsip Perakaunan Kertas 1",
    sourcePrefix: "myguru:2025:selangor:akaun:adapted",
    rows: accounting,
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
    if (![topic, prompt, a, b, c, d, explanation, difficulty].every((value) => typeof value === "string" && value.trim()))
      throw new Error(`${bank.subject} row ${index + 1}: missing field`);
    if (!Object.hasOwn(distribution, answer)) throw new Error(`${bank.subject} row ${index + 1}: invalid answer`);
    if (new Set([a, b, c, d]).size !== 4) throw new Error(`${bank.subject} row ${index + 1}: duplicate options`);
    if (prompts.has(prompt)) throw new Error(`${bank.subject} row ${index + 1}: duplicate prompt`);
    prompts.add(prompt);
    distribution[answer] += 1;
  });
  if (Object.values(distribution).some((count) => count !== 10))
    throw new Error(`${bank.subject}: answers are not balanced ${JSON.stringify(distribution)}`);
}

async function seedBank(bank, teacherId) {
  validateBank(bank);
  let { data: upload, error: uploadReadError } = await supabase
    .from("uploads").select("id").eq("storage_path", bank.storagePath).maybeSingle();
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
    .from("questions").select("source_key").like("source_key", `${bank.sourcePrefix}:%`);
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
  const { error: uploadUpdateError } = await supabase.from("uploads").update({ status: "published" }).eq("id", upload.id);
  if (uploadUpdateError) throw uploadUpdateError;

  const { data: verified, error: verifyError } = await supabase
    .from("questions").select("id,correct_option,status,answer_confirmed,source_key")
    .like("source_key", `${bank.sourcePrefix}:%`);
  if (verifyError) throw verifyError;
  const invalid = (verified ?? []).filter((item) => item.status !== "published" || !item.answer_confirmed || !/^[ABCD]$/.test(item.correct_option));
  if ((verified ?? []).length !== 40 || invalid.length) throw new Error(`${bank.subject}: verification failed`);
  return { subject: bank.subject, inserted: payload.length, published: verified.length };
}

const { data: teachers, error: teacherError } = await supabase.from("profiles").select("id").eq("role", "teacher").limit(2);
if (teacherError) throw teacherError;
if (!teachers || teachers.length !== 1) throw new Error("Expected exactly one teacher account for bank ownership.");

const results = [];
for (const bank of banks) results.push(await seedBank(bank, teachers[0].id));
console.log(JSON.stringify(results));
