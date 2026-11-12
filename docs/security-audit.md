# PSB Fathan Mubina — Audit Keamanan dan Kesiapan Pra-Produksi

**Repository:** `appfathanmubina/psb-pcbfm`  
**Branch:** `main`  
**Commit yang diperiksa:** `1a4936881b1f395bff88810fc2c6f222fcef7db1`  
**Tanggal pemeriksaan:** 4 November 2026  
**Jenis audit:** pemeriksaan source statis, kontrak API, tes regresi GitHub Actions, dan konfigurasi repository.  
**Batasan:** project Apps Script dan Spreadsheet produksi tidak diakses untuk pengujian runtime. Source di GitHub belum otomatis berarti source sudah tersalin atau ter-deploy pada Apps Script.

## Ringkasan status

- Validasi GitHub Actions `Validate PSB PWA`: **berhasil** pada commit di atas.
- Deploy GitHub Pages: **berhasil** pada commit di atas.
- Repository tetap Public.
- Branch `main` saat pemeriksaan belum dilindungi branch protection/ruleset.
- Tidak ada perubahan database, akun, Spreadsheet, atau deployment Apps Script yang dilakukan dalam audit ini.

## Ruang lingkup

- Backend Apps Script: `Code.gs`, `Index.html`, `SetupDatabase.gs`, `BridgeServer.gs`, `Bridge.html`.
- PWA: `frontend/index.html`, `app.js`, `api-bridge.js`, `styles.css`, manifest, dan service worker.
- Tes kontrak bridge, autentikasi, sesi, ownership, upload, password migration, penghapusan chat, cache, dan kesesuaian API UI.
- Workflow GitHub Actions dan sinkronisasi manual Apps Script.

## Temuan yang telah dikonfirmasi dari source

### 1. API dan bridge

- Ada 70 fungsi dalam allowlist bridge; semua nama tersebut memiliki deklarasi fungsi backend.
- Semua pemanggilan RPC PWA yang diperiksa tercakup oleh allowlist.
- Bridge menggunakan origin allowlist, challenge/request ID, token transport dengan masa berlaku 180 detik, dan batas 20 pemakaian per token.
- Token transport dikonsumsi dengan penguncian Script Lock.
- PWA menggunakan form POST menuju Web App Apps Script; response dikirim kembali ke origin yang diizinkan.
- Tes kontrak bridge pada workflow lulus.
- Metadata versi masih tidak seragam: `Code.gs` menyatakan bridge 32.6.0, `Bridge.html` 32.5.0, klien bridge memakai cache key 32.11.0, dan service worker 32.12.0. Tidak ditemukan pemeriksaan kesetaraan versi saat handshake; saat ini ini merupakan ketidakteraturan metadata/cache, bukan bukti penyebab kegagalan koneksi.

### 2. Pendaftaran Wali dan autentikasi

- Pendaftaran Wali saat ini tidak menggunakan Email OTP atau verifikasi email.
- Email dan nomor HP opsional, tetapi minimal satu identitas login wajib diisi.
- Akun dibuat aktif dengan role WALI dan sesi diterbitkan setelah validasi dan pemeriksaan duplikasi.
- Seluruh pembuatan password baru (registrasi Wali, pembuatan pengguna manual, perubahan/reset password, dan bootstrap Superadmin) menggunakan PBKDF2-HMAC-SHA256 dengan salt per pengguna dan 60.000 iterasi.
- Login tetap memverifikasi hash SHA-256 lama dan memigrasikannya ke PBKDF2 setelah password lama terbukti benar; akun tidak perlu reset password dan identitas/role/data pendaftaran tidak diubah.
- Hash PBKDF2 dengan jumlah iterasi berbeda dari kebijakan saat ini juga ditingkatkan setelah login berhasil; hash PBKDF2 tidak pernah diturunkan menjadi SHA-256.
- Derivasi hash yang mahal dilakukan sebelum ScriptLock pada jalur pendaftaran, perubahan password, reset, dan pembuatan pengguna agar waktu lock global lebih singkat.
- Perubahan password dan reset admin mencabut sesi sesuai kebijakan.
- Login lockout menggunakan CacheService; mekanisme cache adalah best-effort dan bukan rate limiter yang kuat terhadap serangan terdistribusi.

