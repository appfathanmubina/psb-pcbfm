# PSB FM — Checklist Pengujian Integrasi dan Kesiapan Produksi

**Repository:** `appfathanmubina/psb-pcbfm`  
**Tujuan:** checklist operasional sebelum perubahan repository disalin ke Apps Script atau dirilis ke pengguna.  
**Status:** template pengujian; belum merupakan bukti bahwa runtime produksi telah diuji.

## 1. Gerbang sebelum uji integrasi

- [ ] PR Batch 2 (#10) ditinjau, konflik diselesaikan, digabung setelah CI hijau.
- [ ] PR Batch 3 (#11) sudah tergabung ke `main`.
- [ ] Semua workflow GitHub Actions pada commit kandidat berstatus sukses.
- [ ] Catat commit SHA kandidat dan tanggal pengujian.
- [ ] Buat salinan Spreadsheet untuk pengujian; pastikan ID salinan yang dipakai.
- [ ] Buat salinan/proyek Apps Script uji dan pastikan terhubung ke Spreadsheet salinan.
- [ ] Pastikan Script Properties uji tidak berisi token/kredensial produksi.
- [ ] Pastikan folder Drive dan trigger uji tidak mengarah ke aset atau proses produksi.

**Larangan:** jangan menjalankan `setupPSBDatabase_`, migrasi, perubahan Script Properties, pemasangan trigger, atau deployment pada proyek/Spreadsheet produksi sebagai bagian checklist ini.

## 2. Kontrak PWA ↔ Apps Script

- [ ] GitHub Actions lulus untuk tes kontrak bridge.
- [ ] Semua nama RPC yang dipanggil PWA tercantum pada `PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS`.
- [ ] Semua nama allowlist memiliki fungsi backend yang tersedia.
- [ ] Uji handshake iframe dan respons `ready` pada deployment uji.
- [ ] Uji origin sah dari GitHub Pages dan pastikan origin asing ditolak.
- [ ] Uji pesan dengan `source` atau `event.source` yang tidak sesuai; pesan harus diabaikan.
- [ ] Uji fungsi yang tidak ada dalam allowlist; backend harus menolak tanpa menjalankan handler.
- [ ] Uji backend error; respons publik tidak boleh membocorkan detail internal.

## 3. Login, sesi, dan hak akses

- [ ] Login berhasil untuk setiap peran uji yang tersedia.
- [ ] Password salah mencapai batas percobaan dan mekanisme lockout berjalan.
- [ ] Sesi valid dapat dipakai; sesi kedaluwarsa/idle ditolak.
- [ ] Logout mencabut sesi dan token lama tidak dapat dipakai kembali.
- [ ] Penggantian/reset password mencabut sesi sesuai kebijakan.
- [ ] Setiap peran hanya dapat membuka menu dan menjalankan aksi yang diizinkan.
- [ ] Uji akses langsung ke endpoint backend tanpa hak peran; harus ditolak di server.
- [ ] Uji kepemilikan Wali: Wali A tidak dapat membaca/mengubah pendaftaran, dokumen, pembayaran, atau chat milik Wali B.

## 4. Registrasi Wali dan Email OTP

- [ ] Email valid menerima OTP pada inbox; periksa juga spam/promosi.
- [ ] OTP benar membuat akun hanya setelah verifikasi berhasil.
- [ ] OTP salah tidak membuat akun.
- [ ] OTP kedaluwarsa setelah 5 menit ditolak.
- [ ] Batas 5 percobaan, cooldown kirim ulang 60 detik, dan batas 5 pengiriman per email per 24 jam bekerja.
- [ ] Email duplikat ditangani tanpa membocorkan keberadaan akun sebelum verifikasi.
- [ ] Kuota MailApp habis/gagal kirim menghasilkan pesan yang aman dan dapat dipahami.
- [ ] Password tidak pernah muncul dalam log, respons, atau data OTP tertunda.

## 5. Pendaftaran, dokumen, pembayaran, dan seleksi

- [ ] Wali dapat membuat pendaftaran dan hanya melihat pendaftaran miliknya.
- [ ] Pengiriman dokumen valid berhasil untuk PDF/JPEG/PNG/WEBP.
- [ ] File dengan ekstensi/MIME yang tidak cocok dengan signature ditolak.
- [ ] File kosong, Base64 rusak, dan file melewati batas ukuran ditolak.
- [ ] Verifikator dapat memproses dokumen sesuai kewenangannya.
- [ ] Pembayaran dan bukti pembayaran mengikuti validasi status serta kepemilikan.
- [ ] Aksi seleksi dan perubahan hasil tercatat dan dibatasi berdasarkan peran.
- [ ] Data laporan dan ekspor sesuai filter serta hak akses.

## 6. PWA, ikon, cache, dan pemulihan koneksi

- [ ] Manifest dapat dibaca browser dan seluruh ikon dapat dimuat.
- [ ] Nama aplikasi, ikon install, favicon, dan Apple touch icon sesuai identitas PSB FM.
- [ ] PWA dapat di-install pada browser/perangkat yang didukung.
- [ ] Navigasi online memuat versi terbaru setelah rilis aset.
- [ ] Service worker menghapus cache versi lama dan tidak menyajikan aset usang setelah pembaruan.
- [ ] Saat offline, shell yang telah tersimpan tetap terbuka dan pesan koneksi jelas.
- [ ] Saat bridge tidak tersedia, aplikasi menampilkan kegagalan yang wajar dan pulih setelah koneksi kembali.
- [ ] Uji Android dan desktop; uji iOS jika digunakan.

## 7. Operasional dan keamanan

- [ ] `PSB_PUBLIC_GALLERY_FILE_IDS` hanya memuat ID gambar yang telah disetujui untuk publik (maksimal 15); uji juga ID file di luar allowlist dan file yang bukan anak langsung folder galeri harus diabaikan.
- [ ] `PSB_PUBLIC_GALLERY_FOLDER_ID` menunjuk folder galeri yang benar; nama file asli tidak tampil pada respons publik.
- [ ] Folder `Dokumen Santri` dan `Bukti Pembayaran` beserta file di dalamnya tidak dapat diakses publik; uji dengan akun/peramban tanpa sesi PSB.
- [ ] Pastikan setiap gambar galeri memiliki persetujuan publik yang sesuai; allowlist bukan pengganti persetujuan.
- [ ] Kuota MailApp, waktu login PBKDF2, dan batas eksekusi Apps Script diukur pada proyek uji.
- [ ] Trigger terjadwal pada proyek uji berjalan sekali dan tidak terduplikasi.
- [ ] Log audit merekam aksi penting tanpa password, OTP, token, atau rahasia.
- [ ] Backup dan prosedur pemulihan telah diuji pada salinan.
- [ ] Tidak ada kredensial atau ID sensitif yang tidak semestinya di-commit.

## 8. Catatan hasil pengujian

| Informasi | Isian |
|---|---|
| Commit SHA kandidat | |
| Proyek Apps Script uji | |
| ID Spreadsheet uji | |
| Tanggal dan penguji | |
| Perangkat/browser | |
| Hasil akhir | Belum diuji |
| Temuan / tautan bukti | |

## 9. Syarat persetujuan rilis

Rilis hanya dapat dipertimbangkan jika seluruh pengujian wajib lulus, temuan kritis/tinggi ditutup atau memiliki keputusan risiko tertulis, backup dapat dipulihkan, dan pemilik aplikasi menyetujui sinkronisasi source serta deployment. Checklist ini tidak melakukan deployment dan tidak menggantikan uji runtime atau penetration test.
