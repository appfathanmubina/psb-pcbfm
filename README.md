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
  BridgeServer.gs
  Bridge.html
  .clasp.example.json

docs/
.github/
appsscript.json
```

### Catatan nama file Apps Script

Apps Script tidak mengizinkan file `.gs` dan `.html` memiliki nama dasar yang sama dalam satu project. Karena itu helper server yang sebelumnya bernama `Bridge.gs` disimpan sebagai `BridgeServer.gs`, sedangkan halaman komunikasi tetap bernama `Bridge.html`. Fungsi `doGet()` di `Code.gs` memanggil file HTML dengan nama `Bridge`; nama tersebut tidak perlu diubah.

## Sinkronisasi source Apps Script secara manual

Repository ini menyimpan salinan source backend Apps Script pada folder `apps-script/`, sedangkan project Google Apps Script tetap menjadi backend produksi yang berjalan. Perubahan di GitHub **tidak otomatis** mengubah source maupun deployment Apps Script.

Untuk memastikan source di kedua tempat sama, gunakan prosedur manual berikut:

1. Buka project Apps Script produksi dan salin isi file dari editor Apps Script ke file yang sesuai di repository:
   - `Bridge.html` → `apps-script/Bridge.html`
   - `BridgeServer.gs` → `apps-script/BridgeServer.gs`
   - `Code.gs` → `apps-script/Code.gs`
2. Periksa juga file backend lain, terutama `Index.html`, `SetupDatabase.gs`, dan `appsscript.json`. Jangan menghapus atau mengganti file project lain hanya karena tidak termasuk tiga file utama.
3. Commit perubahan ke branch kerja, tinjau diff, lalu gabungkan ke `main` setelah disetujui.
4. Audit source di repository. Jika ada perbaikan, lakukan dan tinjau perubahan di GitHub terlebih dahulu.
5. Setelah source repository disetujui, salin perubahan yang diperlukan kembali ke project Apps Script. Pastikan file lain tetap dipertahankan.
6. Perbarui deployment Web App yang sudah ada melalui Apps Script, bukan membuat deployment baru tanpa kebutuhan. Pertahankan URL produksi agar frontend PWA tetap terhubung.
7. Uji PWA dan backend setelah deployment.

### Batasan dan keamanan

- Repository tetap **Public** sesuai keputusan pengelola. Jangan pernah menyimpan password, hash/salt password, token, private key, atau kredensial layanan di source.
- Fungsi pengisian dan penghapusan data dummy (`seedPSBTestData` dan `clearPSBTestData`) telah dihapus dari source produksi.
- Kredensial bootstrap Superadmin tidak lagi ditanam di source. Untuk instalasi baru, editor Apps Script tepercaya harus menjalankan `configureInitialSuperadmin(username, nama, password)` dari editor Apps Script. Gunakan password kuat minimal 12 karakter. Fungsi ini menyimpan hash dan salt ke Script Properties, bukan mengembalikannya ke browser. Setelah akun dibuat oleh `setupPSBDatabase()`, properti bootstrap dihapus.
- Jika akun Superadmin sudah ada, fungsi bootstrap tidak menimpa password atau akun yang ada.
- `ensureSheet_()` tidak lagi menimpa header sheet yang berbeda. Proses setup berhenti dengan pesan kesalahan agar struktur dan data dapat diperiksa manual.
- Error internal dari handler Bridge dicatat di execution log dan pesan yang dikirim ke pemanggil publik dibuat umum.
- Tidak ada workflow rekonsiliasi otomatis, OIDC, clasp, atau kredensial Google yang diperlukan untuk prosedur sinkronisasi manual ini.
- GitHub Pages hanya menerbitkan frontend PWA; ia tidak menjalankan backend Apps Script.
- GitHub menjadi tempat pengelolaan source dan salinan backend; Google Apps Script tetap menjadi backend produksi.
- Perubahan pada repository tidak boleh dianggap sudah diterapkan ke backend sebelum disalin dan disimpan di Apps Script.
- Jangan menaruh password, token, kredensial, atau data rahasia ke repository.

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
