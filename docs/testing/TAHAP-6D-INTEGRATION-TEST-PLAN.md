# Tahap 6D — Rencana Pengujian Integrasi PSB

Status: persiapan pengujian; belum ada pengujian runtime yang dijalankan.

## Tujuan

Membuktikan alur PSB, pembatasan enam role, keamanan data, dan ketahanan upload pada lingkungan uji yang terpisah dari produksi. Pengujian ini tidak mengubah source aplikasi atau data produksi.

## Batas keselamatan

- Target pengujian wajib merupakan proyek Google Apps Script, Spreadsheet, folder Drive, Script Properties, dan deployment uji yang terpisah dari produksi.
- Jangan menyalin nilai Script Properties produksi ke lingkungan uji. Isi dengan ID resource uji yang baru.
- Pastikan konfigurasi uji tidak menunjuk Spreadsheet produksi, folder dokumen produksi, maupun deployment produksi sebelum menjalankan tes.
- Gunakan data calon santri sintetis. Jangan gunakan NIK, NISN, nomor telepon, email, bukti transfer, atau dokumen identitas milik orang sungguhan.
- Gunakan enam akun uji terpisah: SUPERADMIN, ADMIN_PSB, VERIFIKATOR, SELEKSI, KEUANGAN, dan WALI. Jangan membagikan password atau token melalui issue, PR, log, atau percakapan.
- Jangan menjalankan tes yang membuat/mengubah/menghapus data terhadap produksi.
- Jangan menjalankan `getGoLiveChecklist()`, `getProductionReadiness()`, atau `getDataIntegrityReport()` di produksi untuk audit ini karena jalur diagnostik tersebut dapat menulis AUDIT_LOG.
- Tidak melakukan `clasp push`, deployment, perubahan Script Properties produksi, perubahan data produksi, atau merge ke `main` dalam Tahap 6D.
- Pengguna menyatakan backup dilewati. Karena itu, dokumen ini tidak menjadikan backup sebagai prasyarat, tetapi semua tes wajib tetap non-produksi.

## Gate 0 — Verifikasi isolasi lingkungan (wajib sebelum tes)

Catat hanya identitas non-rahasia berikut di laporan pengujian privat:
- Nama proyek Apps Script uji dan deployment uji.
- ID Spreadsheet uji.
- ID folder root dokumen uji.
- URL aplikasi uji.
- Konfirmasi keenam akun adalah akun uji dan role-nya sesuai.

Kriteria lulus:
1. Spreadsheet uji bukan Spreadsheet produksi.
2. Folder dokumen uji bukan folder dokumen produksi.
3. Script Properties uji berisi ID resource uji.
4. URL frontend/Bridge mengarah ke deployment uji.
5. Tidak ada data pribadi atau dokumen asli.

Jika salah satu belum dapat dibuktikan, hentikan pengujian. Jangan lanjutkan ke Gate 1.

## Gate 1 — Autentikasi dan sesi

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AUTH-01 | Login dengan password PBKDF2 valid | Login berhasil dan sesi dibuat |
| AUTH-02 | Login dengan password salah berulang | Throttling/lockout berjalan sesuai kebijakan |
| AUTH-03 | Login akun nonaktif | Ditolak |
| AUTH-04 | Sesi melewati batas idle | Sesi ditolak dan pengguna diminta login kembali |
| AUTH-05 | Logout lalu gunakan token lama | Token lama tidak dapat digunakan |
| AUTH-06 | Migrasi akun hash lama pada akun uji | Login valid memigrasikan hash ke PBKDF2; hash baru tidak diturunkan kembali ke SHA-256 |
| AUTH-07 | Ganti password | Password baru dapat dipakai; password lama ditolak |

Jangan melakukan migrasi password pada akun produksi selama pengujian.

## Gate 2 — Matriks enam role

Lakukan login terpisah untuk setiap akun. Uji akses melalui UI dan panggilan endpoint yang relevan; menyembunyikan menu saja tidak dianggap sebagai kontrol keamanan.

| Role | Akses yang diharapkan | Uji penolakan |
|---|---|---|
| SUPERADMIN | Pengelolaan penuh sesuai kebijakan, termasuk pengaturan dan backup uji | Tidak boleh mengakses data di luar lingkungan uji |
| ADMIN_PSB | Administrasi PSB, pendaftaran, verifikasi, master data, dan proses sesuai kebijakan | Endpoint khusus SUPERADMIN harus ditolak |
| VERIFIKATOR | Verifikasi dokumen/pembayaran dan tampilan operasional yang diizinkan | Tidak boleh mengubah nilai seleksi atau menerbitkan pengumuman |
| SELEKSI | Jadwal, peserta, nilai, hasil, dan pengumuman sesuai kewenangan | Tidak boleh melakukan mutasi pembayaran atau membuka daftar ulang jika tidak diizinkan |
| KEUANGAN | Verifikasi pembayaran dan proses daftar ulang sesuai kewenangan | Tidak boleh mengubah nilai seleksi atau menerbitkan pengumuman |
| WALI | Hanya pendaftaran milik sendiri, pembayaran, dokumen, informasi seleksi yang telah diumumkan, dan daftar ulang miliknya | Akses ID pendaftaran wali lain, data internal, nilai seleksi, dan hasil belum diumumkan harus ditolak/tidak dikirim |

Untuk setiap role, catat: menu yang tampil, endpoint yang berhasil, endpoint yang ditolak, serta data yang terlihat. Jangan simpan token sesi dalam bukti.

## Gate 3 — Alur end-to-end PSB

Gunakan satu identitas calon santri sintetis dari awal hingga akhir.

