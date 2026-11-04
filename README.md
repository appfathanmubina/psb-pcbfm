# PSB Fathan Mubina — PWA Migration

Repository ini adalah tahap awal pemisahan frontend dari Google Apps Script.

## Arsitektur dan prinsip kerja

- Google Apps Script tetap menjadi backend produksi yang mengelola autentikasi, session, role, business logic, Google Sheets, dan Google Drive.
- Repository menyimpan frontend PWA serta salinan source backend pada folder `apps-script/`.
- `apps-script/Index.html` tetap menjadi entry point HTML Service untuk akses langsung melalui Apps Script.
- `apps-script/Index.legacy.html` adalah snapshot UI lama untuk referensi/rollback, bukan file yang disalin ke deployment.
- Frontend PWA statis berada di `frontend/` dan diterbitkan melalui GitHub Pages.
- PWA berkomunikasi dengan Apps Script melalui `frontend/api-bridge.js`, `Bridge.html`, dan `google.script.run` di sisi Bridge.
- GitHub Actions memvalidasi source dan menerbitkan frontend GitHub Pages saja. Sinkronisasi source dan deployment Apps Script dilakukan manual.
- Perubahan backend yang baru ada di GitHub belum dianggap aktif di Apps Script sampai disalin, disimpan, dan deployment Web App diperbarui.

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
- Kredensial bootstrap Superadmin tidak lagi ditanam di source. Untuk instalasi baru, editor Apps Script tepercaya harus menjalankan `configureInitialSuperadmin_()` dari editor Apps Script. Fungsi akan meminta username, nama, dan password melalui dialog spreadsheet. Gunakan password kuat minimal 12 karakter dan pastikan layar tidak terlihat orang lain. Fungsi ini menyimpan hash dan salt ke Script Properties, bukan ke source repository atau browser. Setelah akun dibuat oleh `setupPSBDatabase_()`, properti bootstrap dihapus.
- Jika akun Superadmin sudah ada, fungsi bootstrap tidak menimpa password atau akun yang ada.
- Hash password baru menggunakan PBKDF2-HMAC-SHA256 dengan salt acak dan 60.000 iterasi. Akun lama tetap dapat login dengan password yang sama; setelah login lama berhasil, hash akun tersebut otomatis dimigrasikan. Password tidak direset dan data/role pengguna tidak diubah.
- Pendaftaran akun, perubahan password, reset administrator, dan bootstrap Superadmin menggunakan format hash baru. Format hash menyimpan nama skema dan jumlah iterasi agar dapat ditingkatkan pada migrasi berikutnya.
- Fungsi pemeliharaan internal (`cleanupPSBSessions_`, `removeLegacyChatAutomationTriggers_`) dan fungsi setup/bootstrap (`setupPSBDatabase_`, `configureInitialSuperadmin_`, `createInitialSuperadmin_`) memakai akhiran garis bawah. Fungsi publik `cleanupLegacyChatAutomationTriggers()` adalah wrapper terbatas untuk menjalankan pembersihan trigger chat lama secara manual; fungsi ini tidak termasuk allowlist bridge.
- Fitur Chat Wali ↔ Admin PSB telah dihentikan dan dihapus dari UI, API, serta otomasi. Data historis pada sheet chat lama tidak dihapus otomatis.
- `ensureSheet_()` tidak lagi menimpa header sheet yang berbeda. Proses setup berhenti dengan pesan kesalahan agar struktur dan data dapat diperiksa manual.
- Error internal dari handler Bridge dicatat di execution log dan pesan yang dikirim ke pemanggil publik dibuat umum.
- Pendaftaran Wali dilakukan langsung tanpa OTP atau verifikasi email. Email dan nomor HP bersifat opsional, tetapi minimal salah satunya wajib diisi sebagai identitas login. Akun dibuat aktif dan pengguna langsung memperoleh sesi setelah validasi berhasil.
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

## Pembersihan trigger chat lama

Setelah source `SetupDatabase.gs` terbaru disalin ke Apps Script, jalankan `cleanupLegacyChatAutomationTriggers()` satu kali dari editor Apps Script bila ingin menghapus trigger lama `runChatAutomation` atau `runChatAutomation_`. Fungsi ini hanya menghapus trigger dengan dua nama handler tersebut dan properti `PSB_CHAT_AUTOMATION_TRIGGER`. Fungsi `setupPSBDatabase_()` tidak lagi menjalankan pembersihan ini sebagai efek samping. Jangan jalankan setup database hanya untuk membersihkan trigger; sheet dan data lama tidak perlu dihapus.

## Validation

Workflow `Validate PSB PWA` memeriksa struktur source frontend, syntax JavaScript, JSON, dan kesamaan manifest root dengan manifest Apps Script. Workflow ini tidak menguji runtime Google Apps Script atau melakukan deployment backend.

## Catatan PWA

`frontend/` saat ini merupakan hasil ekstraksi kode UI, bukan endpoint API mandiri. Jangan mengaktifkan API publik sebelum desain autentikasi/CORS selesai.

Setelah push dan regresi aman, tahap berikutnya adalah pengujian login/session, upload dokumen, pembayaran, seleksi, notifikasi, dan seluruh role sebelum mempertimbangkan static hosting penuh.

## Security Audit

Lihat [docs/security-audit.md](docs/security-audit.md) untuk cakupan audit, perubahan hardening, dan risiko yang masih perlu ditangani.
