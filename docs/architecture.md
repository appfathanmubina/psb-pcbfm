# Arsitektur Migrasi

## Tahap 1 — split tanpa perubahan business logic

Browser -> Apps Script HTML Service -> google.script.run -> Code.gs -> Sheets/Drive

GitHub menyimpan source code dan menjadi pusat version control.

## Tahap 2 — CI/CD

GitHub -> GitHub Actions -> clasp -> Google Apps Script deployment

## Tahap 3 — optional static PWA

Static PWA -> authenticated API bridge -> Apps Script

Tahap 3 bukan bagian dari migrasi awal karena `google.script.run` hanya tersedia pada Apps Script HTML Service dan pemindahan ke origin lain memerlukan desain API/authentication.