| ID | Langkah | Kriteria lulus |
|---|---|---|
| FLOW-01 | WALI membuat pendaftaran dan mengirim formulir | Pendaftaran tersimpan satu kali dan terkait ke akun WALI |
| FLOW-02 | WALI membuka pembayaran sebelum dokumen lengkap | Pembayaran tetap dapat dilakukan |
| FLOW-03 | WALI mengirim bukti pembayaran | Bukti tersimpan di folder uji yang privat |
| FLOW-04 | KEUANGAN/role berwenang memverifikasi | Status pembayaran dan tagihan aktif konsisten di semua tampilan |
| FLOW-05 | WALI mengunggah dokumen wajib | Dokumen tercatat dan dapat diakses oleh role berwenang saja |
| FLOW-06 | VERIFIKATOR memeriksa dokumen | Status dokumen konsisten; revisi tidak menggandakan dokumen aktif |
| FLOW-07 | SELEKSI mengelola peserta/nilai | Nilai hanya tersedia untuk role staf yang berwenang |
| FLOW-08 | SELEKSI menerbitkan pengumuman | Hasil WALI baru tersedia setelah tanggal/publikasi resmi |
| FLOW-09 | WALI membuka hasil | Hanya keterangan hasil yang dipublikasikan; tidak ada nilai atau rincian skor |
| FLOW-10 | WALI membuka daftar ulang | Hanya data pendaftaran milik sendiri yang tampil |
| FLOW-11 | KEUANGAN memproses daftar ulang | Status dan tagihan daftar ulang konsisten |
| FLOW-12 | Ulangi pemuatan halaman dan login ulang | Data tetap konsisten dan sesi mengikuti kebijakan |

Kriteria alur: tidak ada status bertentangan antara Beranda, Pembayaran, Dokumen, Seleksi, dan Daftar Ulang.

## Gate 4 — Upload, jaringan, dan konkurensi

Gunakan berkas uji yang dibuat khusus, tidak berisi dokumen asli:
- PDF, JPEG, PNG, dan WEBP valid.
- File di bawah batas, tepat pada batas efektif, dan di atas batas 14 MB.
- Ekstensi/MIME palsu dan signature file yang tidak cocok.

| ID | Skenario | Kriteria lulus |
|---|---|---|
| UP-01 | Upload file kecil valid | Berhasil dan metadata sesuai |
| UP-02 | Upload file 10 MB dan 14 MB | Berhasil bila sesuai batas efektif dan payload Bridge |
| UP-03 | Upload file di atas 14 MB | Ditolak di frontend dan backend |
| UP-04 | File MIME tidak didukung atau signature palsu | Ditolak backend |
| UP-05 | Jaringan lambat | UI memberi status yang jelas; tidak membuat entri ganda |
| UP-06 | Putus jaringan setelah kirim | UI meminta cek status sebelum retry; tidak menggandakan dokumen/pembayaran |
| UP-07 | Dua aksi pembayaran/dokumen bersamaan | Data tidak saling menimpa dan status akhir benar |
| UP-08 | Klik kirim berulang | Satu transaksi/unggahan aktif, tidak ada duplikasi |

Catat ukuran file, MIME, waktu, hasil, dan ID record uji (bukan token atau isi dokumen).

## Gate 5 — Konsistensi, privasi, dan regresi UI

- Periksa status pembayaran setelah pembayaran terverifikasi tetapi dokumen belum lengkap.
- Periksa status dokumen setelah semua dokumen diverifikasi tetapi pembayaran belum selesai.
- Periksa tagihan aktif jika ada tagihan lama berstatus CANCELLED.
- Periksa dokumen lama berstatus REPLACED agar tidak muncul sebagai dokumen aktif.
- Periksa kepemilikan data WALI pada endpoint detail, daftar, pembayaran, dokumen, dan daftar ulang.
- Pastikan WALI tidak menerima field skor mentah maupun hasil yang belum dipublikasikan dalam payload API, bukan hanya menyembunyikan elemen UI.
- Uji desktop dan ponsel: navigasi, notifikasi, tombol kembali/muat ulang, login, dan upload.
- Periksa konsol browser dan log Apps Script untuk error yang relevan; redaksi token, email, nomor telepon, dan data pribadi sebelum menyimpan bukti.

## Format laporan hasil

Untuk setiap ID tes, catat:
- Status: PASS / FAIL / BLOCKED / NOT RUN.
- Tanggal dan waktu lokal.
- Role uji yang digunakan.
- Langkah ringkas dan hasil aktual.
- ID data uji sintetis (tanpa informasi pribadi).
- Bukti yang sudah disamarkan.
- Tautan issue/PR jika ditemukan defect.

Jangan menyatakan lulus jika hanya membaca source atau menjalankan tes statis. Runtime harus benar-benar dijalankan pada lingkungan uji.

## Exit criteria Tahap 6D

Tahap 6D hanya dapat dinyatakan selesai jika:
1. Gate 0 membuktikan isolasi lingkungan.
2. Semua AUTH, role, FLOW, UPLOAD, dan privasi kritis berstatus PASS.
3. Tidak ada defect kritis/tinggi yang terbuka.
4. Semua FAIL memiliki perbaikan dan tes regresi yang lulus.
5. Pengujian ulang dilakukan setelah perbaikan.
6. Laporan hasil dan bukti tersamarkan tersedia.

Tahap 6D tidak mengotorisasi merge ke `main`, `clasp push`, atau deployment produksi. Keputusan rilis dilakukan pada tahap terpisah setelah hasil runtime ditinjau.
