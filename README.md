# PSB Fathan Mubina — PWA Migration

Repository ini adalah tahap awal pemisahan frontend dari Google Apps Script.

## Prinsip migrasi

- Business logic Apps Script **tidak diubah** pada tahap ini.
- Source Apps Script tetap berada di `apps-script/`.
- `apps-script/Index.html` tetap menjadi entry point HTML Service.
- `apps-script/Index.legacy.html` adalah snapshot source asli untuk rollback/reference.
- Frontend hasil ekstraksi berada di `frontend/`.
- `google.script.run` tetap menjadi transport yang kompatibel untuk tahap Apps Script.
- Static PWA hosting belum diaktifkan sebagai backend/API publik.

## Struktur

```text
frontend/
  index.html
  styles.css
  app.js
  manifest.webmanifest
  sw.js
  icons/

apps-script/
  Code.gs
  Index.html
  Index.legacy.html
  SetupDatabase.gs
  Bridge.gs
  .clasp.example.json

docs/
.github/
appsscript.json
```

## Apps Script production safety

Semua workflow Apps Script production menggunakan GitHub Environment bernama `production`. Konfigurasikan Environment tersebut dengan required reviewers agar proses push/deploy memerlukan persetujuan manusia. Jangan simpan token atau isi file kredensial di repository.

### Secrets yang wajib tersedia

- `APPS_SCRIPT_ID`: Script ID project Apps Script yang benar.
- `CLASPRC_JSON`: kredensial clasp.
- `PRODUCTION_DEPLOYMENT_ID`: ID deployment web app produksi yang sudah ada. Workflow deploy tidak lagi menerima ID bebas dari input.

### Urutan operasi

1. Jalankan `Apps Script Reconcile (read only)` dari branch `main`. Workflow hanya menarik project ke direktori sementara dan membandingkan manifest. Jika berbeda, hentikan proses dan review konfigurasi Apps Script terlebih dahulu.
2. Untuk mengirim source repository ke Apps Script, jalankan `Push Apps Script` dari `main` dengan input konfirmasi `PUSH`. Workflow menarik source online ke direktori sementara, memblokir jika daftar file atau manifest berbeda, lalu menampilkan diff setiap file yang isi source-nya berbeda. Setelah itu workflow menjalankan `clasp push --force`. Tinjau diff pada log Actions dan pastikan perubahan memang dikehendaki; input `PUSH` dan Environment approval tetap wajib. Operasi ini menimpa source online.
3. Setelah push, jalankan `Preflight Apps Script (read only)` dari `main`. Preflight membandingkan daftar file, isi seluruh source, dan manifest repository dengan project online. Deployment harus ditunda jika pemeriksaan gagal.
4. Hanya setelah preflight lulus, jalankan `Deploy Existing Apps Script Deployment` dari `main` dengan input konfirmasi `DEPLOY`. Workflow hanya memperbarui `PRODUCTION_DEPLOYMENT_ID`; tidak membuat deployment baru.

Workflow push dan deploy dibatasi ke branch `main`, memakai clasp versi `3.4.1`, Node.js 22, serta concurrency group yang sama agar operasi tidak saling bertabrakan.

### Proteksi branch main

Aktifkan aturan perlindungan branch/ruleset pada GitHub untuk `main`:

- Wajibkan Pull Request sebelum perubahan masuk.
- Wajibkan status check `structure` dari workflow `Validate PSB PWA`.
- Wajibkan branch terbaru terhadap base sebelum merge (opsional tetapi disarankan).
- Batasi force-push dan penghapusan branch.
- Jangan izinkan bypass tanpa alasan administratif yang terdokumentasi.

Pemeriksaan status saat audit terakhir menunjukkan branch `main` belum protected. Pengaturan ini harus diaktifkan pada **Settings → Rules → Rulesets** atau **Settings → Branches** oleh pemilik/admin repository; perubahan file dalam Pull Request tidak dapat mengaktifkannya sendiri.

## Validation

Workflow `Validate PSB PWA` memeriksa struktur source, syntax JavaScript, JSON, dan kesamaan manifest root dengan manifest Apps Script.

## Catatan PWA

`frontend/` saat ini merupakan hasil ekstraksi kode UI, bukan endpoint API mandiri. Jangan mengaktifkan API publik sebelum desain autentikasi/CORS selesai.

Setelah push dan regresi aman, tahap berikutnya adalah pengujian login/session, upload dokumen, pembayaran, seleksi, chat, notifikasi, dan seluruh role sebelum mempertimbangkan static hosting penuh.
