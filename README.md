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

## Clasp / Apps Script safety

Urutan operasi production yang diwajibkan:

1. **Reconcile manifest** — jalankan workflow `Apps Script Reconcile`.
   Workflow mengambil `appsscript.json` dari project Apps Script yang ditunjuk `APPS_SCRIPT_ID` ke direktori temporary dan membandingkannya dengan manifest repository.
2. Jika manifest berbeda, **jangan push**. Review konfigurasi online terlebih dahulu; repository saat ini tidak boleh dianggap sebagai sumber konfigurasi OAuth/dependency tanpa verifikasi.
3. Setelah manifest cocok, jalankan workflow `Push Apps Script` dengan input `PUSH`.
   Workflow ini hanya menjalankan `clasp push --force`; **tidak membuat deployment baru**.
4. Untuk deployment web app, gunakan workflow `Deploy Existing Apps Script Deployment` dan isi **deployment ID yang sudah ada**. Input konfirmasi `DEPLOY` wajib.
5. Workflow deployment tidak menyediakan jalur fallback untuk membuat deployment baru.

### Required GitHub Actions secrets

- `APPS_SCRIPT_ID`
- `CLASPRC_JSON`

`APPS_SCRIPT_ID` untuk project saat ini sudah didokumentasikan di `apps-script/.clasp.example.json`.

## Validation

Workflow `Validate PSB PWA` memeriksa struktur source. Workflow push juga melakukan pemeriksaan keberadaan source Apps Script dan syntax check untuk `frontend/app.js`.

## Catatan PWA

`frontend/` saat ini merupakan hasil ekstraksi kode UI, bukan endpoint API mandiri. Jangan mengaktifkan API publik sebelum desain autentikasi/CORS selesai.

Setelah push dan regresi aman, tahap berikutnya adalah pengujian login/session, upload dokumen, pembayaran, seleksi, chat, notifikasi, dan seluruh role sebelum mempertimbangkan static hosting penuh.
