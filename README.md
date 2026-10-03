# PSB Fathan Mubina — PWA Migration

Repository ini adalah tahap awal pemisahan frontend dari Google Apps Script.

## Prinsip migrasi

- Business logic Apps Script **tidak diubah** pada tahap ini.
- Frontend asli `Index.html` dipecah menjadi:
  - `frontend/index.html`
  - `frontend/styles.css`
  - `frontend/app.js`
- Transport server diabstraksikan melalui `PSBBridge`.
- Saat dijalankan sebagai Apps Script HTML Service, `google.script.run` tetap menjadi transport yang kompatibel.
- `apps-script/Index.legacy.html` adalah snapshot sumber asli untuk rollback/reference.

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
  SetupDatabase.gs
  Bridge.gs
  Index.legacy.html

docs/
.github/
appsscript.json
```

## Tahap berikutnya

1. Buat deployment Apps Script dari source ini menggunakan `clasp`.
2. Jadikan frontend hasil build sebagai `Index.html` Apps Script agar `google.script.run` tetap berfungsi.
3. Uji login, session, upload dokumen, pembayaran, seleksi, chat, dan seluruh role.
4. Setelah regresi aman, baru tentukan apakah frontend perlu dipindah ke static hosting. Jika iya, desain API bridge + authentication secara terpisah.

> Catatan: `frontend/` saat ini merupakan hasil ekstraksi kode UI, bukan endpoint API mandiri. Jangan mengaktifkan API publik sebelum desain autentikasi/CORS selesai.
