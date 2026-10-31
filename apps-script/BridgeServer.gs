/**
 * PSB Bridge boundary.
 *
 * Tahap 1:
 * - Tidak mengubah business logic existing.
 * - google.script.run tetap menjadi transport utama saat aplikasi dijalankan
 *   sebagai Apps Script HTML Service.
 *
 * Tahap 2:
 * - Jika frontend dipindahkan ke static hosting, fungsi-fungsi di sini dapat
 *   diekspos melalui API yang diautentikasi. Jangan menambahkan endpoint publik
 *   tanpa desain auth/CORS yang sesuai.
 */
function psbBridgeHealth() {
  return { success: true, app: 'PSB Fathan Mubina', transport: 'google.script.run' };
}