### 3. Validasi sesi dan risiko performa

- `getSessionUser_()` membaca seluruh baris sheet `SESSIONS` untuk mencari hash token.
- Validasi sesi kemudian memanggil `findUserById_()` dengan bypass cache, yang membaca seluruh baris `USERS`.
- Jalur ini dapat memperlambat setiap RPC terautentikasi seiring bertambahnya jumlah sesi/pengguna.
- Hash PBKDF2 60.000 iterasi perlu diukur pada runtime Apps Script yang sebenarnya. Belum ada benchmark produksi yang membuktikan durasi atau menyimpulkan bahwa hash merupakan penyebab timeout.
- Beberapa operasi tulis memakai Script Lock global dengan waktu tunggu 5–15 detik. Pendaftaran Wali menghitung hash password ketika lock masih dipegang. Beban bersamaan dapat menambah antrean.
- Jangan menurunkan iterasi hash hanya untuk mengejar kecepatan tanpa pengujian keamanan, kompatibilitas akun lama, dan benchmark.

### 4. Kepemilikan, dokumen, dan pembayaran

- Tes regresi memeriksa pembatasan akses Wali berdasarkan pemilik pendaftaran dan pembatasan role untuk dokumen serta pembayaran.
- Upload dokumen memeriksa ukuran encoded sebelum decode, ukuran byte setelah decode, MIME, dan signature PDF/JPEG/PNG/WEBP.
- Batas dokumen maksimal 20 MB (default 10 MB); bukti pembayaran maksimal 5 MB.
- Upload file tetap memerlukan uji runtime dengan file benar, file palsu/mismatch, ukuran batas, dan kegagalan penyimpanan.
- Transaksi Google Sheets/Drive bukan transaksi database atomik lintas layanan. Uji skenario kegagalan parsial diperlukan, misalnya file Drive berhasil dibuat tetapi pencatatan sheet gagal.
- Pemeriksaan status dan penguncian pada verifikasi dokumen/pembayaran terlihat pada source dan tes statis; uji beban serentak masih diperlukan.

### 5. Chat dan SetupDatabase

- Modul chat, UI, endpoint, polling, dan otomasi chat tidak ditemukan pada file runtime utama yang diperiksa.
- `SetupDatabase.gs` tidak lagi mendeklarasikan sheet `WALI_OTP`.
- Sheet `WALI_OTP` atau sheet chat yang mungkin sudah ada di Spreadsheet lama tidak dihapus oleh perubahan source ini.
- `setupPSBDatabase_()` tidak lagi memanggil pembersihan trigger chat.
- Wrapper `cleanupLegacyChatAutomationTriggers()` meminta UI Spreadsheet dan konfirmasi YES/NO sebelum memanggil helper internal; pembatasan konteks editor mencegah fungsi maintenance ini dipanggil dari Web App/browser. Helper hanya menghapus trigger bernama `runChatAutomation` atau `runChatAutomation_` serta properti `PSB_CHAT_AUTOMATION_TRIGGER`.
- Jalankan wrapper cleanup secara manual hanya jika diperlukan. Jangan menjalankan setup database untuk membersihkan trigger.

### 6. PWA, cache, dan publikasi galeri

- Frontend PWA diterbitkan melalui GitHub Pages; Apps Script tetap backend produksi.
- Service worker memakai strategi network-first untuk aset same-origin dan cache sebagai fallback offline.
- Galeri frontend menggunakan aset statis GitHub; tes memverifikasi backend galeri Google Drive telah dihapus dan dokumen pribadi tetap disimpan melalui folder Drive privat.
- Pastikan hanya foto yang memang disetujui untuk publik berada di `frontend/gallery/`. Repository bersifat Public, sehingga semua aset yang dikomit dapat diunduh publik.

## Temuan yang perlu ditindaklanjuti sebelum final produksi

<details>
<summary>Prioritas tinggi</summary>

