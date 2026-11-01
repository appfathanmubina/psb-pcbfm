# Arsitektur PSB Fathan Mubina

## Komponen produksi

- GitHub repository menyimpan source frontend PWA dan salinan source backend Apps Script.
- GitHub Pages menerbitkan frontend PWA statis.
- Google Apps Script tetap menjadi backend produksi dan mengakses Google Sheets serta Google Drive.
- Frontend PWA berkomunikasi dengan Apps Script melalui API Bridge yang memvalidasi origin, sumber pesan, dan daftar fungsi yang diizinkan.

## Sinkronisasi source secara manual

1. Source aktual dari Apps Script disalin ke folder `apps-script/` di GitHub untuk pemeriksaan kesamaan.
2. Perbaikan source dilakukan dan ditinjau di repository.
3. Source yang telah disetujui disalin kembali ke project Apps Script secara manual.
4. Deployment Web App Apps Script diperbarui secara manual setelah pengujian dan persetujuan.

GitHub Actions hanya memvalidasi source frontend/struktur dan menerbitkan GitHub Pages. Workflow tidak mengunggah source ke Apps Script, tidak mengubah deployment Apps Script, dan tidak memerlukan clasp atau kredensial Google.

## Batas kepercayaan

- Repository bersifat Public sesuai keputusan pemilik. Source tidak boleh memuat password, hash/salt password, token, private key, atau kredensial layanan.
- Apps Script mengelola autentikasi, session, role, validasi data, dan akses Sheets/Drive.
- Fungsi backend yang dapat dipanggil melalui Bridge harus terdaftar secara eksplisit dalam allowlist.
- Fungsi administrasi setup yang tidak diperlukan oleh PWA tidak boleh dimasukkan ke allowlist Bridge.
- Data publik yang dikirim oleh endpoint publik harus dibatasi pada konten yang memang boleh diakses tanpa login.