1. **Benchmark autentikasi dan sesi pada Apps Script uji.** Ukur login PBKDF2, validasi sesi dengan jumlah akun/sesi realistis, dan beberapa RPC paralel. Catat durasi tiap fungsi dari Executions. Optimasi harus mempertahankan hash dan validasi kepemilikan.
2. **Uji konkurensi dan kegagalan parsial.** Uji pendaftaran identitas sama secara bersamaan, verifikasi pembayaran ganda, verifikasi dokumen, dan kegagalan antara Drive write dan Sheet write.
3. **Uji runtime end-to-end pada salinan project dan Spreadsheet.** Tes login/logout berulang, pendaftaran Wali langsung, semua role, pendaftaran, upload, verifikasi, tagihan, pembayaran, seleksi, pengumuman, dan daftar ulang.
4. **Konfirmasi kesamaan source Apps Script.** Bandingkan kelima file runtime Apps Script di project produksi dengan commit kandidat GitHub; jangan menganggap merge GitHub otomatis menyinkronkan Apps Script.

</details>

<details>
<summary>Prioritas menengah</summary>

1. Aktifkan branch protection/ruleset untuk `main`: wajib PR, wajib status check `structure`, larang force-push dan penghapusan branch.
2. Selaraskan dokumentasi dengan pendaftaran langsung tanpa OTP dan prosedur cleanup trigger yang sekarang terpisah dari setup database.
3. Rapikan metadata versi bridge bila diperlukan; jangan menyamakan nomor versi tanpa memastikan arti setiap konstanta dan strategi cache.
4. Uji kuota Apps Script, ukuran upload, dan pengalaman PWA pada Android serta desktop; uji iOS jika digunakan.
5. Pastikan file galeri yang dikomit memang aman untuk publik dan mendapat persetujuan publikasi.

</details>

## Batasan audit

- Tes GitHub Actions adalah tes regresi source statis dan pemeriksaan kontrak. Tes tersebut tidak menjalankan fungsi Apps Script terhadap Spreadsheet/Drive sebenarnya.
- Tidak dilakukan load test, penetration test, audit akun Google, pemeriksaan seluruh isi data produksi, atau pemulihan backup.
- Audit ini tidak menyatakan aplikasi telah tersertifikasi aman.
- Status deploy GitHub Pages tidak membuktikan backend Apps Script sudah diperbarui.

## Gerbang final produksi

1. Semua perubahan source disetujui dan digabung ke `main`; workflow validasi dan Pages harus sukses.
2. Backup Spreadsheet, project Apps Script, dan konfigurasi Script Properties dilakukan dengan prosedur aman.
3. Salin source Apps Script dari commit yang disetujui ke project uji dan perbarui deployment uji.
4. Selesaikan checklist runtime integrasi; catat hasil, durasi, dan bukti.
5. Bandingkan source project Apps Script produksi dengan source GitHub yang disetujui.
6. Pemilik aplikasi menyetujui sinkronisasi manual dan pembaruan deployment Web App yang sudah ada.
7. Setelah rilis, lakukan smoke test login, logout/login ulang, pendaftaran Wali, dan akses data berdasarkan role.

**Kesimpulan:** repository telah melewati pemeriksaan source dan workflow otomatis pada commit yang diperiksa. Aplikasi **belum dapat dinyatakan final produksi** sampai risiko performa, uji transaksi/konkurensi, uji runtime pada lingkungan uji, dan kesamaan source Apps Script produksi dituntaskan.


---

## Addendum — baseline repository 12 November 2026

**Baseline commit:** `60cb157fb50d7738e5f32d9cfdb05850fed91e90`  
**Branch:** `main`  
**Purpose:** memperbarui interpretasi temuan audit 4 November tanpa menghapus catatan historisnya.

### Pemeriksaan repository dan workflow

- Repository masih Public dan default branch tetap `main`.
- Workflow validasi berada di `.github/workflows/validate.yml`. Trigger-nya `push` dan `pull_request`; job wajib bernama `structure`. Workflow memeriksa file runtime PWA dan Apps Script, syntax JS/JSON, manifest, kontrak Bridge, autentikasi/sesi, ownership, upload, pembayaran, seleksi, notifikasi, performa, serta regresi UI.
- Workflow Pages berada di `.github/workflows/pages.yml`. Workflow ini membangun dan menerbitkan `./frontend`; ia bukan mekanisme deployment Apps Script.
- Workflow validasi memeriksa keberadaan `apps-script/Bridge.html`, `BridgeServer.gs`, `Code.gs`, `SetupDatabase.gs`, dan `Index.html`. Workflow Pages memvalidasi subset source yang dibutuhkan untuk build Pages. Kedua workflow memiliki tanggung jawab berbeda.
- Pencarian GitHub saat pemeriksaan tidak menemukan PR terbuka.
- Inventarisasi branch mengembalikan 183 branch termasuk `main`. Daftar ini belum diklasifikasikan berdasarkan status merge/usia; tidak ada branch yang dihapus.
- GitHub repository metadata mengonfirmasi akses admin untuk pemeriksa, tetapi konektor yang tersedia tidak menyediakan endpoint branch protection/ruleset. Karena itu status proteksi `main` saat addendum ini **belum dapat diverifikasi**; jangan menganggap rekomendasi README sudah diterapkan.

### Status CI dan Pages pada baseline

- Combined commit status untuk SHA baseline mengembalikan daftar status kosong.
- Wrapper workflow-run yang tersedia hanya mengambil run yang dipicu Pull Request; untuk commit baseline hasilnya kosong.
- Hasil di atas **tidak membuktikan workflow gagal maupun tidak pernah berjalan**. Status run push dan deployment Pages pada SHA baseline masih perlu diverifikasi melalui tab Actions di GitHub.
- Link pemeriksaan: `https://github.com/appfathanmubina/psb-pcbfm/actions`.

### Klarifikasi metadata versi Bridge

Pemeriksaan source terbaru memperjelas temuan versi dari audit lama:

- `apps-script/Code.gs` mendefinisikan `PSB_PWA_BRIDGE_VERSION = '32.6.0'`.
- `apps-script/Bridge.html` mendefinisikan `VERSION = '32.6.0'` dan mengirimkannya pada pesan handshake.
- `frontend/api-bridge.js` mendefinisikan `BRIDGE_CLIENT_VERSION = '32.19.0'`; nilai ini digunakan sebagai query parameter `v` pada URL bootstrap untuk cache-busting file klien.
- Nilai versi klien tersebut bukan nomor versi protokol backend yang harus sama dengan `32.6.0`. Source klien yang diperiksa tidak melakukan penolakan handshake berdasarkan kesamaan nilai `version`.
- Dengan demikian, perbedaan `32.6.0` dan `32.19.0` **bukan bukti ketidakcocokan protokol**. Pernyataan audit 4 November mengenai versi Bridge yang tidak seragam (Bridge.html 32.5.0, client cache key 32.11.0, service worker 32.12.0) adalah catatan historis dan tidak lagi menggambarkan source pada baseline ini.
- Jangan menyamakan angka versi secara mekanis. Jika versi protokol hendak diubah, lakukan sebagai perubahan kontrak terpisah dengan tes kompatibilitas client/server.

### Batasan pemeriksaan tahap ini

- Tidak ada akses runtime ke project Apps Script, deployment, Spreadsheet, Drive, atau Script Properties produksi.
- Tidak dilakukan pengujian browser nyata atau verifikasi tampilan PWA yang sudah terpasang.
- Tidak ada bukti yang cukup untuk menyatakan CI/Pages sukses pada SHA baseline.
- Branch protection/ruleset belum terkonfirmasi.
- Daftar 183 branch belum cukup untuk menentukan branch mana yang aman dihapus.

### Tindak lanjut wajib

1. Periksa tab Actions dan pastikan workflow `Validate PSB PWA` serta `Deploy PWA to GitHub Pages` memiliki run yang sukses pada SHA baseline atau commit `main` terbaru.
2. Periksa Settings → Rules → Rulesets dan/atau Settings → Branches untuk memastikan `main` mewajibkan PR dan status check `structure`, serta melarang force-push dan penghapusan branch.
3. Klasifikasikan branch lama berdasarkan perbandingan terhadap `main` dan PR terkait sebelum mengusulkan penghapusan.
4. Lanjutkan audit sinkronisasi source Apps Script dan prosedur pembuktian source yang sedang terpasang pada deployment uji/produksi. Tidak ada sinkronisasi atau deployment yang dilakukan oleh addendum ini.

**Status addendum:** source/workflow statis diperiksa; CI, Pages run, dan branch protection masih menunggu verifikasi langsung di GitHub.
