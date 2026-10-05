/**
 * PSB FATHAN MUBINA
 * Code.gs
 * STAGE 19 - END-TO-END QA & BUG HARDENING
 * Based on Stage 18 - Professional UI Refinement
 *
 * QA hardening: draft validation allows optional fields; submit enforces strict required fields;
 * registration edit role is aligned with PSB_REGISTRATION_EDIT_ROLES.
 *
 * Fokus: login No. HP / Email, password hash, session, logout,
 * change password, authorization, brute-force protection, audit.
 */

const PSB_AUTH = {
  SESSION_TTL_MINUTES: 480,
  SESSION_IDLE_MINUTES: 30,
  MAX_ATTEMPTS: 5,
  LOCK_MINUTES: 10
};

const PSB_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN','WALI'];
const PSB_AUDIT_ACCESS_ROLES = ['SUPERADMIN','ADMIN_PSB'];
const PSB_SECURITY_ADMIN_ROLES = ['SUPERADMIN'];
const PSB_PRODUCTION_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB'];
const PSB_PRODUCTION_VERSION = '30.14';
const PSB_COMMUNICATION_ROLES = ['SUPERADMIN','ADMIN_PSB'];
const PSB_COMMUNICATION_RECIPIENT_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'];
const PSB_CHAT_ACCESS_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB'];
const PSB_CHAT_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB'];

function doGet(e) {
  const bridgeMode = e && e.parameter && String(e.parameter.bridge || '') === '1';
  if (bridgeMode) {
    return HtmlService.createTemplateFromFile('Bridge').evaluate()
      .setTitle('PSB Fathan Mubina — API Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const output = HtmlService.createTemplateFromFile('Index').evaluate();

  // PENTING untuk Apps Script HTML Service:
  // meta viewport yang ditulis langsung di Index.html dapat diabaikan oleh
  // sandbox HTML Service. Google mendokumentasikan bahwa viewport harus
  // ditambahkan melalui HtmlOutput.addMetaTag(). Tanpa ini, Android dapat
  // memberi iframe viewport desktop-width sehingga UI terlihat seperti
  // halaman desktop yang diperkecil.
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');

  return output
    .setTitle('PSB Fathan Mubina')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  return {
    success: true,
    appName: 'PSB Fathan Mubina',
    activeYear: getConfig_('ACTIVE_YEAR') || '2027/2028',
    spreadsheetIdConfigured: !!(props.getProperty('PSB_SPREADSHEET_ID') || ss.getId()),
    foundationReady: !!ss.getSheetByName('USERS'),
    authReady: !!ss.getSheetByName('SESSIONS') && !!ss.getSheetByName('AUDIT_LOG')
  };
}


function getPublicGallery(forceRefresh){
  const cache=CacheService.getScriptCache();
  const cacheKey='PSB_PUBLIC_GALLERY_V1';
  if(!forceRefresh){
    const cached=cache.get(cacheKey);
    if(cached){try{return JSON.parse(cached)}catch(e){}}
  }
  const folderId='19rRtc_Lw8NPyoskV3Nkf5EB066MGOG63';
  try{
    const folder=DriveApp.getFolderById(folderId);
    const it=folder.getFiles();
    const items=[];
    while(it.hasNext()){
      const file=it.next();
      const mime=String(file.getMimeType()||'').toLowerCase();
      if(mime.indexOf('image/')!==0) continue;
      items.push({
        id:String(file.getId()),
        name:String(file.getName()||'Foto Fathan Mubina'),
        url:'https://drive.google.com/thumbnail?id='+encodeURIComponent(file.getId())+'&sz=w1200'
      });
      if(items.length>=15) break;
    }
    items.sort((a,b)=>a.name.localeCompare(b.name,'id',{numeric:true,sensitivity:'base'}));
    const result={success:true,items};
    try{cache.put(cacheKey,JSON.stringify(result),300)}catch(e){}
    return result;
  }catch(e){
    console.error(e);
    return {success:false,items:[],message:'Galeri belum dapat dimuat.'};
  }
}

function getPublicConfig(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PSB_PUBLIC_CONFIG_V6';
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  if (!sheet || sheet.getLastRow() < 2) return { success: true, config: {} };
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const config = {};
  // Hanya konfigurasi yang memang dibutuhkan browser yang boleh keluar dari server.
  // Konfigurasi internal (session, security, automation, retention, dll.) tetap server-side.
  const PUBLIC_CONFIG_KEYS = new Set([
    'APP_NAME','APP_VERSION','RELEASE_STAGE','ACTIVE_YEAR','ACTIVE_YEAR_ID',
    'MAINTENANCE_MODE','APP_ICON_URL','APP_LOGO_URL'
  ]);
  values.forEach(r => { if (r[0] && PUBLIC_CONFIG_KEYS.has(String(r[0]))) config[String(r[0])] = r[1]; });

  // Jangan resolve Drive asset menjadi Data URL di jalur boot.
  // Frontend memakai APP_ICON_URL / APP_LOGO_URL dari CONFIG secara langsung
  // (dinormalisasi menjadi thumbnail Drive), sehingga URL Database selalu menjadi
  // sumber utama dan perubahan brand tidak tertahan oleh asset Data URL lama.
  config.APP_VERSION = config.APP_VERSION || PSB_PRODUCTION_VERSION;
  config.RELEASE_STAGE = config.RELEASE_STAGE || 'PRODUCTION';
  const result = { success: true, config: config };
  try { cache.put(cacheKey, JSON.stringify(result), 60); } catch (e) {}
  return result;
}

function resolveBrandAssetDataUrl_(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw) && raw.length <= 100000) return raw;

  // Google Drive file ID from common sharing/view/download/thumbnail URL formats.
  let m = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([A-Za-z0-9_-]{10,})/i);
  if (!m) m = raw.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (m) {
    try {
      const file = DriveApp.getFileById(m[1]);
      // Ambil file asli terlebih dahulu. Thumbnail Drive kadang tidak tersedia
      // atau berukuran/format yang berbeda sehingga dapat membuat logo jatuh ke fallback FM.
      let blob = null;
      try { blob = file.getBlob(); } catch (e) {}
      if (!blob) { try { blob = file.getThumbnail(); } catch (e) {} }
      const mime = (blob && blob.getContentType()) || file.getMimeType() || '';
      const bytes = blob ? blob.getBytes() : [];
      // Naikkan batas asset agar logo yang sedikit lebih besar tetap bisa
      // di-embed. CacheService tidak wajib berhasil; bila payload terlalu besar
      // hasil tetap dikirim ke frontend pada request aktif.
      if (/^image\//i.test(mime) && bytes.length <= 180000) {
        return 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes);
      }
    } catch (e) {
      // Fall through to an HTTPS fetch / original URL fallback.
    }
  }

  // Also support a normal HTTPS image URL stored in CONFIG. This is only
  // executed for administrator-configured brand assets and is deliberately
  // size-limited. If it cannot be embedded safely, the original URL remains
  // available to the frontend.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const resp = UrlFetchApp.fetch(raw, {muteHttpExceptions:true, followRedirects:true});
      const code = resp.getResponseCode();
      const headers = resp.getHeaders() || {};
      const mime = String(headers['Content-Type'] || headers['content-type'] || '').split(';')[0].trim();
      const blob = resp.getBlob();
      const bytes = blob.getBytes();
      if (code >= 200 && code < 300 && (/^image\//i.test(mime) || /^image\//i.test(blob.getContentType() || '')) && bytes.length <= 180000) {
        const finalMime = mime || blob.getContentType() || 'image/png';
        return 'data:' + finalMime + ';base64,' + Utilities.base64Encode(bytes);
      }
    } catch (e) {}
  }
  return '';
}

// =====================================================
// AUTHENTICATION
// =====================================================

function login(identifier, password) {
  try {
    identifier = String(identifier || '').trim();
    password = String(password || '');
    if (!identifier || !password) return fail_('No. HP/email dan password wajib diisi.');

    const key = normalizeIdentifier_(identifier);
    const lock = getLoginLock_(key);
    if (lock.locked) return fail_('Terlalu banyak percobaan. Silakan coba lagi dalam ' + lock.remainingMinutes + ' menit.');

    const user = findUser_(key);
    if (!user || String(user.status).toUpperCase() !== 'ACTIVE') {
      registerLoginFailure_(key);
      return fail_('Login gagal. Periksa No. HP/email dan password.');
    }

    const hash = hashPassword_(password, user.passwordSalt);
    if (!constantTimeEqual_(hash, user.passwordHash)) {
      registerLoginFailure_(key);
      return fail_('Login gagal. Periksa No. HP/email dan password.');
    }

    clearLoginFailure_(key);
    // Hanya operasi yang wajib untuk menyelesaikan login dilakukan sebelum response.
    // LastLogin dan audit dipindahkan ke best-effort call setelah UI sudah tampil.
    const session = createSession_(user.userId);

    return {
      success: true,
      sessionToken: session.token,
      user: publicUser_(user),
      mustChangePassword: user.mustChangePassword === true || String(user.mustChangePassword).toUpperCase() === 'TRUE'
    };
  } catch (e) {
    console.error(e);
    return fail_('Terjadi kesalahan saat login. Silakan coba lagi.');
  }
}

function finalizeLogin(sessionToken) {
  const result = getSessionUser_(sessionToken, false);
  if (!result.success) return result;
  try { updateLastLogin_(result.user.rowNumber); } catch (e) { console.error(e); }
  try { writeAudit_(result.user.userId, 'LOGIN', 'AUTH', result.user.userId, '', '', 'Login berhasil'); } catch (e) { console.error(e); }
  return { success: true };
}

function registerWali(payload) {
  payload = payload || {};
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');

  if (!name) return fail_('Nama lengkap wajib diisi.');
  if (!phone && !email) return fail_('No. HP atau Email wajib diisi minimal salah satu.');
  if (phone && normalizePhone_(phone).length < 10) return fail_('No. HP tidak valid.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_('Format email tidak valid.');
  if (password.length < 6) return fail_('Password minimal 6 karakter.');
  if (password !== confirmPassword) return fail_('Konfirmasi password tidak sama.');

  const phoneNormalized = phone ? normalizePhone_(phone) : '';
  const emailNormalized = email ? email.toLowerCase() : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
    if (!sheet) return fail_('Database USERS belum tersedia. Jalankan setupPSBDatabase() terlebih dahulu.');
    const lastRow = sheet.getLastRow();
    const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 15).getValues() : [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (phoneNormalized && String(r[3] || '') === phoneNormalized) return fail_('No. HP sudah terdaftar. Silakan masuk menggunakan No. HP tersebut.');
      if (emailNormalized && String(r[5] || '').toLowerCase() === emailNormalized) return fail_('Email sudah terdaftar. Silakan masuk menggunakan email tersebut.');
    }

    const now = new Date();
    const userId = generateId_('USR');
    const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
    const hash = hashPassword_(password, salt);
    const row = [
      userId, name, phone, phoneNormalized, email, emailNormalized,
      hash, salt, 'WALI', 'ACTIVE', '', '', now, now, false
    ];
    sheet.appendRow(row);
    writeAudit_(userId, 'REGISTER', 'AUTH', userId, '', JSON.stringify({name:name, phone:phoneNormalized, email:emailNormalized, role:'WALI'}), 'Akun WALI baru dibuat tanpa OTP');

    const session = createSession_(userId);
    const user = findUserById_(userId);
    return {
      success: true,
      message: 'Akun WALI berhasil dibuat.',
      sessionToken: session.token,
      user: publicUser_(user),
      mustChangePassword: false
    };
  } finally {
    lock.releaseLock();
  }
}

function getInitialAppData(sessionToken) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  const user = result.user;
  const roles = String(user.role || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
  const data = {
    success: true,
    ready: true,
    appName: getConfig_('APP_NAME') || 'PSB Fathan Mubina',
    activeYear: getConfig_('ACTIVE_YEAR') || '2027/2028',
    roles: roles
  };
  // Lightweight preload only: do not fetch documents/files/payments here.
  if (roles.indexOf('WALI') >= 0) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
    if (sheet && sheet.getLastRow() >= 2) {
      const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
      data.registrationCount = rows.filter(r => String(r[headers.indexOf('userId')] || '') === String(user.userId)).length;
    } else data.registrationCount = 0;
  }
  return data;
}

function validateSession(sessionToken) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  return { success: true, user: publicUser_(result.user), expiresAt: result.expiresAt, mustChangePassword: result.user.mustChangePassword === true || String(result.user.mustChangePassword).toUpperCase() === 'TRUE' };
}

function logout(sessionToken) {
  const result = getSessionUser_(sessionToken, false);
  if (!result.success) return { success: true };
  invalidateSession_(result.sessionRow, 'LOGOUT');
  writeAudit_(result.user.userId, 'LOGOUT', 'AUTH', result.user.userId, '', '', 'Logout berhasil');
  return { success: true };
}

function changePassword(sessionToken, currentPassword, newPassword) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  if (String(newPassword || '').length < 6) return fail_('Password baru minimal 6 karakter.');
  if (String(newPassword) === String(currentPassword || '')) return fail_('Password baru harus berbeda dari password lama.');

  const oldHash = hashPassword_(String(currentPassword || ''), result.user.passwordSalt);
  if (!constantTimeEqual_(oldHash, result.user.passwordHash)) return fail_('Password lama tidak sesuai.');

  const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
  const hash = hashPassword_(String(newPassword), salt);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  sheet.getRange(result.user.rowNumber, 7, 1, 3).setValues([[hash, salt, result.user.role]]);
  sheet.getRange(result.user.rowNumber, 14, 1, 2).setValues([[new Date(), false]]);
  revokeOtherSessionsForUser_(result.user.userId, String(result.sessionRow.rowNumber));
  try { CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(String(result.user.phoneNormalized || '').toLowerCase()).substring(0, 32)); } catch (e) {}
  if (result.user.emailNormalized) { try { CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(String(result.user.emailNormalized || '').toLowerCase()).substring(0, 32)); } catch (e) {} }
  writeAudit_(result.user.userId, 'CHANGE_PASSWORD', 'AUTH', result.user.userId, '', '', 'Password berhasil diubah');
  return { success: true, message: 'Password berhasil diubah.' };
}

// =====================================================
// AUTHORIZATION HELPERS
// =====================================================

function getCurrentUser(sessionToken) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  return { success: true, user: publicUser_(result.user) };
}

function hasRole(sessionToken, allowedRoles) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRoles = String(result.user.role || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
  return { success: true, authorized: roles.some(r => userRoles.indexOf(String(r).toUpperCase()) >= 0) };
}

function requireRole_(sessionToken, allowedRoles) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) throw new Error(result.message || 'Session tidak valid.');
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRoles = String(result.user.role || '').split(',').map(r => r.trim().toUpperCase());
  if (!roles.some(r => userRoles.indexOf(String(r).toUpperCase()) >= 0)) throw new Error('Anda tidak memiliki hak akses untuk tindakan ini.');
  return result.user;
}

function assertRegistrationOpenForNew_() {
  const open = String(getConfig_('REGISTRATION_OPEN') || '').toUpperCase() === 'TRUE';
  if (!open) throw new Error('Pendaftaran sedang ditutup. Draft pendaftaran baru tidak dapat dibuat.');
  const start = String(getConfig_('REGISTRATION_START') || '').trim();
  const end = String(getConfig_('REGISTRATION_END') || '').trim();
  const now = new Date();
  if (start) { const d=new Date(start+'T00:00:00'); if (!isNaN(d.getTime()) && now < d) throw new Error('Pendaftaran belum memasuki tanggal pembukaan.'); }
  if (end) { const d=new Date(end+'T23:59:59'); if (!isNaN(d.getTime()) && now > d) throw new Error('Periode pendaftaran telah berakhir.'); }
  return true;
}

function assertOperationalMutation_(actor) {
  if (!actor) throw new Error('Session tidak valid.');
  const maintenance = String(getConfig_('MAINTENANCE_MODE') || '').toUpperCase() === 'TRUE';
  if (!maintenance) return true;
  if (hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB'])) return true;
  throw new Error('Sistem sedang dalam mode pemeliharaan. Tindakan perubahan data sementara dinonaktifkan.');
}

function productionConfigObject_() {
  const keys = ['APP_NAME','APP_VERSION','RELEASE_STAGE','ACTIVE_YEAR','ACTIVE_YEAR_ID','REGISTRATION_OPEN','REGISTRATION_START','REGISTRATION_END','MAINTENANCE_MODE','TIMEZONE'];
  const out = {};
  keys.forEach(k => out[k] = getConfig_(k));
  if (!out.APP_VERSION) out.APP_VERSION = PSB_PRODUCTION_VERSION;
  if (!out.RELEASE_STAGE) out.RELEASE_STAGE = 'PRODUCTION';
  return out;
}

function getProductionControlData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_PRODUCTION_ADMIN_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const activeSuperadmins = users.filter(u => String(u.status||'').toUpperCase()==='ACTIVE' && String(u.role||'').toUpperCase().split(',').map(x=>x.trim()).indexOf('SUPERADMIN')>=0);
  const mustChange = activeSuperadmins.filter(u => String(u.mustChangePassword||'').toUpperCase()==='TRUE' || u.mustChangePassword===true).length;
  return {success:true, config:productionConfigObject_(), activeSuperadmins:activeSuperadmins.length, superadminsNeedingPasswordChange:mustChange, actorRole:actor.role, generatedAt:new Date().toISOString()};
}

function setProductionControl(sessionToken, payload) {
  const actor = requireRole_(sessionToken, ['SUPERADMIN']);
  payload = payload || {};
  const changes = {};
  const allowed = ['APP_VERSION','RELEASE_STAGE','REGISTRATION_OPEN','REGISTRATION_START','REGISTRATION_END','MAINTENANCE_MODE'];
  allowed.forEach(k => { if (Object.prototype.hasOwnProperty.call(payload,k)) changes[k] = payload[k]; });
  if (changes.RELEASE_STAGE) changes.RELEASE_STAGE = String(changes.RELEASE_STAGE).trim().toUpperCase();
  if (changes.APP_VERSION) changes.APP_VERSION = String(changes.APP_VERSION).trim();
  if (changes.APP_VERSION && !/^\d+\.\d+(?:\.\d+)?(?:[-._A-Za-z0-9]+)?$/.test(changes.APP_VERSION)) return fail_('Format APP_VERSION tidak valid.');
  ['REGISTRATION_OPEN','MAINTENANCE_MODE'].forEach(k => { if (Object.prototype.hasOwnProperty.call(changes,k)) changes[k] = (changes[k]===true || String(changes[k]).toUpperCase()==='TRUE') ? 'TRUE' : 'FALSE'; });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.CONFIG);
  if (!sheet) return fail_('Sheet CONFIG belum tersedia.');
  const old = productionConfigObject_();
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const keyIdx=headers.indexOf('key'), valueIdx=headers.indexOf('value'), updatedIdx=headers.indexOf('updatedAt');
  if (keyIdx<0 || valueIdx<0) return fail_('Struktur CONFIG tidak sesuai.');
  const rows=sheet.getLastRow()>=2?sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues():[];
  const index={}; rows.forEach((r,i)=>index[String(r[keyIdx]||'')]=i+2);
  Object.keys(changes).forEach(k=>{
    const row=index[k];
    if (!row) { const values=new Array(headers.length).fill(''); values[keyIdx]=k; values[valueIdx]=changes[k]; if(updatedIdx>=0) values[updatedIdx]=new Date(); sheet.appendRow(values); }
    else { sheet.getRange(row,valueIdx+1).setValue(changes[k]); if(updatedIdx>=0) sheet.getRange(row,updatedIdx+1).setValue(new Date()); }
    try { CacheService.getScriptCache().remove('PSB_CFG_'+sha256Hex_(k).substring(0,24)); } catch(e){}
  });
  try { CacheService.getScriptCache().remove('PSB_PUBLIC_CONFIG_V5'); CacheService.getScriptCache().remove('PSB_PUBLIC_CONFIG_V4'); } catch(e){}
  writeAudit_(actor.userId,'PRODUCTION_CONFIG_UPDATE','SYSTEM','',JSON.stringify(old),JSON.stringify(productionConfigObject_()),'Konfigurasi produksi diubah oleh SUPERADMIN');
  return {success:true,message:'Kontrol produksi berhasil diperbarui.',config:productionConfigObject_()};
}

function getDataIntegrityReport(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_PRODUCTION_ADMIN_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checks=[];
  const add=(key,label,status,detail,category)=>checks.push({key,label,status,detail,category});
  const rowsBy=name=>sheetRows_(ss.getSheetByName(name));
  const exists=name=>!!ss.getSheetByName(name);
  const refs=[
    ['REGISTRATIONS','userId','USERS','userId'],['REGISTRATIONS','candidateId','CANDIDATES','candidateId'],['REGISTRATIONS','tahunAjaranId','MASTER_TAHUN_AJARAN','tahunAjaranId'],['REGISTRATIONS','gelombangId','MASTER_GELOMBANG','gelombangId'],['REGISTRATIONS','jenjangId','MASTER_JENJANG','jenjangId'],
    ['GUARDIANS','userId','USERS','userId'],['GUARDIANS','candidateId','CANDIDATES','candidateId'],['ADDRESSES','candidateId','CANDIDATES','candidateId'],['SCHOOLS','candidateId','CANDIDATES','candidateId'],
    ['DOCUMENTS','registrationId','REGISTRATIONS','registrationId'],['DOCUMENTS','documentTypeId','MASTER_DOKUMEN','documentTypeId'],['BILLS','registrationId','REGISTRATIONS','registrationId'],['BILLS','paymentTypeId','MASTER_JENIS_PEMBAYARAN','paymentTypeId'],['PAYMENTS','billId','BILLS','billId'],['PAYMENTS','registrationId','REGISTRATIONS','registrationId'],['PAYMENT_VERIFICATIONS','paymentId','PAYMENTS','paymentId'],
    ['SELECTION_SCHEDULE','tahunAjaranId','MASTER_TAHUN_AJARAN','tahunAjaranId'],['SELECTION_PARTICIPANTS','registrationId','REGISTRATIONS','registrationId'],['SELECTION_PARTICIPANTS','scheduleId','SELECTION_SCHEDULE','scheduleId'],['SELECTION_SCORES','participantId','SELECTION_PARTICIPANTS','participantId'],['SELECTION_RESULTS','registrationId','REGISTRATIONS','registrationId'],['REREGISTRATIONS','registrationId','REGISTRATIONS','registrationId']
  ];
  const cache={};
  const getSet=(sheet,field)=>{const k=sheet+'|'+field;if(cache[k])return cache[k]; const set={}; rowsBy(sheet).forEach(r=>{const v=String(r[field]||'').trim();if(v)set[v]=true;}); return cache[k]=set;};
  let orphan=0;
  refs.forEach(([sheet,field,target,targetField])=>{
    if(!exists(sheet)||!exists(target)){ add('ref_'+sheet+'_'+field, sheet+'.'+field+' → '+target+'.'+targetField,'WARNING','Sheet referensi belum tersedia; pemeriksaan dilewati.','References'); return; }
    const targetSet=getSet(target,targetField); const bad=rowsBy(sheet).filter(r=>{const v=String(r[field]||'').trim();return v && !targetSet[v];});
    orphan+=bad.length; add('ref_'+sheet+'_'+field, sheet+'.'+field+' → '+target+'.'+targetField,bad.length?'ERROR':'OK',bad.length?bad.length+' baris memiliki referensi yang tidak ditemukan.':'Semua referensi valid.','References');
  });
  const duplicateSpecs=[['USERS','userId'],['REGISTRATIONS','registrationId'],['CANDIDATES','candidateId'],['DOCUMENTS','documentId'],['BILLS','billId'],['PAYMENTS','paymentId']];
  let dup=0;
  duplicateSpecs.forEach(([sheet,field])=>{const seen={};rowsBy(sheet).forEach(r=>{const v=String(r[field]||'').trim();if(v)seen[v]=(seen[v]||0)+1;});const bad=Object.keys(seen).filter(k=>seen[k]>1);dup+=bad.length;add('dup_'+sheet,sheet+'.'+field,bad.length?'ERROR':'OK',bad.length?'Duplikasi: '+bad.slice(0,8).join(', '):'Tidak ada ID duplikat.','Identifiers');});
  const testTokens=['TEST-','example.test']; let testRows=0; Object.keys(PSB_SHEETS).forEach(k=>{const name=PSB_SHEETS[k];rowsBy(name).forEach(r=>{const joined=Object.keys(r).map(x=>String(r[x]||'')).join('|');if(testTokens.some(t=>joined.indexOf(t)>=0))testRows++;});});
  add('testData','Dummy/test indicators',testRows?'WARNING':'OK',testRows?testRows+' baris terindikasi sebagai data test/dummy.':'Tidak ditemukan indikator TEST-/example.test.','Production');
  add('orphanSummary','Total orphan references',orphan?'ERROR':'OK',orphan?orphan+' referensi orphan ditemukan.':'Tidak ada orphan reference.','Summary');
  add('duplicateSummary','Total kelompok ID duplikat',dup?'ERROR':'OK',dup?dup+' kelompok ID duplikat ditemukan.':'Tidak ada kelompok ID duplikat.','Summary');
  const errors=checks.filter(x=>x.status==='ERROR').length, warnings=checks.filter(x=>x.status==='WARNING').length;
  const result={success:true,checks,summary:{total:checks.length,errors,warnings,ok:checks.length-errors-warnings},productionReady:errors===0,checkedAt:new Date().toISOString()};
  writeAudit_(actor.userId,'DATA_INTEGRITY_CHECK','SYSTEM','', '', JSON.stringify({errors,warnings,orphan,dup}), 'Pemeriksaan integritas data produksi dijalankan');
  return result;
}

function createProductionBackup(sessionToken) {
  const actor=requireRole_(sessionToken,['SUPERADMIN']);
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const props=PropertiesService.getScriptProperties();
  let folder=null; const yearId=String(props.getProperty('PSB_DRIVE_YEAR_ID')||'').trim();
  if(yearId){try{folder=DriveApp.getFolderById(yearId);}catch(e){folder=null;}}
  if(!folder){let root=null;const rootId=String(props.getProperty('PSB_DRIVE_ROOT_ID')||'').trim();if(rootId){try{root=DriveApp.getFolderById(rootId);}catch(e){}} if(root)folder=root;}
  if(!folder) throw new Error('Folder Drive produksi tidak tersedia.');
  const source=DriveApp.getFileById(ss.getId());
  const stamp=Utilities.formatDate(new Date(),getConfig_('TIMEZONE')||'Asia/Jakarta','yyyyMMdd_HHmmss');
  const copy=source.makeCopy('BACKUP_PSB_'+String(getConfig_('ACTIVE_YEAR')||'NA').replace(/[^A-Za-z0-9-]/g,'-')+'_'+stamp,folder);
  writeAudit_(actor.userId,'PRODUCTION_BACKUP','SYSTEM',copy.getId(),'','', 'Backup spreadsheet produksi dibuat');
  return {success:true,message:'Backup spreadsheet berhasil dibuat.',fileId:copy.getId(),fileName:copy.getName(),createdAt:new Date().toISOString()};
}

function getGoLiveChecklist(sessionToken) {
  const actor=requireRole_(sessionToken,PSB_PRODUCTION_ADMIN_ROLES);
  const control=getProductionControlData(sessionToken);
  const readiness=getProductionReadiness(sessionToken);
  const integrity=getDataIntegrityReport(sessionToken);
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const users=sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const passwordReady=users.some(u=>String(u.role||'').toUpperCase().split(',').map(x=>x.trim()).indexOf('SUPERADMIN')>=0 && String(u.status||'').toUpperCase()==='ACTIVE' && !(u.mustChangePassword===true || String(u.mustChangePassword||'').toUpperCase()==='TRUE'));
  const items=[
    {key:'readiness',label:'Production Readiness tanpa error',ok:readiness.productionReady,detail:readiness.productionReady?'Tidak ada error pada pemeriksaan readiness.':'Masih ada pemeriksaan yang berstatus error.'},
    {key:'integrity',label:'Data integrity tanpa error',ok:integrity.productionReady,detail:integrity.productionReady?'Referensi dan identifier utama sehat.':'Masih ditemukan masalah integritas data.'},
    {key:'superadminPassword',label:'Password SUPERADMIN sudah diganti',ok:passwordReady,detail:passwordReady?'Ada SUPERADMIN aktif yang tidak lagi wajib mengganti password.':'Minimal satu akun SUPERADMIN aktif masih wajib mengganti password.'},
    {key:'version',label:'Versi aplikasi tersedia',ok:!!String(control.config.APP_VERSION||'').trim(),detail:'Versi: '+(control.config.APP_VERSION||'-')},
    {key:'release',label:'Release stage ditetapkan',ok:!!String(control.config.RELEASE_STAGE||'').trim(),detail:'Stage: '+(control.config.RELEASE_STAGE||'-')},
    {key:'testData',label:'Tidak ada indikator dummy/test',ok:!readiness.checks.some(x=>x.key==='testData'&&x.status==='WARNING'),detail:readiness.checks.find(x=>x.key==='testData')?.detail||'Tidak ada indikator test.'},
    {key:'maintenance',label:'Maintenance mode tidak aktif',ok:String(control.config.MAINTENANCE_MODE||'').toUpperCase()!=='TRUE',detail:String(control.config.MAINTENANCE_MODE||'').toUpperCase()==='TRUE'?'Maintenance mode sedang aktif.':'Sistem tidak berada dalam maintenance mode.'},
    {key:'registration',label:'Status pendaftaran dikonfirmasi',ok:true,detail:String(control.config.REGISTRATION_OPEN||'').toUpperCase()==='TRUE'?'Pendaftaran OPEN.':'Pendaftaran CLOSED.'}
  ];
  const errors=items.filter(x=>!x.ok).length;
  return {success:true,items,summary:{total:items.length,ready:items.length-errors,blocked:errors},productionReady:errors===0,generatedAt:new Date().toISOString(),actor:actor.userId};
}

function assertRegistrationAccess_(actor, registration, adminRoles) {
  if (!actor || !registration) throw new Error('Pendaftaran tidak ditemukan.');
  const elevated = adminRoles || ['SUPERADMIN','ADMIN_PSB'];
  if (canAccessRegistration_(actor, registration) || hasRoleDirect_(actor, elevated)) return true;
  throw new Error('Anda tidak memiliki akses ke pendaftaran ini.');
}

function withScriptLock_(timeoutMs, callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs || 10000);
  try { return callback(); } finally { lock.releaseLock(); }
}

// =====================================================
// SESSION
// =====================================================

function createSession_(userId) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const tokenHash = sha256Hex_(token);
  const now = new Date();
  const ttl = Number(getConfig_('SESSION_TTL_MINUTES')) || PSB_AUTH.SESSION_TTL_MINUTES;
  const expires = new Date(now.getTime() + ttl * 60000);
  const sessionId = generateId_('SES');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS');
  sheet.appendRow([sessionId, userId, tokenHash, now, expires, now, 'ACTIVE']);
  return { token: token, expiresAt: expires.toISOString(), sessionId: sessionId };
}

function getSessionUser_(token, touch) {
  token = String(token || '');
  if (!token) return fail_('Session tidak ditemukan. Silakan login kembali.');

  const cache = CacheService.getScriptCache();
  const sessionCacheKey = 'PSB_SESSION_' + sha256Hex_(token).substring(0, 40);
  const cached = cache.get(sessionCacheKey);
  if (cached) {
    try {
      const c = JSON.parse(cached);
      const nowMs = Date.now();
      if (c.status === 'ACTIVE' && c.expiresAtMs > nowMs) {
        const idleMinutes = Number(c.idleMinutes) || PSB_AUTH.SESSION_IDLE_MINUTES;
        if (!c.lastActivityMs || nowMs - c.lastActivityMs <= idleMinutes * 60000) {
          // Avoid a Spreadsheet write on every validation. Touch at most once per minute.
          if (touch && (!c.lastTouchedMs || nowMs - c.lastTouchedMs >= 60000)) {
            try {
              const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS');
              if (sheet && c.rowNumber) sheet.getRange(c.rowNumber, 6).setValue(new Date());
            } catch (e) {}
            c.lastActivityMs = nowMs;
            c.lastTouchedMs = nowMs;
            cache.put(sessionCacheKey, JSON.stringify(c), Math.max(60, Math.ceil((c.expiresAtMs - nowMs) / 1000)));
          }
          return { success: true, user: c.user, sessionRow: { rowNumber: c.rowNumber, row: c.row }, expiresAt: new Date(c.expiresAtMs).toISOString() };
        }
      }
      cache.remove(sessionCacheKey);
    } catch (e) { cache.remove(sessionCacheKey); }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS');
  if (!sheet || sheet.getLastRow() < 2) return fail_('Session tidak ditemukan. Silakan login kembali.');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  const tokenHash = sha256Hex_(token);
  const now = new Date();
  let found = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (constantTimeEqual_(String(rows[i][2] || ''), tokenHash)) {
      found = { rowNumber: i + 2, row: rows[i] };
      break;
    }
  }
  if (!found) return fail_('Session tidak valid. Silakan login kembali.');

  const row = found.row;
  const status = String(row[6] || '').toUpperCase();
  if (status !== 'ACTIVE') return fail_('Session sudah berakhir. Silakan login kembali.');
  if (row[4] && new Date(row[4]) <= now) {
    invalidateSession_(found, 'EXPIRED');
    return fail_('Session sudah berakhir. Silakan login kembali.');
  }

  const idleMinutes = Number(getConfig_('SESSION_IDLE_MINUTES')) || PSB_AUTH.SESSION_IDLE_MINUTES;
  const lastActivity = row[5] ? new Date(row[5]) : now;
  if ((now.getTime() - lastActivity.getTime()) > idleMinutes * 60000) {
    invalidateSession_(found, 'IDLE_TIMEOUT');
    return fail_('Session berakhir karena tidak aktif. Silakan login kembali.');
  }

  const user = findUserById_(String(row[1]));
  if (!user || String(user.status).toUpperCase() !== 'ACTIVE') return fail_('Akun tidak aktif.');

  if (touch) sheet.getRange(found.rowNumber, 6).setValue(now);
  const c = {
    status: 'ACTIVE', rowNumber: found.rowNumber, row: row, user: user,
    expiresAtMs: new Date(row[4]).getTime(), lastActivityMs: now.getTime(),
    lastTouchedMs: now.getTime(), idleMinutes: idleMinutes
  };
  try { cache.put(sessionCacheKey, JSON.stringify(c), Math.max(60, Math.ceil((c.expiresAtMs - now.getTime()) / 1000))); } catch (e) {}
  return { success: true, user: user, sessionRow: found, expiresAt: new Date(row[4]).toISOString() };
}

function revokeOtherSessionsForUser_(userId, keepRowNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2,1,lastRow-1,7).getValues();
  const keep = Number(keepRowNumber || 0);
  const now = new Date();
  let count = 0;
  for (let i=0;i<rows.length;i++) {
    const rowNumber=i+2;
    if (rowNumber===keep) continue;
    if (String(rows[i][1]||'')!==String(userId||'')) continue;
    if (String(rows[i][6]||'').toUpperCase()!=='ACTIVE') continue;
    sheet.getRange(rowNumber,7).setValue('REVOKED');
    try { const h=String(rows[i][2]||''); if(h) CacheService.getScriptCache().remove('PSB_SESSION_'+h.substring(0,40)); } catch(e) {}
    count++;
  }
  return count;
}

function cleanupPSBSessions_(limit) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS');
  if (!sheet || sheet.getLastRow() < 2) return {processed:0,expired:0,idle:0};
  const max = Math.max(1, Number(limit || getConfig_('SESSION_CLEANUP_BATCH') || 500));
  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2,1,lastRow-1,7).getValues();
  const now = new Date();
  const idleMinutes = Number(getConfig_('SESSION_IDLE_MINUTES')) || PSB_AUTH.SESSION_IDLE_MINUTES;
  let processed=0, expired=0, idle=0;
  for(let i=0;i<rows.length && processed<max;i++){
    const status=String(rows[i][6]||'').toUpperCase();
    if(status!=='ACTIVE') continue;
    const expires=rows[i][4]?new Date(rows[i][4]):null;
    const lastSeen=rows[i][5]?new Date(rows[i][5]):rows[i][3]?new Date(rows[i][3]):now;
    let next='';
    if(expires && expires<=now) { next='EXPIRED'; expired++; }
    else if((now.getTime()-lastSeen.getTime())>idleMinutes*60000) { next='IDLE_TIMEOUT'; idle++; }
    if(next){
      sheet.getRange(i+2,7).setValue(next);
      try { const h=String(rows[i][2]||''); if(h) CacheService.getScriptCache().remove('PSB_SESSION_'+h.substring(0,40)); } catch(e) {}
      processed++;
    }
  }
  return {processed:processed,expired:expired,idle:idle};
}

function cleanupPSBSessions() {
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try { return cleanupPSBSessions_(getConfig_('SESSION_CLEANUP_BATCH') || 500); }
  finally { lock.releaseLock(); }
}

function runSecurityMaintenance(sessionToken) {
  const actor=requireRole_(sessionToken, PSB_SECURITY_ADMIN_ROLES);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  let result;
  try { result=cleanupPSBSessions_(getConfig_('SESSION_CLEANUP_BATCH') || 500); }
  finally { lock.releaseLock(); }
  writeAudit_(actor.userId,'SECURITY_MAINTENANCE','SECURITY','', '', JSON.stringify(result), 'Maintenance keamanan dijalankan oleh SUPERADMIN');
  return {success:true, result:result};
}

function invalidateSession_(found, status) {
  if (!found || !found.rowNumber) return;
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SESSIONS').getRange(found.rowNumber, 7).setValue(status || 'REVOKED');
  try {
    const tokenHash = String((found.row || [])[2] || '');
    if (tokenHash) CacheService.getScriptCache().remove('PSB_SESSION_' + tokenHash.substring(0, 40));
  } catch (e) {}
}

// =====================================================
// USER / PASSWORD
// =====================================================

function findUser_(key) {
  const normalized = String(key || '').toLowerCase();
  if (!normalized) return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PSB_USER_V3_' + sha256Hex_(normalized).substring(0, 32);
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const phoneNormalized = String(r[3] || '').trim().toLowerCase();
    const emailNormalized = String(r[5] || '').trim().toLowerCase();
    const phoneRaw = String(r[2] || '').trim().toLowerCase();
    const emailRaw = String(r[4] || '').trim().toLowerCase();
    // Username legacy/bootstrap (termasuk akun Superadmin) disimpan pada kolom phone.
    // Akun WALI tetap menggunakan phoneNormalized/emailNormalized seperti biasa.
    if (phoneNormalized === normalized || emailNormalized === normalized || phoneRaw === normalized || emailRaw === normalized) {
      const user = userFromRow_(r, i + 2);
      try { cache.put(cacheKey, JSON.stringify(user), 300); } catch (e) {}
      return user;
    }
  }
  return null;
}

function findUserById_(id) {
  const value = String(id || '');
  if (!value) return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PSB_USER_ID_' + sha256Hex_(value).substring(0, 32);
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === value) {
      const user = userFromRow_(rows[i], i + 2);
      try { cache.put(cacheKey, JSON.stringify(user), 300); } catch (e) {}
      return user;
    }
  }
  return null;
}

function userFromRow_(r, rowNumber) {
  return {
    rowNumber: rowNumber, userId: String(r[0] || ''), name: String(r[1] || ''), phone: String(r[2] || ''),
    phoneNormalized: String(r[3] || ''), email: String(r[4] || ''), emailNormalized: String(r[5] || ''),
    passwordHash: String(r[6] || ''), passwordSalt: String(r[7] || ''), role: String(r[8] || ''), status: String(r[9] || ''),
    photoFileId: String(r[10] || ''), lastLoginAt: r[11], createdAt: r[12], updatedAt: r[13], mustChangePassword: r[14]
  };
}

function publicUser_(u) {
  return { userId: u.userId, name: u.name, phone: u.phone, email: u.email, role: u.role, status: u.status, photoFileId: u.photoFileId || '' };
}

function updateLastLogin_(rowNumber) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS').getRange(rowNumber, 12).setValue(new Date());
}

function getUserManagementData(sessionToken) {
  requireRole_(sessionToken, ['SUPERADMIN']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return { success: true, users: [], roles: PSB_ROLES.slice() };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(15, sheet.getLastColumn())).getValues();
  const users = rows.map((r, i) => ({
    userId: String(r[0] || ''),
    name: String(r[1] || ''),
    phone: String(r[2] || ''),
    email: String(r[4] || ''),
    role: String(r[8] || ''),
    status: String(r[9] || ''),
    createdAt: r[12] instanceof Date ? r[12].toISOString() : String(r[12] || ''),
    updatedAt: r[13] instanceof Date ? r[13].toISOString() : String(r[13] || ''),
    mustChangePassword: r[14] === true || String(r[14] || '').toUpperCase() === 'TRUE'
  })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { success: true, users: users, roles: PSB_ROLES.slice() };
}

function adminResetUserPassword(sessionToken, payload) {
  const actor = requireRole_(sessionToken, ['SUPERADMIN']);
  assertOperationalMutation_(actor);
  payload = payload || {};

  const userId = String(payload.userId || '').trim();
  const newPassword = String(payload.newPassword || '');
  const confirmPassword = String(payload.confirmPassword || '');
  if (!userId) return fail_('User ID wajib diisi.');
  if (newPassword.length < 6) return fail_('Password baru minimal 6 karakter.');
  if (newPassword !== confirmPassword) return fail_('Konfirmasi password tidak sama.');

  const target = findUserById_(userId);
  if (!target) return fail_('Pengguna tidak ditemukan.');

  const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
  const hash = hashPassword_(newPassword, salt);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  if (!sheet) return fail_('Sheet USERS tidak ditemukan.');

  // USERS: passwordHash=7, passwordSalt=8, role=9, updatedAt=14, mustChangePassword=15.
  sheet.getRange(target.rowNumber, 7, 1, 3).setValues([[hash, salt, target.role]]);
  sheet.getRange(target.rowNumber, 14, 1, 2).setValues([[new Date(), true]]);

  // Password reset oleh SUPERADMIN memaksa seluruh sesi target login ulang.
  const revoked = revokeOtherSessionsForUser_(target.userId, 0);
  try {
    if (target.phoneNormalized) CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(String(target.phoneNormalized).toLowerCase()).substring(0, 32));
    if (target.emailNormalized) CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(String(target.emailNormalized).toLowerCase()).substring(0, 32));
    CacheService.getScriptCache().remove('PSB_USER_ID_' + sha256Hex_(String(target.userId)).substring(0, 32));
  } catch (e) {}

  writeAudit_(actor.userId, 'RESET_PASSWORD', 'USER', target.userId, '', JSON.stringify({targetUserId:target.userId}), 'SUPERADMIN mereset password pengguna');
  return {success:true, message:'Password pengguna berhasil direset. Pengguna wajib mengganti password saat login berikutnya.', revokedSessions:revoked};
}

function createManualUser(sessionToken, payload) {
  const actor = requireRole_(sessionToken, ['SUPERADMIN']);
  assertOperationalMutation_(actor);
  payload = payload || {};

  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const requestedRoles = Array.isArray(payload.roles) ? payload.roles : String(payload.role || '').split(',');
  const roles = Array.from(new Set(requestedRoles.map(x => String(x || '').trim().toUpperCase()).filter(Boolean)));

  if (!name) return fail_('Nama lengkap wajib diisi.');
  if (!phone && !email) return fail_('No. HP atau Email wajib diisi minimal salah satu.');
  if (phone && normalizePhone_(phone).length < 10) return fail_('No. HP tidak valid.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_('Format email tidak valid.');
  if (!roles.length) return fail_('Pilih minimal satu role.');
  if (roles.some(r => PSB_ROLES.indexOf(r) < 0)) return fail_('Role akun tidak sesuai dengan role yang tersedia.');
  if (password.length < 6) return fail_('Password minimal 6 karakter.');
  if (password !== confirmPassword) return fail_('Konfirmasi password tidak sama.');

  const phoneNormalized = phone ? normalizePhone_(phone) : '';
  const emailNormalized = email ? email.toLowerCase() : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
    if (!sheet) return fail_('Database USERS belum tersedia. Jalankan setupPSBDatabase() terlebih dahulu.');
    const lastRow = sheet.getLastRow();
    const width = Math.max(15, sheet.getLastColumn());
    const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (phoneNormalized && String(r[3] || '').toLowerCase() === phoneNormalized.toLowerCase()) return fail_('No. HP sudah terdaftar.');
      if (emailNormalized && String(r[5] || '').toLowerCase() === emailNormalized) return fail_('Email sudah terdaftar.');
    }

    const now = new Date();
    const userId = generateId_('USR');
    const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
    const hash = hashPassword_(password, salt);
    const values = [
      userId, name, phone, phoneNormalized, email, emailNormalized,
      hash, salt, roles.join(','), status, '', '', now, now, true
    ];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const canonical = PSB_HEADERS.USERS || [];
    const idx = {};
    canonical.forEach((h, i) => { idx[h] = i; });
    const row = headers.map(h => idx[h] === undefined ? '' : values[idx[h]]);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);

    if (phoneNormalized) CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(phoneNormalized.toLowerCase()).substring(0, 32));
    if (emailNormalized) CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(emailNormalized).substring(0, 32));
    writeAudit_(actor.userId, 'CREATE', 'USER', userId, '', JSON.stringify({ name: name, phone: phoneNormalized, email: emailNormalized, role: roles.join(','), status: status }), 'Akun pengguna dibuat manual oleh SUPERADMIN');

    return {
      success: true,
      message: 'Akun pengguna berhasil dibuat. Pengguna wajib mengganti password saat login pertama.',
      user: { userId: userId, name: name, phone: phone, email: email, role: roles.join(','), status: status, mustChangePassword: true }
    };
  } finally {
    lock.releaseLock();
  }
}


function normalizeIdentifier_(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return '';
  if (raw.indexOf('@') >= 0) return raw.toLowerCase();
  // Username legacy/bootstrap (mis. Superadmin) bukan nomor telepon.
  // Nomor telepon Indonesia umumnya dimulai +, 0, 8, 62, atau 00.
  if (/^[+0-9][0-9 .()\-]*$/.test(raw)) return normalizePhone_(raw);
  return raw.toLowerCase();
}

function normalizePhone_(phone) {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.indexOf('00') === 0) p = p.substring(2);
  if (p.indexOf('0') === 0) p = '62' + p.substring(1);
  else if (p.indexOf('8') === 0) p = '62' + p;
  return p;
}

function hashPassword_(password, salt) {
  return sha256Hex_(String(password) + String(salt));
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// =====================================================
// BRUTE FORCE PROTECTION (CacheService)
// =====================================================

function registerLoginFailure_(key) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PSB_LOGIN_FAIL_V2_' + sha256Hex_(key).substring(0, 32);
  const current = Number(cache.get(cacheKey) || 0) + 1;
  const max = Number(getConfig_('LOGIN_MAX_ATTEMPTS')) || PSB_AUTH.MAX_ATTEMPTS;
  const lockMin = Number(getConfig_('LOGIN_LOCK_MINUTES')) || PSB_AUTH.LOCK_MINUTES;
  cache.put(cacheKey, String(current), lockMin * 60);
  if (current >= max) cache.put('PSB_LOGIN_LOCK_V2_' + sha256Hex_(key).substring(0, 32), String(Date.now() + lockMin * 60000), lockMin * 60);
}

function getLoginLock_(key) {
  const cache = CacheService.getScriptCache();
  const k = 'PSB_LOGIN_LOCK_V2_' + sha256Hex_(key).substring(0, 32);
  const until = Number(cache.get(k) || 0);
  if (until > Date.now()) return { locked: true, remainingMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60000)) };
  return { locked: false };
}

function clearLoginFailure_(key) {
  const cache = CacheService.getScriptCache();
  const h = sha256Hex_(key).substring(0, 32);
  cache.remove('PSB_LOGIN_FAIL_V2_' + h);
  cache.remove('PSB_LOGIN_LOCK_V2_' + h);
}

// =====================================================
// AUDIT / CONFIG / UTIL
// =====================================================


function rpcSafe_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(rpcSafe_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(k => {
      if (value[k] !== undefined) out[k] = rpcSafe_(value[k]);
    });
    return out;
  }
  return value;
}

function auditCell_(value) {
  const s=String(value==null?'':value);
  return /^[=+\-@]/.test(s) ? "'"+s : s;
}

function writeAudit_(userId, action, module, recordId, oldValue, newValue, description) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AUDIT_LOG');
    if (!sheet) return;
    // Jangan mengambil ScriptLock di sini karena writeAudit_ dipanggil dari
    // beberapa transaksi yang memang sudah memegang ScriptLock. appendRow
    // tetap atomik di level Spreadsheet; audit tidak boleh menggagalkan transaksi utama.
    sheet.appendRow([generateId_('AUD'), new Date(), auditCell_(userId), auditCell_(action), auditCell_(module), auditCell_(recordId), auditCell_(oldValue), auditCell_(newValue), auditCell_(description), '']);
  } catch (e) {
    // Audit adalah jejak tambahan; kegagalan menulis audit tidak boleh
    // membuat transaksi utama yang sudah tersimpan dilaporkan sebagai gagal.
    console.error('AUDIT_LOG write failed: ' + e);
  }
}

function getAuditLogPageData(sessionToken, filters) {
  requireRole_(sessionToken, PSB_AUDIT_ACCESS_ROLES);
  filters=filters||{};
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AUDIT_LOG');
  if(!sheet || sheet.getLastRow()<2) return {success:true,rows:[],total:0,page:1,pageSize:50,hasMore:false,options:{actions:[],modules:[]}};
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(10,Number(filters.pageSize)||Number(getConfig_('AUDIT_PAGE_SIZE'))||50));
  const search=String(filters.search||'').trim().toLowerCase();
  const action=String(filters.action||'').trim().toUpperCase();
  const module=String(filters.module||'').trim().toUpperCase();
  const from=String(filters.from||'').trim();
  const to=String(filters.to||'').trim();
  const idx={};headers.forEach((h,i)=>idx[h]=i);
  const items=[];
  const actions={};const modules={};
  values.forEach((r,i)=>{
    const ts=r[idx.timestamp];
    const actionValue=String(r[idx.action]||'').toUpperCase();
    const moduleValue=String(r[idx.module]||'').toUpperCase();
    actions[actionValue]=true;modules[moduleValue]=true;
    const hay=[r[idx.userId],r[idx.action],r[idx.module],r[idx.recordId],r[idx.description]].map(x=>String(x||'').toLowerCase()).join(' ');
    if(search && hay.indexOf(search)<0)return;
    if(action && actionValue!==action)return;
    if(module && moduleValue!==module)return;
    const d=ts?new Date(ts):null;
    if(from && (!d || d<new Date(from+'T00:00:00')))return;
    if(to && (!d || d>new Date(to+'T23:59:59')))return;
    items.push({auditId:r[idx.auditId],timestamp:ts,userId:r[idx.userId],action:r[idx.action],module:r[idx.module],recordId:r[idx.recordId],oldValue:r[idx.oldValue],newValue:r[idx.newValue],description:r[idx.description]});
  });
  items.sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0));
  const start=(page-1)*pageSize;
  return {success:true,rows:items.slice(start,start+pageSize),total:items.length,page:page,pageSize:pageSize,hasMore:start+pageSize<items.length,options:{actions:Object.keys(actions).filter(Boolean).sort(),modules:Object.keys(modules).filter(Boolean).sort()}};
}


function getConfig_(key) {
  const k = String(key || '');
  if (!k) return '';
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PSB_CFG_' + sha256Hex_(k).substring(0, 24);
  const cached = cache.get(cacheKey);
  if (cached !== null && cached !== '') return cached;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  if (!sheet || sheet.getLastRow() < 2) return '';
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  let value = '';
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === k) { value = values[i][1]; break; }
  }
  try { cache.put(cacheKey, String(value == null ? '' : value), 600); } catch (e) {}
  return value;
}

function setConfigValue_(key, value) {
  const k = String(key || '').trim();
  if (!k) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.CONFIG);
  if (!sheet) throw new Error('Sheet CONFIG belum tersedia.');
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const keyIdx = headers.indexOf('key'), valueIdx = headers.indexOf('value'), updatedIdx = headers.indexOf('updatedAt');
  if (keyIdx < 0 || valueIdx < 0) throw new Error('Struktur CONFIG tidak sesuai.');
  const rows = sheet.getLastRow() >= 2 ? sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues() : [];
  let rowNumber = 0;
  for (let i=0;i<rows.length;i++) if (String(rows[i][keyIdx] || '') === k) { rowNumber = i + 2; break; }
  if (rowNumber) {
    sheet.getRange(rowNumber,valueIdx+1).setValue(value);
    if (updatedIdx >= 0) sheet.getRange(rowNumber,updatedIdx+1).setValue(new Date());
  } else {
    const row = new Array(headers.length).fill('');
    row[keyIdx] = k; row[valueIdx] = value; if (updatedIdx >= 0) row[updatedIdx] = new Date();
    sheet.appendRow(row);
  }
  try { CacheService.getScriptCache().remove('PSB_CFG_'+sha256Hex_(k).substring(0,24)); } catch (e) {}
  try { CacheService.getScriptCache().remove('PSB_PUBLIC_CONFIG_V5'); CacheService.getScriptCache().remove('PSB_PUBLIC_CONFIG_V4'); } catch (e) {}
  return true;
}

function getActiveAcademicYear_() {
  const configuredId = String(getConfig_('ACTIVE_YEAR_ID') || '').trim();
  const configuredName = String(getConfig_('ACTIVE_YEAR') || '').trim();
  const years = getActiveMasterItems_('MASTER_TAHUN_AJARAN');
  let year = configuredId ? years.find(x => String(x.tahunAjaranId) === configuredId) : null;
  if (!year && configuredName) year = years.find(x => String(x.name) === configuredName);
  if (!year) year = years.find(x => x.isActive === true) || null;
  return year || null;
}

function getAcademicYearLifecycleData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const years = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN));
  const waves = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_GELOMBANG));
  const regs = sheetRows_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS));
  const bills = sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS));
  const schedules = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE));
  const configuredId = String(getConfig_('ACTIVE_YEAR_ID') || '').trim();
  const configuredName = String(getConfig_('ACTIVE_YEAR') || '').trim();
  let active = years.find(x => configuredId && String(x.tahunAjaranId) === configuredId) || years.find(x => configuredName && String(x.name) === configuredName && x.isActive === true) || years.find(x => x.isActive === true);
  const items = years.map(y => {
    const id = String(y.tahunAjaranId || '');
    return Object.assign({}, y, {
      registrationCount: regs.filter(r => String(r.tahunAjaranId) === id).length,
      waveCount: waves.filter(w => String(w.tahunAjaranId) === id).length,
      scheduleCount: schedules.filter(s => String(s.tahunAjaranId) === id).length,
      billCount: bills.filter(b => {
        const reg = regs.find(r => String(r.registrationId) === String(b.registrationId));
        return reg && String(reg.tahunAjaranId) === id;
      }).length,
      lifecycleStatus: active && String(active.tahunAjaranId) === id ? 'ACTIVE' : (y.isActive ? 'AVAILABLE' : 'ARCHIVED')
    });
  }).sort((a,b) => String(b.name || '').localeCompare(String(a.name || '')));
  return {
    success:true,
    activeYearId: active ? String(active.tahunAjaranId) : '',
    activeYearName: active ? String(active.name) : String(getConfig_('ACTIVE_YEAR') || ''),
    items,
    actorRole: actor.role,
    generatedAt:new Date().toISOString()
  };
}

function setActiveAcademicYear(sessionToken, tahunAjaranId) {
  const actor = requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  assertOperationalMutation_(actor);
  const id = String(tahunAjaranId || '').trim();
  if (!id) return fail_('Tahun ajaran wajib dipilih.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN);
    if (!sheet) return fail_('Master tahun ajaran belum tersedia.');
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    const target = findMasterRow_(sheet, headers, 'tahunAjaranId', id);
    if (!target) return fail_('Tahun ajaran tidak ditemukan.');
    const name = String(target.object.name || '').trim();
    if (!name) return fail_('Nama tahun ajaran tidak valid.');
    const activeIdx = headers.indexOf('isActive');
    const updatedIdx = headers.indexOf('updatedAt');
    const oldActive = getActiveAcademicYear_();
    const rows = sheet.getLastRow() >= 2 ? sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues() : [];
    const idIdx = headers.indexOf('tahunAjaranId');
    rows.forEach((row,i) => {
      const rowId = String(row[idIdx] || '');
      const shouldBeActive = rowId === id;
      if (activeIdx >= 0) sheet.getRange(i+2,activeIdx+1).setValue(shouldBeActive);
      if (updatedIdx >= 0 && (shouldBeActive || row[activeIdx] === true || String(row[activeIdx]).toUpperCase() === 'TRUE')) sheet.getRange(i+2,updatedIdx+1).setValue(new Date());
    });
    setConfigValue_('ACTIVE_YEAR_ID', id);
    setConfigValue_('ACTIVE_YEAR', name);
    writeAudit_(actor.userId,'ACADEMIC_YEAR_ACTIVATE','MASTER_TAHUN_AJARAN',id,oldActive?JSON.stringify({tahunAjaranId:oldActive.tahunAjaranId,name:oldActive.name}):'',JSON.stringify({tahunAjaranId:id,name}), 'Tahun ajaran aktif diganti');
    return {success:true,message:'Tahun ajaran '+name+' sekarang menjadi tahun ajaran aktif.',activeYearId:id,activeYearName:name};
  } finally { lock.releaseLock(); }
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}



// =====================================================
// STAGE 3 - MASTER DATA
// =====================================================

const PSB_MASTER_ACCESS_ROLES = ['SUPERADMIN','ADMIN_PSB'];

const PSB_MASTER_DEFINITIONS = {
  MASTER_TAHUN_AJARAN: {
    sheet: 'MASTER_TAHUN_AJARAN', idField: 'tahunAjaranId', title: 'Tahun Ajaran',
    fields: [
      {key:'name', label:'Nama Tahun Ajaran', type:'text', required:true},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  },
  MASTER_GELOMBANG: {
    sheet: 'MASTER_GELOMBANG', idField: 'gelombangId', title: 'Gelombang',
    fields: [
      {key:'tahunAjaranId', label:'Tahun Ajaran', type:'select', required:true, optionMaster:'MASTER_TAHUN_AJARAN'},
      {key:'name', label:'Nama Gelombang', type:'text', required:true},
      {key:'startDate', label:'Tanggal Mulai', type:'date'},
      {key:'endDate', label:'Tanggal Selesai', type:'date'},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  },
  MASTER_JENJANG: {
    sheet: 'MASTER_JENJANG', idField: 'jenjangId', title: 'Jenjang',
    fields: [
      {key:'name', label:'Nama Jenjang', type:'text', required:true},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  },
  MASTER_KELAS: {
    sheet: 'MASTER_KELAS', idField: 'kelasId', title: 'Kelas',
    fields: [
      {key:'jenjangId', label:'Jenjang', type:'select', required:true, optionMaster:'MASTER_JENJANG'},
      {key:'name', label:'Nama Kelas', type:'text', required:true},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  },
  MASTER_DOKUMEN: {
    sheet: 'MASTER_DOKUMEN', idField: 'documentTypeId', title: 'Jenis Dokumen',
    fields: [
      {key:'name', label:'Nama Dokumen', type:'text', required:true},
      {key:'required', label:'Wajib', type:'boolean'},
      {key:'allowedMimeTypes', label:'Tipe File Diizinkan', type:'text', placeholder:'image/jpeg,image/png,application/pdf'},
      {key:'maxSizeMb', label:'Maksimum Ukuran (MB)', type:'number'},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  },
  MASTER_JENIS_PEMBAYARAN: {
    sheet: 'MASTER_JENIS_PEMBAYARAN', idField: 'paymentTypeId', title: 'Jenis Pembayaran',
    fields: [
      {key:'name', label:'Nama Pembayaran', type:'text', required:true},
      {key:'amount', label:'Nominal', type:'number'},
      {key:'isActive', label:'Aktif', type:'boolean'}
    ]
  }
};

function getMasterDefinitions(sessionToken) {
  requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  return { success:true, definitions: PSB_MASTER_DEFINITIONS };
}

function getMasterData(sessionToken, masterKey, includeInactive) {
  requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  const def = PSB_MASTER_DEFINITIONS[String(masterKey || '')];
  if (!def) return fail_('Master data tidak dikenali.');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
  if (!sheet) return fail_('Sheet master data belum tersedia: ' + def.sheet);
  if (sheet.getLastRow() < 2) return {success:true, masterKey:masterKey, title:def.title, items:[]};

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const items = values.map((row, idx) => {
    const obj = { rowNumber: idx + 2 };
    headers.forEach((h, i) => obj[h] = normalizeMasterValue_(row[i], h));
    return obj;
  }).filter(item => includeInactive || item.isActive !== false);

  return { success:true, masterKey:masterKey, title:def.title, items:items };
}

function saveMasterItem(sessionToken, masterKey, payload) {
  const actor = requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  assertOperationalMutation_(actor);
  const key = String(masterKey || '');
  const def = PSB_MASTER_DEFINITIONS[key];
  if (!def) return fail_('Master data tidak dikenali.');
  payload = payload || {};

  const validation = validateMasterPayload_(key, payload);
  if (!validation.success) return validation;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
    if (!sheet) return fail_('Sheet master data belum tersedia.');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const idField = def.idField;
    const id = String(payload[idField] || '').trim();
    const now = new Date();
    let rowNumber = 0;
    let oldObj = null;

    if (id) {
      const existing = findMasterRow_(sheet, headers, idField, id);
      if (!existing) return fail_('Data master yang akan diubah tidak ditemukan.');
      rowNumber = existing.rowNumber;
      oldObj = existing.object;
    }

    if (key === 'MASTER_TAHUN_AJARAN') {
      const activeYear = getActiveAcademicYear_();
      const isCurrent = !!(activeYear && id && String(activeYear.tahunAjaranId) === id);
      const requestedActive = payload.isActive === true || String(payload.isActive).toUpperCase() === 'TRUE';
      if (requestedActive && !isCurrent) return fail_('Status aktif tahun ajaran dikelola melalui tombol "Jadikan Aktif" agar hanya ada satu periode aktif.');
      if (isCurrent && Object.prototype.hasOwnProperty.call(payload,'isActive') && !requestedActive) return fail_('Tahun ajaran aktif tidak dapat dinonaktifkan dari form. Pindahkan tahun aktif ke periode lain terlebih dahulu.');
      if (!id) payload.isActive = false;
    }

    const duplicate = findMasterDuplicate_(sheet, headers, def, payload, id);
    if (duplicate) return fail_('Data dengan nama yang sama sudah ada pada konteks master ini.');

    const recordId = id || generateId_(masterPrefix_(key));
    const rowObject = {};
    headers.forEach(h => rowObject[h] = '');
    rowObject[idField] = recordId;
    def.fields.forEach(field => {
      rowObject[field.key] = normalizeMasterWriteValue_(payload[field.key], field);
    });
    rowObject.createdAt = oldObj ? oldObj.createdAt : now;
    rowObject.updatedAt = now;

    const row = headers.map(h => rowObject[h] !== undefined ? rowObject[h] : '');
    if (rowNumber) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    else { sheet.appendRow(row); rowNumber = sheet.getLastRow(); }

    const action = id ? 'UPDATE' : 'CREATE';
    if (key === 'MASTER_TAHUN_AJARAN' && rowObject.isActive === true) {
      setConfigValue_('ACTIVE_YEAR_ID', recordId);
      setConfigValue_('ACTIVE_YEAR', String(rowObject.name || ''));
    }
    writeAudit_(actor.userId, action, 'MASTER_DATA', recordId, oldObj ? JSON.stringify(oldObj) : '', JSON.stringify(rowObject), def.title + ' ' + (id ? 'diperbarui' : 'dibuat'));
    return { success:true, message:def.title + ' berhasil ' + (id ? 'diperbarui.' : 'ditambahkan.'), item: masterObjectFromRow_(headers, row, rowNumber) };
  } finally {
    lock.releaseLock();
  }
}

function deactivateMasterItem(sessionToken, masterKey, id) {
  const actor = requireRole_(sessionToken, PSB_MASTER_ACCESS_ROLES);
  assertOperationalMutation_(actor);
  const def = PSB_MASTER_DEFINITIONS[String(masterKey || '')];
  if (!def) return fail_('Master data tidak dikenali.');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const existing = findMasterRow_(sheet, headers, def.idField, String(id || ''));
  if (!existing) return fail_('Data master tidak ditemukan.');
  if (def.sheet === 'MASTER_TAHUN_AJARAN') {
    const activeYear = getActiveAcademicYear_();
    if (activeYear && String(activeYear.tahunAjaranId) === String(id)) return fail_('Tahun ajaran aktif tidak dapat dinonaktifkan. Pindahkan tahun aktif ke periode lain terlebih dahulu.');
  }
  const activeIndex = headers.indexOf('isActive');
  if (activeIndex < 0) return fail_('Master data ini tidak mendukung status aktif.');
  sheet.getRange(existing.rowNumber, activeIndex + 1).setValue(false);
  sheet.getRange(existing.rowNumber, headers.indexOf('updatedAt') + 1).setValue(new Date());
  writeAudit_(actor.userId, 'DEACTIVATE', 'MASTER_DATA', String(id), JSON.stringify(existing.object), JSON.stringify(Object.assign({}, existing.object, {isActive:false})), def.title + ' dinonaktifkan');
  return { success:true, message:def.title + ' dinonaktifkan.' };
}

function validateMasterPayload_(masterKey, payload) {
  const def = PSB_MASTER_DEFINITIONS[masterKey];
  for (let i = 0; i < def.fields.length; i++) {
    const field = def.fields[i];
    if (field.required && !String(payload[field.key] == null ? '' : payload[field.key]).trim()) return fail_(field.label + ' wajib diisi.');
    if (field.type === 'number' && payload[field.key] !== '' && payload[field.key] != null && (!isFinite(Number(payload[field.key])) || Number(payload[field.key]) < 0)) return fail_(field.label + ' harus berupa angka nol atau lebih.');
  }
  if (masterKey === 'MASTER_GELOMBANG' && payload.startDate && payload.endDate && String(payload.startDate) > String(payload.endDate)) return fail_('Tanggal mulai tidak boleh setelah tanggal selesai.');
  if (masterKey === 'MASTER_DOKUMEN' && payload.maxSizeMb !== '' && payload.maxSizeMb != null && Number(payload.maxSizeMb) <= 0) return fail_('Maksimum ukuran file harus lebih dari 0 MB.');
  return { success:true };
}

function findMasterDuplicate_(sheet, headers, def, payload, currentId) {
  if (!payload.name) return null;
  const name = String(payload.name).trim().toLowerCase();
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).getValues();
  const idIdx = headers.indexOf(def.idField);
  const nameIdx = headers.indexOf('name');
  if (nameIdx < 0) return null;
  let contextIdx = -1, contextValue = '';
  if (def.sheet === 'MASTER_GELOMBANG') { contextIdx = headers.indexOf('tahunAjaranId'); contextValue = String(payload.tahunAjaranId || ''); }
  if (def.sheet === 'MASTER_KELAS') { contextIdx = headers.indexOf('jenjangId'); contextValue = String(payload.jenjangId || ''); }
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][idIdx] || '') === String(currentId || '')) continue;
    if (String(rows[i][nameIdx] || '').trim().toLowerCase() !== name) continue;
    if (contextIdx >= 0 && String(rows[i][contextIdx] || '') !== contextValue) continue;
    return true;
  }
  return null;
}

function findMasterRow_(sheet, headers, idField, id) {
  const idIdx = headers.indexOf(idField);
  if (idIdx < 0 || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).getValues();
  for (let i=0;i<rows.length;i++) if (String(rows[i][idIdx] || '') === String(id)) return {rowNumber:i+2, object:masterObjectFromRow_(headers, rows[i], i+2)};
  return null;
}

function masterObjectFromRow_(headers, row, rowNumber) {
  const obj = {rowNumber:rowNumber};
  headers.forEach((h,i)=>obj[h]=normalizeMasterValue_(row[i], h));
  return obj;
}

function normalizeMasterValue_(value, key) {
  if (key === 'isActive' || key === 'required') return value === true || String(value).toUpperCase() === 'TRUE';
  if (value instanceof Date) return Utilities.formatDate(value, getConfig_('TIMEZONE') || 'Asia/Jakarta', 'yyyy-MM-dd');
  return value == null ? '' : String(value);
}

function normalizeMasterWriteValue_(value, field) {
  if (field.type === 'boolean') return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
  if (field.type === 'number') return value === '' || value == null ? '' : Number(value);
  if (field.type === 'date') return value ? new Date(String(value) + 'T00:00:00') : '';
  return String(value == null ? '' : value).trim();
}

function masterPrefix_(masterKey) {
  return ({MASTER_TAHUN_AJARAN:'TA',MASTER_GELOMBANG:'GLB',MASTER_JENJANG:'JEN',MASTER_KELAS:'KLS',MASTER_DOKUMEN:'DOC',MASTER_JENIS_PEMBAYARAN:'PAY'})[masterKey] || 'MST';
}


// =====================================================
// STAGE 4 - PENDAFTARAN
// REGISTRATIONS + CANDIDATES + GUARDIANS + ADDRESSES + SCHOOLS
// =====================================================

const PSB_REGISTRATION_EDIT_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB'];
const PSB_REGISTRATION_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'];
const PSB_REGISTRATION_EDITABLE_STATUSES = ['DRAFT','REVISION'];

function getRegistrationFormOptions(sessionToken) {
  const user = requireRole_(sessionToken, PSB_REGISTRATION_EDIT_ROLES);
  const year = getActiveMasterItems_('MASTER_TAHUN_AJARAN');
  const waves = getActiveMasterItems_('MASTER_GELOMBANG');
  const levels = getActiveMasterItems_('MASTER_JENJANG');
  const activeYearId = String(getConfig_('ACTIVE_YEAR_ID') || '').trim();
  const activeYearName = String(getConfig_('ACTIVE_YEAR') || '').trim();
  const selectedYear = activeYearId ? year.find(x => x.tahunAjaranId === activeYearId) : year.find(x => x.name === activeYearName);
  const filteredWaves = selectedYear ? waves.filter(x => String(x.tahunAjaranId) === String(selectedYear.tahunAjaranId)) : waves;
  return { success:true, user:publicUser_(user), years:year, waves:filteredWaves, jenjang:levels, activeYearId:selectedYear ? selectedYear.tahunAjaranId : '', activeYearName:selectedYear ? selectedYear.name : activeYearName };
}

function getWaliHomeData(sessionToken) {
  const actor = requireRole_(sessionToken, ['WALI']);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  if (!regSheet || regSheet.getLastRow() < 2) return {success:true, registrations:[], activeYear:String(getConfig_('ACTIVE_YEAR')||'2027/2028')};

  const regs = sheetRows_(regSheet).filter(x => String(x.userId) === String(actor.userId));
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '2027/2028');
  const yearItems = getActiveMasterItems_('MASTER_TAHUN_AJARAN');
  const activeYearId = yearItems.find(x => String(x.name) === activeYear)?.tahunAjaranId || '';
  const activeRegs = activeYearId ? regs.filter(x => String(x.tahunAjaranId) === String(activeYearId)) : regs;

  const bills = sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS));
  const payments = sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENTS));
  const paymentTypes = {};
  getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN').forEach(x => paymentTypes[String(x.paymentTypeId)] = x);
  const paymentByBill = {};
  payments.forEach(x => paymentByBill[String(x.billId)] = x);
  const participants = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS));
  const results = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS));
  const schedules = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE));
  const candidates = sheetMapById_(ss.getSheetByName(PSB_SHEETS.CANDIDATES), 'candidateId');

  const items = activeRegs.map(reg => {
    const candidate = candidates[String(reg.candidateId)] || {};
    const regBills = bills.filter(b => String(b.registrationId) === String(reg.registrationId));
    const formBill = regBills.find(b => /formulir/i.test(String(paymentTypes[String(b.paymentTypeId)]?.name || '')));
    const formPayment = formBill ? paymentByBill[String(formBill.billId)] : null;
    const formPaid = String(reg.status).toUpperCase() === 'PAYMENT_VERIFIED' || String(formBill?.status).toUpperCase() === 'PAID' || String(formPayment?.status).toUpperCase() === 'VERIFIED';
    const participant = participants.find(x => String(x.registrationId) === String(reg.registrationId));
    const result = results.find(x => String(x.registrationId) === String(reg.registrationId));
    const published = !!String(result?.announcementDate || '').trim();
    const resultStatus = String(result?.status || '').toUpperCase();
    const registrationStatus = String(reg.status || '').toUpperCase();

    let completed = 0;
    if (!['DRAFT','REVISION'].includes(registrationStatus)) completed = 1;
    if (['VERIFIED','PAYMENT_VERIFIED','SELECTION','PASSED','NOT_PASSED','REREGISTRATION','COMPLETED'].includes(registrationStatus) || formPaid) completed = Math.max(completed, 2);
    if (formPaid) completed = Math.max(completed, 3);
    if (participant && (result || ['COMPLETED','PRESENT','ABSENT'].includes(String(participant.status).toUpperCase()))) completed = Math.max(completed, 4);
    if (published) completed = Math.max(completed, 5);

    let next = {key:'registration', title:'Lengkapi Pendaftaran', description:'Lengkapi data calon santri lalu kirim pendaftaran untuk diverifikasi.', button:'Lanjutkan Pendaftaran'};
    if (registrationStatus === 'REVISION') next = {key:'registration', title:'Perbaiki Pendaftaran', description:'Ada data pendaftaran yang perlu diperbaiki sebelum dapat diproses kembali.', button:'Perbaiki Pendaftaran'};
    else if (registrationStatus === 'DRAFT') next = {key:'registration', title:'Lanjutkan Pendaftaran', description:'Pendaftaran masih berupa draft dan belum dikirim.', button:'Lanjutkan Pendaftaran'};
    else if (registrationStatus === 'SUBMITTED' || registrationStatus === 'UNDER_REVIEW') next = {key:'registration', title:'Menunggu Verifikasi', description:'Pendaftaran sudah dikirim. Tunggu pemeriksaan petugas.', button:'Lihat Pendaftaran'};
    else if (registrationStatus === 'VERIFIED' && !formPaid) next = {key:'payments', title:'Pembayaran Formulir', description:'Pendaftaran sudah terverifikasi. Lanjutkan pembayaran formulir.', button:'Buka Pembayaran'};
    else if (formPaid && !participant) next = {key:'selection', title:'Menunggu / Persiapan Tes', description:'Pembayaran formulir sudah terverifikasi. Pastikan mengikuti jadwal tes.', button:'Buka Tes'};
    else if (participant && !result) next = {key:'selection', title:'Ikuti Tes Seleksi', description:'Anda sudah terdaftar sebagai peserta. Periksa jadwal dan status tes.', button:'Buka Tes'};
    else if (result && !published) next = {key:'announcement', title:'Menunggu Pengumuman', description:'Hasil seleksi sudah ditetapkan dan menunggu dipublikasikan.', button:'Buka Pengumuman'};
    else if (published && resultStatus === 'PASSED') next = {key:'announcement', title:'Lulus — Lanjut Daftar Ulang', description:'Hasil sudah diumumkan. Tahap berikutnya adalah Daftar Ulang.', button:'Lihat Pengumuman'};
    else if (published && resultStatus === 'WAITLIST') next = {key:'announcement', title:'Cadangan', description:'Hasil sudah diumumkan sebagai cadangan. Periksa informasi pengumuman secara berkala.', button:'Lihat Pengumuman'};
    else if (published && resultStatus === 'NOT_PASSED') next = {key:'announcement', title:'Hasil Seleksi Sudah Diumumkan', description:'Lihat detail hasil seleksi pada menu Pengumuman.', button:'Lihat Pengumuman'};

    return {
      registrationId:String(reg.registrationId), registrationNumber:String(reg.registrationNumber || reg.registrationId || '-'),
      candidateName:String(candidate.fullName || candidate.name || 'Calon Santri'), status:registrationStatus,
      statusLabel:statusLabel_(registrationStatus), completed, next, formPaid,
      participant:participant ? {status:String(participant.status||''), scheduleId:String(participant.scheduleId||''), scheduleName:String(schedules.find(x=>String(x.scheduleId)===String(participant.scheduleId))?.name || '')} : null,
      result:result ? {status:resultStatus, published, announcementDate:result.announcementDate||'', note:result.note||''} : null
    };
  });
  return {success:true,registrations:items,activeYear};
}

function statusLabel_(s) {
  return ({DRAFT:'Draft',SUBMITTED:'Menunggu verifikasi',UNDER_REVIEW:'Sedang diverifikasi',REVISION:'Perlu perbaikan',VERIFIED:'Terverifikasi',PAYMENT_PENDING:'Menunggu pembayaran',PAYMENT_VERIFIED:'Pembayaran terverifikasi',SELECTION:'Seleksi',PASSED:'Lulus',NOT_PASSED:'Tidak lulus',REREGISTRATION:'Daftar ulang',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'})[String(s||'').toUpperCase()] || String(s||'-');
}

function getMyRegistrations(sessionToken) {
  const user = requireRole_(sessionToken, ['WALI','SUPERADMIN','ADMIN_PSB']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  if (!sheet || sheet.getLastRow() < 2) return { success:true, registrations:[] };
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  const items = rows.map((r,i) => rowObject_(headers,r,i+2)).filter(x => String(x.userId) === String(user.userId));
  return { success:true, registrations: enrichRegistrationList_(items) };
}

function getRegistrationList(sessionToken, filters) {
  const user = requireRole_(sessionToken, PSB_REGISTRATION_ADMIN_ROLES);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  if (!sheet || sheet.getLastRow() < 2) return { success:true, registrations:[] };
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  let items = rows.map((r,i) => rowObject_(headers,r,i+2));
  filters = filters || {};
  if (filters.status) items = items.filter(x => String(x.status) === String(filters.status));
  if (filters.tahunAjaranId) items = items.filter(x => String(x.tahunAjaranId) === String(filters.tahunAjaranId));
  return { success:true, registrations: enrichRegistrationList_(items).slice(0,200) };
}

function getRegistrationDetail(sessionToken, registrationId) {
  const result = getSessionUser_(sessionToken, true);
  if (!result.success) return result;
  const user = result.user;
  const reg = findRegistration_(String(registrationId || ''));
  if (!reg) return fail_('Pendaftaran tidak ditemukan.');
  const roles = String(user.role || '').split(',').map(x => x.trim().toUpperCase());
  const canView = roles.some(r => PSB_REGISTRATION_ADMIN_ROLES.indexOf(r) >= 0) || (roles.indexOf('WALI') >= 0 && String(reg.registration.userId) === String(user.userId));
  if (!canView) return fail_('Anda tidak memiliki akses ke pendaftaran ini.');
  return { success:true, registration:reg.registration, candidate:reg.candidate, guardian:reg.guardian, address:reg.address, school:reg.school };
}



// =====================================================
// STAGE 7 - PEMBAYARAN
// =====================================================
const PSB_PAYMENT_VIEW_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','KEUANGAN'];
const PSB_PAYMENT_MANAGE_ROLES = ['SUPERADMIN','ADMIN_PSB','KEUANGAN'];
const PSB_PAYMENT_EDITABLE_STATUSES = ['SUBMITTED','UNDER_REVIEW','REVISION','VERIFIED'];

function getPaymentPageData(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_PAYMENT_VIEW_ROLES);
  const isWali = hasRoleDirect_(actor, ['WALI']);
  const regSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  let registrations = [];
  if (regSheet && regSheet.getLastRow() >= 2) {
    const headers = regSheet.getRange(1,1,1,regSheet.getLastColumn()).getValues()[0].map(String);
    const rows = regSheet.getRange(2,1,regSheet.getLastRow()-1,regSheet.getLastColumn()).getValues();
    let items = rows.map((r,i)=>rowObject_(headers,r,i+2));
    if (isWali) items = items.filter(x=>String(x.userId)===String(actor.userId));
    registrations = enrichRegistrationList_(items).slice(0,200);
  }
  if (!registrations.length) return {success:true,registrations:[],paymentData:null,paymentTypes:getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN')};
  const selectedId = String(registrationId||'');
  const selected = registrations.some(x=>String(x.registrationId)===selectedId) ? selectedId : String(registrations[0].registrationId);
  const found = findRegistration_(selected);
  if (!found || !canAccessRegistration_(actor,found.registration) && !hasRoleDirect_(actor,PSB_PAYMENT_MANAGE_ROLES)) return fail_('Anda tidak memiliki akses ke pembayaran ini.');
  return {success:true,registrations,paymentData:buildPaymentData_(selected),paymentTypes:getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN')};
}

function getPaymentsForRegistration(sessionToken, registrationId) {
  const actor=requireRole_(sessionToken,PSB_PAYMENT_VIEW_ROLES);
  const found=findRegistration_(String(registrationId||''));
  if(!found) return fail_('Pendaftaran tidak ditemukan.');
  if(!canAccessRegistration_(actor,found.registration) && !hasRoleDirect_(actor,PSB_PAYMENT_MANAGE_ROLES)) return fail_('Anda tidak memiliki akses ke pembayaran ini.');
  return Object.assign({success:true},buildPaymentData_(registrationId));
}

function buildPaymentData_(registrationId) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const billsSheet=ss.getSheetByName(PSB_SHEETS.BILLS), paymentsSheet=ss.getSheetByName(PSB_SHEETS.PAYMENTS);
  const bills=billsSheet&&billsSheet.getLastRow()>=2 ? sheetRows_(billsSheet).filter(x=>String(x.registrationId)===String(registrationId)) : [];
  const payments=paymentsSheet&&paymentsSheet.getLastRow()>=2 ? sheetRows_(paymentsSheet).filter(x=>String(x.registrationId)===String(registrationId)) : [];
  const types={}; getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN').forEach(x=>types[String(x.paymentTypeId)]=x);
  const paymentByBill={}; payments.forEach(x=>{paymentByBill[String(x.billId)]=x;});
  const items=bills.map(b=>Object.assign({},b,{paymentTypeName:types[String(b.paymentTypeId)]?.name||b.paymentTypeId,payment:paymentByBill[String(b.billId)]||null}));
  return {registrationId:String(registrationId),bills:items,payments};
}

function createBill(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_PAYMENT_MANAGE_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const registrationId=String(payload.registrationId||'').trim(), paymentTypeId=String(payload.paymentTypeId||'').trim();
  const amount=Number(payload.amount||0), dueDate=String(payload.dueDate||'').trim();
  if(!registrationId||!paymentTypeId) return fail_('Pendaftaran dan jenis pembayaran wajib dipilih.');
  if(!(amount>0) || !isFinite(amount)) return fail_('Nominal tagihan harus lebih dari 0.');
  const found=findRegistration_(registrationId); if(!found) return fail_('Pendaftaran tidak ditemukan.');
  const type=findMasterItemById_('MASTER_JENIS_PEMBAYARAN','paymentTypeId',paymentTypeId); if(!type||!type.isActive) return fail_('Jenis pembayaran tidak aktif.');
  return withScriptLock_(10000, function(){
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.BILLS); if(!sheet) return fail_('Sheet BILLS belum tersedia.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows=sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  const dup=rows.some(r=>String(r[headers.indexOf('registrationId')])===registrationId&&String(r[headers.indexOf('paymentTypeId')])===paymentTypeId&&String(r[headers.indexOf('status')])!=='CANCELLED');
  if(dup) return fail_('Tagihan untuk jenis pembayaran ini sudah ada.');
  const now=new Date(), billId=generateId_('BIL'), record={}; headers.forEach(h=>record[h]='');
  Object.assign(record,{billId,registrationId,paymentTypeId,amount,dueDate,status:'UNPAID',createdAt:now,updatedAt:now});
  sheet.appendRow(headers.map(h=>record[h]));
  writeAudit_(actor.userId,'CREATE','PAYMENT',billId,'',JSON.stringify(record),'Tagihan pembayaran dibuat');
  return {success:true,message:'Tagihan berhasil dibuat.',bill:JSON.parse(JSON.stringify(record))};
  });
}

function submitPayment(sessionToken,payload){
  const actor=requireRole_(sessionToken,['WALI','SUPERADMIN','ADMIN_PSB','KEUANGAN']);
  assertOperationalMutation_(actor); payload=payload||{};
  const billId=String(payload.billId||'').trim(), base64=String(payload.base64||'').trim(), fileName=sanitizeFileName_(payload.fileName||'bukti-pembayaran'), mimeType=String(payload.mimeType||'').toLowerCase();
  if(!billId||!base64) return fail_('Tagihan dan bukti pembayaran wajib diisi.');
  const bills=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.BILLS), br=findRowById_(bills,'billId',billId); if(!br) return fail_('Tagihan tidak ditemukan.');
  const found=findRegistration_(String(br.object.registrationId)); if(!found) return fail_('Pendaftaran tidak ditemukan.');
  if(!canAccessRegistration_(actor,found.registration) && !hasRoleDirect_(actor,PSB_PAYMENT_MANAGE_ROLES)) return fail_('Anda tidak memiliki akses ke tagihan ini.');
  if(String(br.object.status).toUpperCase()==='PAID') return fail_('Tagihan ini sudah lunas.');
  if(!/^image\/(jpeg|png|webp)$/i.test(mimeType) && mimeType!=='application/pdf') return fail_('Bukti pembayaran harus berupa JPG, PNG, WEBP, atau PDF.');
  const bytes=Utilities.base64Decode(base64); if(bytes.length>5*1024*1024) return fail_('Ukuran bukti pembayaran maksimal 5 MB.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const paymentSheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.PAYMENTS);
    if (!paymentSheet) return fail_('Sheet PAYMENTS belum tersedia.');
    const ph=paymentSheet.getRange(1,1,1,paymentSheet.getLastColumn()).getValues()[0].map(String);
    const prows=paymentSheet.getLastRow()<2?[]:paymentSheet.getRange(2,1,paymentSheet.getLastRow()-1,paymentSheet.getLastColumn()).getValues();
    const pBillIdx=ph.indexOf('billId'), pStatusIdx=ph.indexOf('status');
    if (prows.some(r=>String(r[pBillIdx])===billId && ['SUBMITTED','VERIFIED'].indexOf(String(r[pStatusIdx]).toUpperCase())>=0)) return fail_('Bukti pembayaran untuk tagihan ini sudah pernah dikirim dan sedang diproses.');
    const props=PropertiesService.getScriptProperties(); let yearFolder=null; const yearId=props.getProperty('PSB_DRIVE_YEAR_ID'); if(yearId){try{yearFolder=DriveApp.getFolderById(yearId)}catch(e){}}
    if(!yearFolder){const root=DriveApp.getFolderById(props.getProperty('PSB_DRIVE_ROOT_ID')); yearFolder=getOrCreateFolderInParent_(root,PSB_SETUP.YEAR_FOLDER_NAME);}
    const payRoot=getOrCreateFolderInParent_(yearFolder,'Bukti Pembayaran');
    const regFolder=getOrCreateFolderInParent_(payRoot,sanitizeFolderName_(found.registration.registrationNumber||found.registration.registrationId));
    const file=regFolder.createFile(Utilities.newBlob(bytes,mimeType,fileName));
    const sheet=paymentSheet;
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), now=new Date(), paymentId=generateId_('PAY'), record={}; headers.forEach(h=>record[h]='');
    Object.assign(record,{paymentId,billId,registrationId:br.object.registrationId,amount:Number(br.object.amount||0),method:'TRANSFER',proofFileId:file.getId(),proofFileUrl:file.getUrl(),status:'SUBMITTED',submittedAt:now,createdAt:now,updatedAt:now});
    sheet.appendRow(headers.map(h=>record[h]));
    const statusIdx=bills.getRange(1,1,1,bills.getLastColumn()).getValues()[0].map(String).indexOf('status'); if(statusIdx>=0)bills.getRange(br.rowNumber,statusIdx+1).setValue('PAYMENT_REVIEW');
    writeAudit_(actor.userId,'PAYMENT','PAYMENT',paymentId,'',JSON.stringify(record),'Bukti pembayaran diunggah');
    const paymentType=findMasterItemById_('MASTER_JENIS_PEMBAYARAN','paymentTypeId',String(br.object.paymentTypeId||''));
    const candidateName=String(found.candidate?.fullName||'calon santri');
    try {
      notifyUsersByRoles_(['SUPERADMIN','ADMIN_PSB','KEUANGAN'],'Bukti Pembayaran Baru',candidateName+' mengirim bukti '+String(paymentType?.name||'pembayaran')+' dan menunggu verifikasi.','INFO');
      if(String(actor.role||'').toUpperCase()==='WALI') notifyRegistrationOwner_(found.registration.registrationId,'Bukti Pembayaran Terkirim','Bukti '+String(paymentType?.name||'pembayaran')+' berhasil dikirim dan menunggu verifikasi.','SUCCESS');
    } catch(notificationError) {
      console.error('Payment notification failed after payment was saved: '+notificationError);
    }
    return {success:true,message:'Bukti pembayaran berhasil dikirim dan menunggu verifikasi.',payment:rpcSafe_(record)};
  }catch(e){return fail_('Gagal menyimpan bukti pembayaran.')}finally{lock.releaseLock();}
}

function verifyPayment(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_PAYMENT_MANAGE_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const paymentId=String(payload.paymentId||'').trim(), status=String(payload.status||'').toUpperCase(), note=String(payload.note||'').trim();
  if(!paymentId||['VERIFIED','REJECTED'].indexOf(status)<0) return fail_('Data verifikasi pembayaran tidak valid.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.PAYMENTS), found=findRowById_(sheet,'paymentId',paymentId); if(!found) return fail_('Pembayaran tidak ditemukan.');
  if (['VERIFIED','REJECTED'].indexOf(String(found.object.status||'').toUpperCase())>=0) return fail_('Pembayaran ini sudah diverifikasi sebelumnya.');
  const regFound=findRegistration_(String(found.object.registrationId||'')); if(!regFound) return fail_('Pendaftaran pembayaran tidak ditemukan.');
  const now=new Date(), headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String); ['status','updatedAt'].forEach(k=>{const i=headers.indexOf(k);if(i>=0)sheet.getRange(found.rowNumber,i+1).setValue(k==='status'?status:now);});
  const verSheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.PAYMENT_VERIFICATIONS); if(verSheet){const vh=verSheet.getRange(1,1,1,verSheet.getLastColumn()).getValues()[0].map(String);const rec={};vh.forEach(h=>rec[h]='');Object.assign(rec,{verificationId:generateId_('PVF'),paymentId,status,verifiedBy:actor.userId,verifiedAt:now,note});verSheet.appendRow(vh.map(h=>rec[h]));}
  const bills=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.BILLS), br=findRowById_(bills,'billId',found.object.billId); if(br){const bh=bills.getRange(1,1,1,bills.getLastColumn()).getValues()[0].map(String);const i=bh.indexOf('status');if(i>=0)bills.getRange(br.rowNumber,i+1).setValue(status==='VERIFIED'?'PAID':'UNPAID'); if(status==='VERIFIED'){const type=findMasterItemById_('MASTER_JENIS_PEMBAYARAN','paymentTypeId',br.object.paymentTypeId); if(/formulir/i.test(String(type?.name||''))){const reg=findRegistration_(String(br.object.registrationId)); if(reg && String(reg.registration.status)==='VERIFIED'){setRegistrationStatus_(reg.registration,'PAYMENT_VERIFIED',actor.userId,'Pembayaran Formulir terverifikasi; pendaftar dapat mengikuti proses tes.');}} if(/daftar\s*ulang/i.test(String(type?.name||''))){syncReregistrationAfterPayment_(String(br.object.registrationId),actor.userId);}}}
  writeAudit_(actor.userId,'PAYMENT_VERIFY','PAYMENT',paymentId,'',JSON.stringify({status,note}),'Pembayaran diverifikasi');
  const paymentType=findMasterItemById_('MASTER_JENIS_PEMBAYARAN','paymentTypeId',String(br?.object?.paymentTypeId||''));
  const paymentLabel=String(paymentType?.name||'pembayaran');
  notifyRegistrationOwner_(String(found.registration.registrationId),'Pembayaran '+(status==='VERIFIED'?'Terverifikasi':'Ditolak'),status==='VERIFIED'?('Pembayaran '+paymentLabel+' telah terverifikasi.'):('Pembayaran '+paymentLabel+' ditolak.'+(note?' Catatan: '+note:'')),status==='VERIFIED'?'SUCCESS':'WARNING');
  return {success:true,message:status==='VERIFIED'?'Pembayaran berhasil diverifikasi.':'Pembayaran ditolak dan dapat diunggah ulang.'};
  } finally { lock.releaseLock(); }
}



// =====================================================
// STAGE 8 - TES & SELEKSI
// =====================================================
const PSB_SELECTION_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB','SELEKSI'];
const PSB_SELECTION_VIEW_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'];

function getSelectionPageData(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_SELECTION_VIEW_ROLES);
  const isWali = hasRoleDirect_(actor, ['WALI']);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  let registrations = [];
  if (regSheet && regSheet.getLastRow() >= 2) {
    const headers = regSheet.getRange(1,1,1,regSheet.getLastColumn()).getValues()[0].map(String);
    const rows = regSheet.getRange(2,1,regSheet.getLastRow()-1,regSheet.getLastColumn()).getValues();
    let items = rows.map((r,i)=>rowObject_(headers,r,i+2));
    if (isWali) items = items.filter(x=>String(x.userId)===String(actor.userId));
    registrations = enrichRegistrationList_(items).slice(0,300);
  }
  const activeYearId = String(getConfig_('ACTIVE_YEAR_ID') || '').trim();
  const activeYearName = String(getConfig_('ACTIVE_YEAR') || '').trim();
  const activeYear = activeYearId ? findMasterItemById_('MASTER_TAHUN_AJARAN','tahunAjaranId',activeYearId) : getActiveMasterItems_('MASTER_TAHUN_AJARAN').find(x=>String(x.name)===activeYearName);
  const yearId = String(activeYear?.tahunAjaranId || activeYearId || '');
  const schedules = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE))
    .filter(x=>x.isActive===true || String(x.isActive).toUpperCase()==='TRUE')
    .filter(x=>!yearId || String(x.tahunAjaranId)===yearId)
    .sort((a,b)=>String(a.selectionDate||'').localeCompare(String(b.selectionDate||'')));
  const participants = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS));
  const scores = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCORES));
  const results = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS));
  const candidateMap = sheetMapById_(ss.getSheetByName(PSB_SHEETS.CANDIDATES),'candidateId');
  const regMap = {}; registrations.forEach(r=>regMap[String(r.registrationId)]=r);
  const participantItems = participants.filter(p=>regMap[String(p.registrationId)] || !isWali).map(p=>Object.assign({},p,{registration:regMap[String(p.registrationId)]||null,candidateName:regMap[String(p.registrationId)]?.candidateName || candidateMap[findRegistration_(String(p.registrationId))?.registration?.candidateId]?.fullName || '-'}));
  // WALI hanya boleh menerima nilai/hasil milik pendaftarannya sendiri.
  // Jangan pernah mengirim seluruh SELECTION_SCORES/RESULTS ke browser Wali.
  const visibleScores = isWali
    ? scores.filter(x => participantItems.some(p => String(p.participantId) === String(x.participantId)))
    : scores;
  const visibleResults = isWali
    ? results.filter(x => regMap[String(x.registrationId)])
    : results;
  const selectedId = String(registrationId||'');
  let detail = null;
  if(selectedId){
    const found = findRegistration_(selectedId);
    if(!found) return fail_('Pendaftaran tidak ditemukan.');
    if(!canAccessRegistration_(actor,found.registration) && !hasRoleDirect_(actor,PSB_SELECTION_ADMIN_ROLES)) return fail_('Anda tidak memiliki akses ke proses seleksi ini.');
    const participant = participants.find(x=>String(x.registrationId)===selectedId) || null;
    detail = {registration:enrichRegistrationList_([found.registration])[0],participant,scores:participant? scores.filter(x=>String(x.participantId)===String(participant.participantId)):[],result:results.find(x=>String(x.registrationId)===selectedId)||null};
  }
  return {success:true,registrations,schedules,participants:participantItems,scores:visibleScores,results:visibleResults,detail};
}

function createSelectionSchedule(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const configuredYearId=String(getConfig_('ACTIVE_YEAR_ID')||'').trim(), configuredYearName=String(getConfig_('ACTIVE_YEAR')||'').trim();
  const activeYear=configuredYearId ? findMasterItemById_('MASTER_TAHUN_AJARAN','tahunAjaranId',configuredYearId) : getActiveMasterItems_('MASTER_TAHUN_AJARAN').find(x=>String(x.name)===configuredYearName);
  const tahunAjaranId=String(payload.tahunAjaranId||activeYear?.tahunAjaranId||'').trim();
  const name=clean_(payload.name), selectionDate=clean_(payload.selectionDate), location=clean_(payload.location);
  if(!tahunAjaranId||!name||!selectionDate) return fail_('Tahun ajaran, nama tes, dan tanggal tes wajib diisi.');
  const year=findMasterItemById_('MASTER_TAHUN_AJARAN','tahunAjaranId',tahunAjaranId); if(!year||!year.isActive)return fail_('Tahun ajaran tidak aktif atau tidak ditemukan.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE); if(!sheet)return fail_('Sheet jadwal seleksi belum tersedia.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), now=new Date(), record={}; headers.forEach(h=>record[h]='');
  Object.assign(record,{scheduleId:generateId_('SCH'),tahunAjaranId,name,selectionDate,location,isActive:true,createdAt:now,updatedAt:now});
  sheet.appendRow(headers.map(h=>record[h]));
  writeAudit_(actor.userId,'CREATE','SELECTION_SCHEDULE',record.scheduleId,'',JSON.stringify(record),'Jadwal tes dibuat');
  return {success:true,message:'Jadwal tes berhasil dibuat.',schedule:rpcSafe_(record)};
}

function updateSelectionScheduleStatus(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const scheduleId=String(payload.scheduleId||'').trim(), isActive=!!payload.isActive;
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE), found=findRowById_(sheet,'scheduleId',scheduleId);
  if(!found)return fail_('Jadwal tes tidak ditemukan.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), idx=headers.indexOf('isActive'), up=headers.indexOf('updatedAt');
  if(idx>=0)sheet.getRange(found.rowNumber,idx+1).setValue(isActive); if(up>=0)sheet.getRange(found.rowNumber,up+1).setValue(new Date());
  writeAudit_(actor.userId,'UPDATE','SELECTION_SCHEDULE',scheduleId,JSON.stringify({isActive:found.object.isActive}),JSON.stringify({isActive}),'Status jadwal tes diperbarui');
  return {success:true,message:isActive?'Jadwal diaktifkan.':'Jadwal dinonaktifkan.'};
}

function addSelectionParticipant(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const registrationId=String(payload.registrationId||'').trim(), scheduleId=String(payload.scheduleId||'').trim();
  if(!registrationId||!scheduleId)return fail_('Pendaftaran dan jadwal tes wajib dipilih.');
  const found=findRegistration_(registrationId); if(!found)return fail_('Pendaftaran tidak ditemukan.');
  if(!isRegistrationSelectionEligible_(registrationId))return fail_('Pendaftar belum memenuhi syarat mengikuti tes. Pastikan verifikasi pendaftaran dan Pembayaran Formulir sudah selesai.');
  const schedule=findRowById_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE),'scheduleId',scheduleId); if(!schedule)return fail_('Jadwal tes tidak ditemukan.');
  if(!schedule.object.isActive && String(schedule.object.isActive).toUpperCase()!=='TRUE')return fail_('Jadwal tes tidak aktif.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS);
  const rows=sheetRows_(sheet); const duplicate=rows.find(x=>String(x.registrationId)===registrationId);
  if(duplicate){
    if(String(duplicate.scheduleId)===scheduleId)return fail_('Pendaftar sudah terdaftar pada jadwal ini.');
    return fail_('Pendaftar sudah memiliki jadwal tes.');
  }
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), now=new Date(), record={}; headers.forEach(h=>record[h]='');
  Object.assign(record,{participantId:generateId_('PTC'),registrationId,scheduleId,status:'SCHEDULED',createdAt:now,updatedAt:now});
  sheet.appendRow(headers.map(h=>record[h]));
  writeAudit_(actor.userId,'CREATE','SELECTION_PARTICIPANT',record.participantId,'',JSON.stringify(record),'Peserta tes ditambahkan');
  const scheduleName=String(schedule.object.name||'Tes Seleksi'), selectionDate=String(schedule.object.selectionDate||'');
  notifyRegistrationOwner_(registrationId,'Jadwal Tes Seleksi Ditentukan','Anda terdaftar pada '+scheduleName+(selectionDate?' pada '+selectionDate:'')+(schedule.object.location?' di '+String(schedule.object.location):'')+'. Silakan buka menu Tes untuk detail.','INFO');
  return {success:true,message:'Peserta berhasil ditambahkan ke jadwal tes.',participant:rpcSafe_(record)};
}

function addSelectionParticipantsBulk(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const registrationIds=Array.isArray(payload.registrationIds)?payload.registrationIds.map(x=>String(x||'').trim()).filter(Boolean):[];
  const scheduleId=String(payload.scheduleId||'').trim();
  if(!registrationIds.length)return fail_('Pilih minimal satu pendaftar.');
  if(!scheduleId)return fail_('Jadwal tes wajib dipilih.');
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const scheduleSheet=ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE), schedule=findRowById_(scheduleSheet,'scheduleId',scheduleId);
  if(!schedule)return fail_('Jadwal tes tidak ditemukan.');
  if(!schedule.object.isActive && String(schedule.object.isActive).toUpperCase()!=='TRUE')return fail_('Jadwal tes tidak aktif.');
  const sheet=ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS); if(!sheet)return fail_('Sheet peserta seleksi belum tersedia.');
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), rows=sheetRows_(sheet);
    const existing={}; rows.forEach(x=>{existing[String(x.registrationId)]=x});
    const added=[], skipped=[], failed=[];
    registrationIds.forEach(registrationId=>{
      try{
        if(existing[registrationId]){skipped.push({registrationId,reason:String(existing[registrationId].scheduleId)===scheduleId?'Sudah terdaftar pada jadwal ini.':'Sudah memiliki jadwal tes.'});return}
        const found=findRegistration_(registrationId);
        if(!found){failed.push({registrationId,reason:'Pendaftaran tidak ditemukan.'});return}
        if(!isRegistrationSelectionEligible_(registrationId)){failed.push({registrationId,reason:'Belum memenuhi syarat verifikasi dan Pembayaran Formulir.'});return}
        const now=new Date(), record={}; headers.forEach(h=>record[h]='');
        Object.assign(record,{participantId:generateId_('PTC'),registrationId,scheduleId,status:'SCHEDULED',createdAt:now,updatedAt:now});
        sheet.appendRow(headers.map(h=>record[h]));
        existing[registrationId]=record; added.push(record);
      }catch(e){failed.push({registrationId,reason:String(e&&e.message||e)})}
    });
    added.forEach(record=>writeAudit_(actor.userId,'CREATE','SELECTION_PARTICIPANT',record.participantId,'',JSON.stringify(record),'Peserta tes dibuat melalui Generate Tes Seleksi'));
    const scheduleName=String(schedule.object.name||'Tes Seleksi'), selectionDate=String(schedule.object.selectionDate||'');
    added.forEach(record=>notifyRegistrationOwner_(record.registrationId,'Jadwal Tes Seleksi Ditentukan','Anda terdaftar pada '+scheduleName+(selectionDate?' pada '+selectionDate:'')+(schedule.object.location?' di '+String(schedule.object.location):'')+'. Silakan buka menu Tes untuk detail.','INFO'));
    return {success:true,message:`Generate selesai: ${added.length} peserta ditambahkan, ${skipped.length} dilewati, ${failed.length} gagal.`,addedCount:added.length,skippedCount:skipped.length,failedCount:failed.length,added:rpcSafe_(added),skipped:rpcSafe_(skipped),failed:rpcSafe_(failed)};
  }finally{lock.releaseLock()}
}

function updateSelectionParticipantStatus(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const participantId=String(payload.participantId||'').trim(), status=String(payload.status||'').toUpperCase();
  if(!['SCHEDULED','PRESENT','ABSENT','COMPLETED'].includes(status))return fail_('Status peserta tidak valid.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS), found=findRowById_(sheet,'participantId',participantId); if(!found)return fail_('Peserta tes tidak ditemukan.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), idx=headers.indexOf('status'), up=headers.indexOf('updatedAt');
  if(idx>=0)sheet.getRange(found.rowNumber,idx+1).setValue(status); if(up>=0)sheet.getRange(found.rowNumber,up+1).setValue(new Date());
  writeAudit_(actor.userId,'UPDATE','SELECTION_PARTICIPANT',participantId,JSON.stringify({status:found.object.status}),JSON.stringify({status}),'Status peserta tes diperbarui');
  return {success:true,message:'Status peserta diperbarui.'};
}

function saveSelectionScore(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const participantId=String(payload.participantId||'').trim(), component=clean_(payload.component), note=clean_(payload.note);
  const score=Number(payload.score);
  if(!participantId||!component||!Number.isFinite(score)||score<0||score>100)return fail_('Peserta, komponen nilai, dan nilai 0–100 wajib diisi.');
  const ps=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS), participant=findRowById_(ps,'participantId',participantId); if(!participant)return fail_('Peserta tes tidak ditemukan.');
  const publishedResult=findRowById_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_RESULTS),'registrationId',String(participant.object.registrationId||''));
  if(publishedResult && String(publishedResult.object.announcementDate||'').trim()!=='')return fail_('Nilai tidak dapat diubah setelah hasil seleksi dipublikasikan.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_SCORES), headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), rows=sheetRows_(sheet), existing=rows.find(x=>String(x.participantId)===participantId&&String(x.component).trim().toLowerCase()===component.toLowerCase()), now=new Date();
  const record=existing?Object.assign({},existing,{score,note,updatedAt:now}):{scoreId:generateId_('SCR'),participantId,component,score,note,createdAt:now,updatedAt:now};
  upsertById_(sheet,'scoreId',record.scoreId,record);
  writeAudit_(actor.userId,existing?'UPDATE':'CREATE','SELECTION_SCORE',record.scoreId,existing?JSON.stringify(existing):'',JSON.stringify(record),'Nilai seleksi disimpan');
  return {success:true,message:'Nilai seleksi berhasil disimpan.',score:rpcSafe_(record)};
}

function saveSelectionResult(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_SELECTION_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const registrationId=String(payload.registrationId||'').trim(), status=String(payload.status||'').toUpperCase(), note=clean_(payload.note);
  if(!registrationId||!['PENDING','PASSED','NOT_PASSED','WAITLIST'].includes(status))return fail_('Pendaftaran dan hasil seleksi wajib diisi.');
  const found=findRegistration_(registrationId); if(!found)return fail_('Pendaftaran tidak ditemukan.');
  const participant=findRowById_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS),'registrationId',registrationId); if(!participant)return fail_('Pendaftar belum terdaftar sebagai peserta tes.');

  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_RESULTS);
    if(!sheet)return fail_('Sheet hasil seleksi belum tersedia.');
    const rows=sheetRows_(sheet), existing=rows.find(x=>String(x.registrationId)===registrationId), now=new Date();
    if(existing && String(existing.announcementDate||'').trim()!=='')return fail_('Hasil seleksi tidak dapat diubah setelah dipublikasikan.');

    // Peserta lama dapat masih berada pada VERIFIED/PAYMENT_VERIFIED.
    // Saat hasil pertama kali disimpan, normalkan status pendaftaran ke SELECTION.
    const currentStatus=String(found.registration.status||'').toUpperCase();
    if(!['VERIFIED','PAYMENT_VERIFIED','SELECTION','PASSED'].includes(currentStatus))return fail_('Pendaftaran belum berada pada tahap hasil seleksi.');
    // Defense-in-depth: direct RPC calls must pass the same eligibility rule
    // used when generating the selection participant. This closes a gap where
    // a crafted request could try to write a result for a merely VERIFIED record.
    if((currentStatus==='VERIFIED' || currentStatus==='PAYMENT_VERIFIED') && !isRegistrationSelectionEligible_(registrationId))return fail_('Pendaftar belum memenuhi syarat mengikuti tes. Pastikan verifikasi pendaftaran dan Pembayaran Formulir sudah selesai.');
    if(currentStatus==='VERIFIED' || currentStatus==='PAYMENT_VERIFIED'){
      const moved=setRegistrationStatus_(found.registration,'SELECTION',actor.userId,'Pendaftaran masuk tahap penetapan hasil seleksi.');
      if(!moved?.success)return moved;
    }

    const record=existing?Object.assign({},existing,{status,announcementDate:existing.announcementDate||'',note,updatedAt:now}):{resultId:generateId_('RES'),registrationId,status,announcementDate:'',note,createdAt:now,updatedAt:now};
    upsertById_(sheet,'resultId',record.resultId,record);

    // Read-back verification prevents a false success when the sheet write did not persist.
    const savedRows=sheetRows_(sheet);
    const saved=savedRows.find(x=>String(x.resultId)===String(record.resultId) && String(x.registrationId)===registrationId);
    if(!saved || String(saved.status||'').toUpperCase()!==status)return fail_('Hasil seleksi belum tersimpan. Silakan coba lagi.');

    writeAudit_(actor.userId,existing?'UPDATE':'CREATE','SELECTION_RESULT',record.resultId,existing?JSON.stringify(existing):'',JSON.stringify(saved),'Hasil seleksi disimpan');
    return {success:true,message:'Hasil seleksi berhasil disimpan.',result:rpcSafe_(saved)};
  }finally{try{lock.releaseLock();}catch(e){}}
}

function isRegistrationSelectionEligible_(registrationId){
  const found=findRegistration_(registrationId); if(!found)return false;
  const status=String(found.registration.status||'').toUpperCase();
  if(status==='PAYMENT_VERIFIED')return true;
  // Compatibility for existing records that were verified before Stage 8.
  if(status!=='VERIFIED')return false;
  const ss=SpreadsheetApp.getActiveSpreadsheet(), bills=sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS)), types={};
  getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN').forEach(x=>types[String(x.paymentTypeId)]=x);
  return bills.some(b=>String(b.registrationId)===String(registrationId)&&String(b.status).toUpperCase()==='PAID'&&/formulir/i.test(String(types[String(b.paymentTypeId)]?.name||'')));
}

function sheetRows_(sheet){
  if(!sheet || sheet.getLastRow()<2)return [];
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues().map((r,i)=>rowObject_(headers,r,i+2));
}


// =====================================================
// STAGE 9 - PENGUMUMAN
// =====================================================
const PSB_ANNOUNCEMENT_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB','SELEKSI'];
const PSB_ANNOUNCEMENT_VIEW_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'];

function getAnnouncementPageData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_ANNOUNCEMENT_VIEW_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultSheet = ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS);
  const rows = resultSheet && resultSheet.getLastRow() >= 2 ? sheetRows_(resultSheet) : [];
  const registrations = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '2027/2028');
  const yearItems = getActiveMasterItems_('MASTER_TAHUN_AJARAN');
  const activeYearId = yearItems.find(x=>String(x.name)===activeYear)?.tahunAjaranId || '';
  const visible = rows.filter(r=>{
    const found = findRegistration_(String(r.registrationId||''));
    if (!found) return false;
    if (activeYearId && String(found.registration.tahunAjaranId)!==String(activeYearId)) return false;
    if (hasRoleDirect_(actor,['WALI'])) return String(found.registration.userId)===String(actor.userId) && String(r.announcementDate||'').trim()!=='';
    return true;
  });
  const items = visible.map(r=>{
    const found=findRegistration_(String(r.registrationId||''));
    const reg=found?.registration||{}; const c=found?.candidate||{};
    return Object.assign({},r,{candidateName:c.fullName||c.name||'-',registrationNumber:reg.registrationNumber||reg.registrationId||'-',userId:reg.userId||'',isPublished:String(r.announcementDate||'').trim()!==''});
  }).sort((a,b)=>String(b.announcementDate||b.updatedAt||'').localeCompare(String(a.announcementDate||a.updatedAt||'')));
  return {success:true,items,canPublish:hasRoleDirect_(actor,PSB_ANNOUNCEMENT_ADMIN_ROLES),activeYear};
}

function publishAnnouncement(sessionToken,payload) {
  const actor = requireRole_(sessionToken, PSB_ANNOUNCEMENT_ADMIN_ROLES);
  assertOperationalMutation_(actor); payload=payload||{};
  const registrationId=String(payload.registrationId||'').trim();
  if(!registrationId) return fail_('Pendaftaran wajib dipilih.');
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const resultSheet=ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS);
  const found=findRowById_(resultSheet,'registrationId',registrationId);
  if(!found) return fail_('Hasil seleksi belum tersedia.');
  const status=String(found.object.status||'').toUpperCase();
  if(!['PASSED','NOT_PASSED','WAITLIST'].includes(status)) return fail_('Hasil masih menunggu keputusan dan belum dapat diumumkan.');
  const regFound=findRegistration_(registrationId); if(!regFound) return fail_('Pendaftaran tidak ditemukan.');
  if(!['SELECTION','PASSED'].includes(String(regFound.registration.status||'').toUpperCase())) return fail_('Pendaftaran belum berada pada tahap yang dapat diumumkan.');
  const now=new Date();
  const headers=resultSheet.getRange(1,1,1,resultSheet.getLastColumn()).getValues()[0].map(String);
  const dateIdx=headers.indexOf('announcementDate');
  if(dateIdx<0) return fail_('Kolom tanggal pengumuman belum tersedia.');
  const previous=found.object;
  if(String(previous.announcementDate||'').trim()!=='') return {success:true,message:'Pengumuman untuk pendaftar ini sudah dipublikasikan.',announcementDate:rpcSafe_(previous.announcementDate),result:rpcSafe_(previous),alreadyPublished:true};
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const latest=findRowById_(resultSheet,'registrationId',registrationId);
  if(!latest) return fail_('Hasil seleksi belum tersedia.');
  if(String(latest.object.announcementDate||'').trim()!=='') return {success:true,message:'Pengumuman untuk pendaftar ini sudah dipublikasikan.',announcementDate:rpcSafe_(latest.object.announcementDate),result:rpcSafe_(latest.object),alreadyPublished:true};
  const latestReg=findRegistration_(registrationId);
  if(!latestReg) return fail_('Pendaftaran tidak ditemukan.');
  if(!['SELECTION','PASSED'].includes(String(latestReg.registration.status||'').toUpperCase())) return fail_('Pendaftaran sudah berpindah tahap dan tidak dapat diumumkan dari status saat ini.');
  found=latest;
  resultSheet.getRange(found.rowNumber,dateIdx+1).setValue(now);
  const announcementDate=previous.announcementDate||now;

  // Move the registration into the next workflow state when the result is published.
  const regSheet=ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const regRow=findRowById_(regSheet,'registrationId',registrationId);
  if(regRow){
    const regHeaders=regSheet.getRange(1,1,1,regSheet.getLastColumn()).getValues()[0].map(String);
    const statusIdx=regHeaders.indexOf('status'), updatedIdx=regHeaders.indexOf('updatedAt');
    if(statusIdx>=0){
      const nextStatus=status==='PASSED'?'REREGISTRATION':status==='NOT_PASSED'?'NOT_PASSED':'SELECTION';
      regSheet.getRange(regRow.rowNumber,statusIdx+1).setValue(nextStatus);
      if(updatedIdx>=0)regSheet.getRange(regRow.rowNumber,updatedIdx+1).setValue(now);
    }
  }

  const userId=String(regFound.registration.userId||'').trim();
  const candidateName=String(regFound.candidate?.fullName||regFound.candidate?.name||'Calon santri');
  const title=status==='PASSED'?'Pengumuman Hasil Seleksi':status==='NOT_PASSED'?'Pengumuman Hasil Seleksi':'Informasi Hasil Seleksi';
  const message=status==='PASSED'?`Hasil seleksi untuk ${candidateName}: LULUS. Silakan buka menu Pengumuman untuk melihat informasi selanjutnya.`:status==='NOT_PASSED'?`Hasil seleksi untuk ${candidateName}: TIDAK LULUS. Silakan buka menu Pengumuman untuk melihat detail hasil.`:`Hasil seleksi untuk ${candidateName}: CADANGAN. Silakan buka menu Pengumuman untuk melihat informasi selanjutnya.`;
  if(userId)createNotification_(userId,title,message,status==='PASSED'?'SUCCESS':status==='NOT_PASSED'?'INFO':'WARNING');
  if(status==='PASSED'){
    ensureReregistration_(registrationId, actor.userId, true);
    createNotification_(userId,'Daftar Ulang Dibuka','Karena hasil seleksi dinyatakan LULUS, tahap Daftar Ulang sudah dibuka. Silakan lengkapi dokumen dan pembayaran daftar ulang.','SUCCESS');
  }
  writeAudit_(actor.userId,'ANNOUNCEMENT','ANNOUNCEMENT',String(found.object.resultId||registrationId),JSON.stringify(previous),JSON.stringify(Object.assign({},previous,{announcementDate})),`Pengumuman hasil seleksi dipublikasikan: ${status}`);
  return {success:true,message:'Pengumuman berhasil dipublikasikan.',announcementDate:rpcSafe_(announcementDate),result:rpcSafe_(Object.assign({},previous,{announcementDate}))};
  } finally { lock.releaseLock(); }
}

function getNotifications(sessionToken) {
  const actor=requireRole_(sessionToken,PSB_ANNOUNCEMENT_VIEW_ROLES);
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.NOTIFICATIONS);
  const rows=sheet&&sheet.getLastRow()>=2?sheetRows_(sheet):[];
  const items=rows.filter(x=>String(x.userId)===String(actor.userId)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100);
  return {success:true,items,unreadCount:items.filter(x=>String(x.isRead).toUpperCase()!=='TRUE').length};
}

function markNotificationRead(sessionToken,notificationId) {
  const actor=requireRole_(sessionToken,PSB_ANNOUNCEMENT_VIEW_ROLES);
  assertOperationalMutation_(actor);
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.NOTIFICATIONS);
  const found=findRowById_(sheet,'notificationId',String(notificationId||''));
  if(!found || String(found.object.userId)!==String(actor.userId)) return fail_('Notifikasi tidak ditemukan.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), readIdx=headers.indexOf('isRead'), dateIdx=headers.indexOf('readAt');
  if(readIdx>=0)sheet.getRange(found.rowNumber,readIdx+1).setValue(true);
  if(dateIdx>=0)sheet.getRange(found.rowNumber,dateIdx+1).setValue(new Date());
  return {success:true};
}

function markAllNotificationsRead(sessionToken) {
  const actor=requireRole_(sessionToken,PSB_ANNOUNCEMENT_VIEW_ROLES);
  assertOperationalMutation_(actor);
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.NOTIFICATIONS);
  if(!sheet||sheet.getLastRow()<2)return {success:true};
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), userIdx=headers.indexOf('userId'), readIdx=headers.indexOf('isRead'), dateIdx=headers.indexOf('readAt');
  if(userIdx<0||readIdx<0)return {success:true};
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(), now=new Date();
  values.forEach((row,i)=>{if(String(row[userIdx])===String(actor.userId)){row[readIdx]=true;if(dateIdx>=0)row[dateIdx]=now;}});
  sheet.getRange(2,1,values.length,sheet.getLastColumn()).setValues(values);
  return {success:true};
}


function getChatPageData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_CHAT_ACCESS_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const threadsSheet = ss.getSheetByName(PSB_SHEETS.CHAT_THREADS);
  const registrationsSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const candidatesSheet = ss.getSheetByName(PSB_SHEETS.CANDIDATES);
  const usersSheet = ss.getSheetByName(PSB_SHEETS.USERS);
  const years = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN), 'tahunAjaranId');
  const waves = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_GELOMBANG), 'gelombangId');
  const levels = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_JENJANG), 'jenjangId');
  const candidates = sheetMapById_(candidatesSheet, 'candidateId');
  const users = sheetMapById_(usersSheet, 'userId');
  const registrations = registrationsSheet && registrationsSheet.getLastRow() >= 2 ? sheetRows_(registrationsSheet) : [];
  const allThreads = threadsSheet && threadsSheet.getLastRow() >= 2 ? sheetRows_(threadsSheet) : [];
  const decorateThread = t => {
    const reg = registrations.find(r => String(r.registrationId) === String(t.registrationId));
    const candidate = reg ? candidates[String(reg.candidateId)] : null;
    const wali = reg ? users[String(reg.userId)] : null;
    const level = reg ? levels[String(reg.jenjangId)] : null;
    const year = reg ? years[String(reg.tahunAjaranId)] : null;
    const wave = reg ? waves[String(reg.gelombangId)] : null;
    return Object.assign({}, t, {candidateName:candidate?.fullName||candidate?.name||'-',waliName:wali?.name||'-',registrationNumber:reg?.registrationNumber||'-',jenjangName:level?.name||reg?.jenjangId||'-',tahunAjaranName:year?.name||reg?.tahunAjaranId||'-',gelombangName:wave?.name||reg?.gelombangId||'-',lastMessageAt:t.lastMessageAt||t.updatedAt||t.createdAt||''});
  };
  let visibleThreads = allThreads.map(decorateThread);
  const isWali = hasRoleDirect_(actor, ['WALI']);
  if (isWali) visibleThreads = visibleThreads.filter(t => String(t.waliUserId) === String(actor.userId));
  visibleThreads.sort((a,b)=>new Date(b.lastMessageAt||b.updatedAt||b.createdAt||0)-new Date(a.lastMessageAt||a.updatedAt||a.createdAt||0));
  const openThreadByRegistration = new Map();
  visibleThreads.forEach(t=>{if(String(t.status||'').toUpperCase()==='OPEN')openThreadByRegistration.set(String(t.registrationId),t);});
  const pageThreads = visibleThreads.slice(0,200);
  let ownRegistrations=[];
  if(isWali){ownRegistrations=registrations.filter(r=>String(r.userId)===String(actor.userId)).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).map(r=>{const candidate=candidates[String(r.candidateId)],level=levels[String(r.jenjangId)],thread=openThreadByRegistration.get(String(r.registrationId));return {registrationId:r.registrationId,registrationNumber:r.registrationNumber||'-',candidateName:candidate?.fullName||candidate?.name||'-',jenjangName:level?.name||r.jenjangId||'-',status:r.status||'',threadId:thread?.threadId||'',hasOpenThread:!!thread};});}
  const unread={};const pageThreadIds=new Set(pageThreads.map(t=>String(t.threadId)));pageThreads.forEach(t=>unread[t.threadId]=0);
  const messagesSheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES);
  if(pageThreadIds.size&&messagesSheet&&messagesSheet.getLastRow()>=2){
    const lastRow=messagesSheet.getLastRow(),headers=messagesSheet.getRange(1,1,1,messagesSheet.getLastColumn()).getValues()[0].map(String),threadIdx=headers.indexOf('threadId'),senderIdx=headers.indexOf('senderUserId'),readIdx=headers.indexOf('isRead');
    if(threadIdx>=0&&senderIdx>=0&&readIdx>=0){
      const rowCount=lastRow-1,threadValues=messagesSheet.getRange(2,threadIdx+1,rowCount,1).getValues(),senderValues=messagesSheet.getRange(2,senderIdx+1,rowCount,1).getValues(),readValues=messagesSheet.getRange(2,readIdx+1,rowCount,1).getValues();
      for(let i=0;i<rowCount;i++){const tid=String(threadValues[i][0]||'');if(!pageThreadIds.has(tid))continue;if(String(readValues[i][0]).toUpperCase()!=='TRUE'&&String(senderValues[i][0])!==String(actor.userId))unread[tid]=Number(unread[tid]||0)+1;}
    }
  }
  const pageThreadsWithUnread=pageThreads.map(t=>Object.assign({},t,{unreadCount:unread[t.threadId]||0}));
  return {success:true,actorRole:actor.role,threads:pageThreadsWithUnread,registrations:ownRegistrations,retentionDays:Number(getConfig_('CHAT_RETENTION_DAYS'))||180,pollSeconds:Math.max(5,Number(getConfig_('CHAT_POLL_SECONDS'))||10),maxMessageLength:Number(getConfig_('CHAT_MESSAGE_MAX_LENGTH'))||1000,attachmentMaxSizeMb:Math.max(1,Number(getConfig_('CHAT_ATTACHMENT_MAX_SIZE_MB'))||5),canCleanup:hasRoleDirect_(actor,['SUPERADMIN']),canAutomate:hasRoleDirect_(actor,['SUPERADMIN']),automationEnabled:String(getConfig_('CHAT_AUTOMATION_ENABLED')||'TRUE').toUpperCase()==='TRUE',autoCloseDays:Math.max(1,Number(getConfig_('CHAT_AUTO_CLOSE_DAYS'))||7),adminReminderMinutes:Math.max(5,Number(getConfig_('CHAT_ADMIN_REMINDER_MINUTES'))||30)};
}
function getChatThread(sessionToken, threadId) {
  const actor=requireRole_(sessionToken,PSB_CHAT_ACCESS_ROLES),id=String(threadId||'').trim();if(!id)return fail_('Percakapan tidak ditemukan.');
  const ss=SpreadsheetApp.getActiveSpreadsheet(),threadFound=findRowById_(ss.getSheetByName(PSB_SHEETS.CHAT_THREADS),'threadId',id);if(!threadFound)return fail_('Percakapan tidak ditemukan.');
  const thread=threadFound.object;if(!chatCanAccessThread_(actor,thread))return fail_('Anda tidak memiliki akses ke percakapan ini.');
  const cache=CacheService.getScriptCache(),cacheKey='PSB_CHAT_THREAD_V1_'+sha256Hex_(id).substring(0,32);
  try{const cached=cache.get(cacheKey);if(cached){const parsed=JSON.parse(cached);if(parsed&&parsed.success)return parsed;}}catch(e){}
  const messagesSheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES),messages=[];
  if(messagesSheet&&messagesSheet.getLastRow()>=2){
    // Batch-read the message table once. The previous implementation first found
    // matching rows, then called getRange() again for every message; with an older
    // conversation this created dozens/hundreds of Spreadsheet service calls.
    const lastCol=messagesSheet.getLastColumn(),headers=messagesSheet.getRange(1,1,1,lastCol).getValues()[0].map(String),threadIdx=headers.indexOf('threadId');
    if(threadIdx>=0){
      const values=messagesSheet.getRange(2,1,messagesSheet.getLastRow()-1,lastCol).getValues(),matched=[];
      for(let i=0;i<values.length;i++)if(String(values[i][threadIdx])===id)matched.push(values[i]);
      const selected=matched.slice(Math.max(0,matched.length-200));
      selected.forEach((row,i)=>{const obj=rowObject_(headers,row,0);obj.message=/^'[=+\-@]/.test(String(obj.message||''))?String(obj.message).substring(1):String(obj.message||'');messages.push(obj);});
    }
  }
  messages.sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
  const regs=sheetMapById_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS),'registrationId'),candidates=sheetMapById_(ss.getSheetByName(PSB_SHEETS.CANDIDATES),'candidateId'),users=sheetMapById_(ss.getSheetByName(PSB_SHEETS.USERS),'userId'),reg=regs[String(thread.registrationId)],candidate=reg?candidates[String(reg.candidateId)]:null,wali=users[String(thread.waliUserId)];
  const enrichedThread=Object.assign({},thread,{candidateName:candidate?.fullName||candidate?.name||'-',waliName:wali?.name||'-',registrationNumber:reg?.registrationNumber||'-'});
  const result={success:true,thread:enrichedThread,messages};
  try{cache.put(cacheKey,JSON.stringify(result),30);}catch(e){}
  return result;
}
function openChatThread(sessionToken, registrationId) {
  const actor=requireRole_(sessionToken,PSB_CHAT_ACCESS_ROLES),id=String(registrationId||'').trim();if(!id)return fail_('Pendaftaran tidak ditemukan.');
  const found=findRegistration_(id);if(!found)return fail_('Pendaftaran tidak ditemukan.');if(!canAccessRegistration_(actor,found.registration))return fail_('Anda tidak memiliki akses ke pendaftaran ini.');
  if(!hasRoleDirect_(actor,['WALI'])&&!hasRoleDirect_(actor,PSB_CHAT_ADMIN_ROLES))return fail_('Anda tidak memiliki akses chat.');
  return withScriptLock_(10000,()=>{const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.CHAT_THREADS);if(!sheet)return fail_('Sheet CHAT_THREADS belum tersedia.');const existing=sheetRows_(sheet).filter(t=>String(t.registrationId)===id&&String(t.status).toUpperCase()==='OPEN').sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0))[0];if(existing)return getChatThread(sessionToken,String(existing.threadId));const candidateName=String(found.candidate?.fullName||found.candidate?.name||'Calon santri').trim(),now=new Date(),thread={threadId:generateId_('CHT'),registrationId:id,waliUserId:String(found.registration.userId||''),adminUserId:'',subject:'Komunikasi PSB - '+candidateName,status:'OPEN',lastMessageAt:now,lastMessageBy:'',createdAt:now,updatedAt:now,closedAt:''},headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);sheet.appendRow(headers.map(h=>thread[h]===undefined?'':thread[h]));writeAudit_(actor.userId,'CHAT_THREAD_CREATED','CHAT',thread.threadId,'',JSON.stringify({registrationId:id,waliUserId:thread.waliUserId}),'Percakapan chat dibuat.');return getChatThread(sessionToken,thread.threadId);});
}
function sendChatMessage(sessionToken,threadId,rawMessage,attachmentPayload){
  const actor=requireRole_(sessionToken,PSB_CHAT_ACCESS_ROLES);assertOperationalMutation_(actor);
  const id=String(threadId||'').trim(),message=clean_(rawMessage),maxLength=Number(getConfig_('CHAT_MESSAGE_MAX_LENGTH'))||1000;
  attachmentPayload=attachmentPayload||{};
  if(!id)return fail_('Percakapan tidak ditemukan.');
  if(message.length>maxLength)return fail_('Pesan maksimal '+maxLength+' karakter.');
  const hasAttachment=!!String(attachmentPayload.base64||'').trim();
  if(hasAttachment)return fail_('Fitur lampiran chat sudah dinonaktifkan. Silakan kirim pesan teks.');
  if(!message)return fail_('Pesan wajib diisi.');
  return withScriptLock_(10000,()=>{
    const ss=SpreadsheetApp.getActiveSpreadsheet(),threadSheet=ss.getSheetByName(PSB_SHEETS.CHAT_THREADS),messageSheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES);
    if(!threadSheet||!messageSheet)return fail_('Database chat belum tersedia.');
    const found=findRowById_(threadSheet,'threadId',id);if(!found)return fail_('Percakapan tidak ditemukan.');
    const thread=found.object;if(!chatCanAccessThread_(actor,thread))return fail_('Anda tidak memiliki akses ke percakapan ini.');
    if(String(thread.status).toUpperCase()!=='OPEN')return fail_('Percakapan sudah ditutup.');
    const now=new Date(),senderRole=hasRoleDirect_(actor,['WALI'])?'WALI':'ADMIN_PSB';
    let attachmentFile=null,attachmentName='',attachmentMimeType='',attachmentSize=0;
    if(hasAttachment){
      attachmentName=sanitizeFileName_(attachmentPayload.fileName||'lampiran');
      attachmentMimeType=String(attachmentPayload.mimeType||'').trim().toLowerCase();
      const allowed=String(getConfig_('CHAT_ATTACHMENT_ALLOWED_MIME_TYPES')||'image/jpeg,image/png,image/webp,application/pdf').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(!attachmentMimeType||!allowed.includes(attachmentMimeType))return fail_('Tipe lampiran tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.');
      const base64=String(attachmentPayload.base64||'').trim();
      let bytes;try{bytes=Utilities.base64Decode(base64);}catch(e){return fail_('Lampiran tidak valid. Silakan pilih file kembali.');}
      attachmentSize=bytes.length;const maxMb=Math.max(1,Number(getConfig_('CHAT_ATTACHMENT_MAX_SIZE_MB'))||5);
      if(attachmentSize>maxMb*1024*1024)return fail_('Ukuran lampiran melebihi batas '+maxMb+' MB.');
      const clientSize=Number(attachmentPayload.fileSize||0);if(clientSize>0&&Math.abs(clientSize-attachmentSize)>1024)return fail_('Ukuran lampiran tidak sesuai. Silakan pilih file kembali.');
      const reg=findRegistration_(String(thread.registrationId));if(!reg)return fail_('Pendaftaran terkait percakapan tidak ditemukan.');
      const folder=getChatAttachmentFolder_(reg.registration,thread);
      const blob=Utilities.newBlob(bytes,attachmentMimeType,attachmentName);attachmentFile=folder.createFile(blob);
      const detected=String(attachmentFile.getMimeType()||'').toLowerCase();
      if(detected&&detected!==attachmentMimeType){try{attachmentFile.setTrashed(true);}catch(e){}return fail_('Tipe file aktual tidak sesuai dengan tipe lampiran.');}
    }
    const headers=messageSheet.getRange(1,1,1,messageSheet.getLastColumn()).getValues()[0].map(String);
    const msg={messageId:generateId_('MSG'),threadId:id,senderUserId:String(actor.userId),senderRole,message:auditCell_(message),attachmentFileId:attachmentFile?attachmentFile.getId():'',attachmentName:attachmentName,attachmentMimeType:attachmentMimeType,isRead:false,createdAt:now,readAt:''};
    messageSheet.appendRow(headers.map(h=>msg[h]===undefined?'':msg[h]));
    try{CacheService.getScriptCache().remove('PSB_CHAT_THREAD_V1_'+sha256Hex_(id).substring(0,32));}catch(e){}
    const th=threadSheet.getRange(1,1,1,threadSheet.getLastColumn()).getValues()[0].map(String),updates={lastMessageAt:now,lastMessageBy:senderRole,updatedAt:now};
    th.forEach((h,i)=>{if(updates[h]!==undefined)threadSheet.getRange(found.rowNumber,i+1).setValue(updates[h]);});
    const reg=findRegistration_(String(thread.registrationId)),candidateName=String(reg?.candidate?.fullName||reg?.candidate?.name||'Calon santri');
    const previewBase=message||(attachmentName?'Lampiran: '+attachmentName:'');const preview=previewBase.length>120?previewBase.substring(0,117)+'...':previewBase;
    // Side-effects tidak boleh membatalkan transaksi utama. Pesan sudah tersimpan di CHAT_MESSAGES.
    try{
      if(senderRole==='WALI')notifyChatAdmins_(candidateName,preview);else if(thread.waliUserId)createNotification_(String(thread.waliUserId),'Balasan Admin PSB',candidateName+': '+preview,'INFO');
    }catch(sideEffectError){/* Pesan tetap sukses walau notifikasi gagal. */}
    try{
      writeAudit_(actor.userId,'CHAT_MESSAGE_SENT','CHAT',id,'',JSON.stringify({messageId:msg.messageId,senderRole,messageLength:message.length,hasAttachment:!!attachmentFile,attachmentFileId:attachmentFile?attachmentFile.getId():'',attachmentName:attachmentName,attachmentMimeType:attachmentMimeType,attachmentSize:attachmentSize}),'Pesan chat dikirim.');
    }catch(auditError){/* Audit bukan bagian dari commit pesan. */}
    return {success:true,message:'Pesan berhasil dikirim.',chatMessage:{messageId:msg.messageId,threadId:msg.threadId,senderUserId:msg.senderUserId,senderRole:msg.senderRole,message:message,attachmentFileId:msg.attachmentFileId||'',attachmentName:msg.attachmentName||'',attachmentMimeType:msg.attachmentMimeType||'',isRead:!!msg.isRead,createdAt:now.toISOString(),readAt:msg.readAt||'',attachmentUrl:attachmentFile?attachmentFile.getUrl():'',attachmentSize:Number(attachmentSize)||0}};
  });
}

function getChatAttachmentData(sessionToken,messageId){
  const actor=requireRole_(sessionToken,PSB_CHAT_ACCESS_ROLES),id=String(messageId||'').trim();if(!id)return fail_('Lampiran tidak ditemukan.');
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES);if(!sheet||sheet.getLastRow()<2)return fail_('Lampiran tidak ditemukan.');
  const found=findRowById_(sheet,'messageId',id);if(!found)return fail_('Lampiran tidak ditemukan.');
  const msg=found.object,threadSheet=ss.getSheetByName(PSB_SHEETS.CHAT_THREADS),threadFound=findRowById_(threadSheet,'threadId',String(msg.threadId));if(!threadFound)return fail_('Percakapan tidak ditemukan.');
  if(!chatCanAccessThread_(actor,threadFound.object))return fail_('Anda tidak memiliki akses ke lampiran ini.');
  const fileId=String(msg.attachmentFileId||'').trim();if(!fileId)return fail_('Pesan ini tidak memiliki lampiran.');
  try{const file=DriveApp.getFileById(fileId),blob=file.getBlob(),bytes=blob.getBytes(),maxMb=Math.max(1,Number(getConfig_('CHAT_ATTACHMENT_MAX_SIZE_MB'))||5);if(bytes.length>maxMb*1024*1024)return fail_('Lampiran terlalu besar untuk ditampilkan.');writeAudit_(actor.userId,'CHAT_ATTACHMENT_ACCESSED','CHAT',String(msg.threadId),'',JSON.stringify({messageId:id,fileId:fileId,fileName:msg.attachmentName||file.getName()}),'Lampiran chat diakses.');return {success:true,fileName:msg.attachmentName||file.getName(),mimeType:String(msg.attachmentMimeType||blob.getContentType()||'application/octet-stream'),base64:Utilities.base64Encode(bytes)};}catch(e){return fail_('Lampiran tidak dapat diakses.');}
}
function markChatThreadRead(sessionToken,threadId){
  const actor=requireRole_(sessionToken,PSB_CHAT_ACCESS_ROLES),id=String(threadId||'').trim(),ss=SpreadsheetApp.getActiveSpreadsheet(),threadFound=findRowById_(ss.getSheetByName(PSB_SHEETS.CHAT_THREADS),'threadId',id);if(!threadFound)return fail_('Percakapan tidak ditemukan.');if(!chatCanAccessThread_(actor,threadFound.object))return fail_('Anda tidak memiliki akses ke percakapan ini.');const sheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES);if(!sheet||sheet.getLastRow()<2)return {success:true};
  const lastCol=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,lastCol).getValues()[0].map(String),threadIdx=headers.indexOf('threadId'),senderIdx=headers.indexOf('senderUserId'),readIdx=headers.indexOf('isRead'),readAtIdx=headers.indexOf('readAt');if(threadIdx<0||senderIdx<0||readIdx<0)return {success:true};
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,lastCol).getValues(),rowsToRead=[];
  for(let i=0;i<values.length;i++){const row=values[i];if(String(row[threadIdx])!==id)continue;if(String(row[senderIdx])===String(actor.userId)||String(row[readIdx]).toUpperCase()==='TRUE')continue;rowsToRead.push(i+2);}
  const colLetter=n=>{let out='';while(n>0){const rem=(n-1)%26;out=String.fromCharCode(65+rem)+out;n=Math.floor((n-1)/26);}return out;};if(rowsToRead.length){sheet.getRangeList(rowsToRead.map(r=>colLetter(readIdx+1)+r)).setValue(true);if(readAtIdx>=0)sheet.getRangeList(rowsToRead.map(r=>colLetter(readAtIdx+1)+r)).setValue(new Date());try{writeAudit_(actor.userId,'CHAT_MESSAGE_READ','CHAT',id,'',JSON.stringify({count:rowsToRead.length}),'Pesan chat ditandai sudah dibaca.');}catch(e){}}return {success:true,changed:rowsToRead.length};
}
function closeChatThread(sessionToken,threadId){const actor=requireRole_(sessionToken,PSB_CHAT_ADMIN_ROLES);assertOperationalMutation_(actor);const id=String(threadId||'').trim();return withScriptLock_(10000,()=>{const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.CHAT_THREADS),found=findRowById_(sheet,'threadId',id);if(!found)return fail_('Percakapan tidak ditemukan.');const now=new Date(),headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),statusIdx=headers.indexOf('status'),updatedIdx=headers.indexOf('updatedAt'),closedIdx=headers.indexOf('closedAt');if(statusIdx>=0)sheet.getRange(found.rowNumber,statusIdx+1).setValue('CLOSED');if(updatedIdx>=0)sheet.getRange(found.rowNumber,updatedIdx+1).setValue(now);if(closedIdx>=0)sheet.getRange(found.rowNumber,closedIdx+1).setValue(now);if(found.object.waliUserId)createNotification_(String(found.object.waliUserId),'Percakapan ditutup','Percakapan dengan Admin PSB telah ditutup. Anda dapat membuka percakapan baru kapan saja.','INFO');try{CacheService.getScriptCache().remove('PSB_CHAT_THREAD_V1_'+sha256Hex_(id).substring(0,32));}catch(e){};writeAudit_(actor.userId,'CHAT_THREAD_CLOSED','CHAT',id,JSON.stringify({status:found.object.status}),JSON.stringify({status:'CLOSED'}),'Percakapan chat ditutup.');return {success:true,message:'Percakapan berhasil ditutup.'};});}
function cleanupChatRetention(sessionToken){const actor=requireRole_(sessionToken,['SUPERADMIN']);assertOperationalMutation_(actor);return withScriptLock_(20000,()=>cleanupChatRetentionInternal_(actor.userId));}
function cleanupChatRetentionInternal_(auditUserId){const retentionDays=Math.max(1,Number(getConfig_('CHAT_RETENTION_DAYS'))||180),cutoff=new Date(Date.now()-retentionDays*86400000),ss=SpreadsheetApp.getActiveSpreadsheet(),threadSheet=ss.getSheetByName(PSB_SHEETS.CHAT_THREADS),messageSheet=ss.getSheetByName(PSB_SHEETS.CHAT_MESSAGES);if(!threadSheet||!messageSheet)return {success:false,message:'Database chat belum tersedia.'};const threads=threadSheet.getLastRow()>=2?sheetRows_(threadSheet):[],oldIds=new Set(threads.filter(t=>String(t.status).toUpperCase()==='CLOSED'&&new Date(t.closedAt||t.updatedAt||t.createdAt||0)<cutoff).map(t=>String(t.threadId)));if(!oldIds.size)return {success:true,deletedThreads:0,deletedMessages:0,retentionDays};const removeRowsByIds=(sheet,idField,ids)=>{if(!sheet||sheet.getLastRow()<2)return 0;const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),idx=headers.indexOf(idField);if(idx<0)return 0;const values=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();let removed=0;for(let i=values.length-1;i>=0;i--)if(ids.has(String(values[i][idx]))){sheet.deleteRow(i+2);removed++;}return removed;};const oldMessageRows=messageSheet.getLastRow()>=2?sheetRows_(messageSheet).filter(m=>oldIds.has(String(m.threadId))):[];oldMessageRows.forEach(m=>{const fid=String(m.attachmentFileId||'').trim();if(fid){try{DriveApp.getFileById(fid).setTrashed(true);}catch(e){}}});const deletedMessages=removeRowsByIds(messageSheet,'threadId',oldIds),deletedThreads=removeRowsByIds(threadSheet,'threadId',oldIds);writeAudit_(auditUserId||'SYSTEM','CHAT_RETENTION_CLEANUP','CHAT','','',JSON.stringify({deletedThreads,deletedMessages,retentionDays,automated:!auditUserId}),'Pembersihan chat yang melewati masa retensi.');return {success:true,deletedThreads,deletedMessages,retentionDays};}
function runChatAutomation(){const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {success:false,message:'Otomasi chat sedang berjalan.'};try{if(String(getConfig_('CHAT_AUTOMATION_ENABLED')||'TRUE').toUpperCase()!=='TRUE')return {success:true,skipped:true,reason:'DISABLED'};const ss=SpreadsheetApp.getActiveSpreadsheet(),threadSheet=ss.getSheetByName(PSB_SHEETS.CHAT_THREADS);if(!threadSheet||threadSheet.getLastRow()<2)return {success:true,closedThreads:0,reminders:0,cleanup:{deletedThreads:0,deletedMessages:0}};const now=new Date(),autoCloseDays=Math.max(1,Number(getConfig_('CHAT_AUTO_CLOSE_DAYS'))||7),reminderMinutes=Math.max(5,Number(getConfig_('CHAT_ADMIN_REMINDER_MINUTES'))||30),closeCutoff=new Date(now.getTime()-autoCloseDays*86400000),reminderCutoff=new Date(now.getTime()-reminderMinutes*60000),threads=sheetRows_(threadSheet),usersSheet=ss.getSheetByName(PSB_SHEETS.USERS),users=usersSheet&&usersSheet.getLastRow()>=2?sheetRows_(usersSheet):[],admins=users.filter(u=>!['INACTIVE','DISABLED'].includes(String(u.status||'ACTIVE').toUpperCase())&&String(u.role||'').toUpperCase().split(',').map(x=>x.trim()).includes('ADMIN_PSB')),notificationsSheet=ss.getSheetByName(PSB_SHEETS.NOTIFICATIONS),notifications=notificationsSheet&&notificationsSheet.getLastRow()>=2?sheetRows_(notificationsSheet):[];let closedThreads=0,reminders=0;threads.forEach(t=>{if(String(t.status).toUpperCase()!=='OPEN')return;const last=new Date(t.lastMessageAt||t.updatedAt||t.createdAt||0);if(String(t.lastMessageBy||'').toUpperCase()==='WALI'&&last.getTime()&&last<=reminderCutoff){const candidate=findRegistration_(String(t.registrationId||''));const name=String(candidate?.candidate?.fullName||'Calon santri').trim(),subject='Chat menunggu balasan';admins.forEach(u=>{const recent=notifications.some(n=>String(n.userId)===String(u.userId)&&String(n.title)===subject&&new Date(n.createdAt||0).getTime()>=last.getTime()&&new Date(n.createdAt||0).getTime()>=reminderCutoff.getTime()-reminderMinutes*60000&&String(n.message||'').includes(String(t.threadId)));if(!recent){createNotification_(String(u.userId),subject,name+' memiliki pesan chat yang belum dibalas. Thread: '+String(t.threadId),'INFO');reminders++;}});}if(last.getTime()&&last<=closeCutoff){const headers=threadSheet.getRange(1,1,1,threadSheet.getLastColumn()).getValues()[0].map(String),statusIdx=headers.indexOf('status'),updatedIdx=headers.indexOf('updatedAt'),closedIdx=headers.indexOf('closedAt');if(statusIdx>=0)threadSheet.getRange(threads.indexOf(t)+2,statusIdx+1).setValue('CLOSED');if(updatedIdx>=0)threadSheet.getRange(threads.indexOf(t)+2,updatedIdx+1).setValue(now);if(closedIdx>=0)threadSheet.getRange(threads.indexOf(t)+2,closedIdx+1).setValue(now);if(t.waliUserId)createNotification_(String(t.waliUserId),'Percakapan ditutup otomatis','Percakapan chat telah ditutup otomatis karena tidak ada aktivitas selama '+autoCloseDays+' hari. Anda dapat membuka percakapan baru kapan saja.','INFO');writeAudit_('SYSTEM','CHAT_THREAD_AUTO_CLOSED','CHAT',String(t.threadId),JSON.stringify({status:'OPEN'}),JSON.stringify({status:'CLOSED',autoCloseDays}),'Percakapan chat ditutup otomatis karena tidak aktif.');closedThreads++;}});const cleanup=cleanupChatRetentionInternal_('');writeAudit_('SYSTEM','CHAT_AUTOMATION_RUN','CHAT','',JSON.stringify({automationEnabled:true}),JSON.stringify({closedThreads,reminders,cleanup}),'Otomasi chat terjadwal selesai.');return {success:true,closedThreads,reminders,cleanup};}catch(e){writeAudit_('SYSTEM','CHAT_AUTOMATION_ERROR','CHAT','', '', JSON.stringify({message:String(e&&e.message||e)}),'Otomasi chat gagal dijalankan.');return {success:false,message:String(e&&e.message||e)};}finally{lock.releaseLock();}}
function runChatAutomationNow(sessionToken){const actor=requireRole_(sessionToken,['SUPERADMIN']);assertOperationalMutation_(actor);return runChatAutomation();}
function chatCanAccessThread_(actor,thread){if(!actor||!thread)return false;if(hasRoleDirect_(actor,PSB_CHAT_ADMIN_ROLES))return true;return hasRoleDirect_(actor,['WALI'])&&String(thread.waliUserId)===String(actor.userId);}
function notifyChatAdmins_(candidateName,preview){const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.USERS);if(!sheet||sheet.getLastRow()<2)return 0;const users=sheetRows_(sheet);let count=0;users.forEach(u=>{const roles=String(u.role||'').toUpperCase().split(',').map(x=>x.trim()),status=String(u.status||'ACTIVE').toUpperCase();if(roles.includes('ADMIN_PSB')&&!['INACTIVE','DISABLED'].includes(status)){createNotification_(String(u.userId),'Pesan baru dari Wali',candidateName+': '+preview,'INFO');count++;}});return count;}
function getCommunicationCenterData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_COMMUNICATION_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const notifications = sheetRows_(ss.getSheetByName(PSB_SHEETS.NOTIFICATIONS));
  const activeUsers = users.filter(u => !['INACTIVE','DISABLED'].includes(String(u.status || 'ACTIVE').toUpperCase()));
  const roleCounts = {};
  PSB_COMMUNICATION_RECIPIENT_ROLES.forEach(role => roleCounts[role] = activeUsers.filter(u => String(u.role || '').toUpperCase().split(',').map(x => x.trim()).includes(role)).length);
  const recent = notifications.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 100).map(x => ({
    notificationId:x.notificationId,userId:x.userId,title:x.title,message:x.message,type:x.type,isRead:x.isRead,createdAt:x.createdAt,readAt:x.readAt
  }));
  return {success:true,actorRole:actor.role,roleCounts,activeUsers:activeUsers.length,recent,automation:[
    {event:'Pendaftaran dikirim',target:'SUPERADMIN, ADMIN_PSB, VERIFIKATOR, WALI',enabled:true},
    {event:'Bukti pembayaran dikirim',target:'SUPERADMIN, ADMIN_PSB, KEUANGAN, WALI',enabled:true},
    {event:'Pembayaran diverifikasi/ditolak',target:'WALI',enabled:true},
    {event:'Dokumen perlu diperbaiki',target:'WALI',enabled:true},
    {event:'Pendaftaran terverifikasi/perlu perbaikan',target:'WALI',enabled:true},
    {event:'Jadwal tes ditentukan',target:'WALI',enabled:true},
    {event:'Hasil seleksi dipublikasikan',target:'WALI',enabled:true},
    {event:'Daftar ulang selesai',target:'WALI',enabled:true}
  ]};
}

function sendCommunication(sessionToken, payload) {
  const actor = requireRole_(sessionToken, PSB_COMMUNICATION_ROLES);
  assertOperationalMutation_(actor);
  payload = payload || {};
  const title = String(payload.title || '').trim();
  const message = String(payload.message || '').trim();
  if (!title) return fail_('Judul komunikasi wajib diisi.');
  if (!message) return fail_('Pesan komunikasi wajib diisi.');
  if (title.length > 120) return fail_('Judul maksimal 120 karakter.');
  if (message.length > 1000) return fail_('Pesan maksimal 1000 karakter.');
  const type = String(payload.type || 'INFO').toUpperCase();
  if (!['INFO','SUCCESS','WARNING','ERROR'].includes(type)) return fail_('Tipe notifikasi tidak valid.');
  const targetRoles = Array.isArray(payload.roles) ? payload.roles.map(x => String(x || '').toUpperCase().trim()).filter(Boolean) : [];
  const uniqueRoles = [...new Set(targetRoles)];
  if (!uniqueRoles.length || uniqueRoles.some(r => !PSB_COMMUNICATION_RECIPIENT_ROLES.includes(r))) return fail_('Penerima role tidak valid.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const recipients = users.filter(u => !['INACTIVE','DISABLED'].includes(String(u.status || 'ACTIVE').toUpperCase()) && uniqueRoles.some(role => String(u.role || '').toUpperCase().split(',').map(x => x.trim()).includes(role)));
  if (!recipients.length) return fail_('Tidak ada penerima aktif untuk role yang dipilih.');
  if (recipients.length > 500) return fail_('Jumlah penerima melebihi batas 500 akun per pengiriman.');
  let sent = 0;
  recipients.forEach(u => { if (createNotification_(String(u.userId), title, message, type)) sent++; });
  writeAudit_(actor.userId, 'COMMUNICATION_BROADCAST', 'COMMUNICATION', '', '', JSON.stringify({roles:uniqueRoles,type,recipients:sent,title}), 'Pengiriman komunikasi massal ke role pengguna');
  return {success:true,message:'Komunikasi berhasil dikirim ke '+sent+' akun.',sent,roles:uniqueRoles};
}

function createNotification_(userId,title,message,type){
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.NOTIFICATIONS); if(!sheet||!userId)return null;
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), record={}; headers.forEach(h=>record[h]='');
  Object.assign(record,{notificationId:generateId_('NTF'),userId:String(userId),title:clean_(title),message:clean_(message),type:String(type||'INFO'),isRead:false,createdAt:new Date(),readAt:''});
  sheet.appendRow(headers.map(h=>record[h])); return record;
}

function notifyUsersByRoles_(roles,title,message,type){
  const wanted=Array.isArray(roles)?roles.map(x=>String(x||'').toUpperCase()):[];
  if(!wanted.length)return 0;
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.USERS);
  if(!sheet||sheet.getLastRow()<2)return 0;
  const rows=sheetRows_(sheet); let count=0;
  rows.forEach(u=>{
    const role=String(u.role||'').toUpperCase(), status=String(u.status||'ACTIVE').toUpperCase();
    if(wanted.indexOf(role)>=0 && status!=='INACTIVE' && status!=='DISABLED'){
      createNotification_(String(u.userId),title,message,type); count++;
    }
  });
  return count;
}

function notifyRegistrationOwner_(registrationId,title,message,type){
  const found=findRegistration_(String(registrationId||''));
  if(!found||!found.registration.userId)return null;
  return createNotification_(String(found.registration.userId),title,message,type);
}

// =====================================================
// STAGE 10 - DAFTAR ULANG
// =====================================================
const PSB_REREGISTRATION_VIEW_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN'];
const PSB_REREGISTRATION_ADMIN_ROLES = ['SUPERADMIN','ADMIN_PSB','KEUANGAN'];
const PSB_REREGISTRATION_STATUSES = ['PENDING','PAYMENT_PENDING','PAYMENT_VERIFIED','COMPLETED'];

function getReregistrationPageData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_REREGISTRATION_VIEW_ROLES);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const rrSheet = ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS);
  if (!regSheet || !rrSheet) return {success:true,items:[],summary:{eligible:0,completed:0,pending:0}};

  const isWali = hasRoleDirect_(actor, ['WALI']);
  const regs = sheetRows_(regSheet).filter(r => !isWali || String(r.userId) === String(actor.userId));
  const rrRows = sheetRows_(rrSheet);
  const items = [];

  regs.forEach(reg => {
    const result = findRowById_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS), 'registrationId', String(reg.registrationId));
    if (!result || String(result.object.status || '').toUpperCase() !== 'PASSED' || !String(result.object.announcementDate || '').trim()) return;
    const found = findRegistration_(String(reg.registrationId));
    if (!found) return;
    // Stage 30.9: page-data GET is read-only. Opening a reregistration is an
    // explicit mutation performed by publishAnnouncement() or openReregistration().
    let rr = rrRows.find(x => String(x.registrationId) === String(reg.registrationId));
    if (!rr) {
      items.push({reregistration:null,registration:Object.assign({},reg),candidate:found.candidate||{},documents:{requiredCount:0,verifiedCount:0,missing:[]},payment:null,readyToComplete:false,needsOpen:true});
      return;
    }
    const docs = getCurrentDocuments_(String(reg.registrationId));
    const requiredDocs = getActiveMasterItems_('MASTER_DOKUMEN').filter(x => x.required);
    const missingDocs = requiredDocs.filter(t => {
      const d = docs.find(x => String(x.documentTypeId) === String(t.documentTypeId));
      return !d || String(d.status || '').toUpperCase() !== 'VERIFIED';
    }).map(t => String(t.name || t.documentTypeId));
    const paymentData = buildPaymentData_(String(reg.registrationId));
    const bills = paymentData.bills || [];
    const reregBill = bills.find(b => /daftar\s*ulang/i.test(String(b.paymentTypeName || '')));
    const paymentStatus = reregBill ? String(reregBill.status || '').toUpperCase() : 'NOT_CREATED';
    const payment = reregBill ? reregBill.payment : null;
    const ready = missingDocs.length === 0 && paymentStatus === 'PAID';
    items.push({
      reregistration: rr,
      registration: Object.assign({}, reg),
      candidate: found.candidate || {},
      documents: {requiredCount: requiredDocs.length, verifiedCount: requiredDocs.length - missingDocs.length, missing: missingDocs},
      payment: reregBill ? {billId:reregBill.billId, amount:reregBill.amount, dueDate:reregBill.dueDate, status:paymentStatus, paymentStatus:payment?.status || ''} : null,
      readyToComplete: ready
    });
  });

  const completed = items.filter(x => String(x.reregistration?.status||'').toUpperCase() === 'COMPLETED').length;
  return {success:true,items,summary:{eligible:items.length,completed,pending:items.length-completed},canManage:hasRoleDirect_(actor,PSB_REREGISTRATION_ADMIN_ROLES)};
}

function openReregistration(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_REREGISTRATION_VIEW_ROLES);
  assertOperationalMutation_(actor);
  const id = String(registrationId || '').trim();
  if (!id) return fail_('Pendaftaran wajib dipilih.');
  const found = findRegistration_(id); if (!found) return fail_('Pendaftaran tidak ditemukan.');
  if (hasRoleDirect_(actor,['WALI']) && String(found.registration.userId)!==String(actor.userId)) return fail_('Anda tidak memiliki akses ke pendaftaran ini.');
  const result=findRowById_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.SELECTION_RESULTS),'registrationId',id);
  if(!result || String(result.object.status||'').toUpperCase()!=='PASSED' || !String(result.object.announcementDate||'').trim()) return fail_('Daftar ulang hanya dapat dibuka setelah hasil LULUS dipublikasikan.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rrSheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REREGISTRATIONS);
    const current=findRowById_(rrSheet,'registrationId',id);
    if(current) return {success:true,message:'Daftar ulang sudah terbuka.',reregistration:current.object,alreadyOpen:true};
    const rr=ensureReregistration_(id,actor.userId,true); if(!rr) return fail_('Daftar ulang belum dapat dibuka.');
    const regNow=findRegistration_(id);
    if(regNow && ['PASSED','SELECTION'].includes(String(regNow.registration.status||'').toUpperCase())) setRegistrationStatus_(regNow.registration,'REREGISTRATION',actor.userId,'Daftar ulang dibuka.');
    const userId=String(found.registration.userId||''); if(userId) createNotification_(userId,'Daftar Ulang Dibuka','Tahap Daftar Ulang sudah dibuka. Silakan lengkapi dokumen dan pembayaran daftar ulang.','SUCCESS');
    return {success:true,message:'Daftar ulang berhasil dibuka.',reregistration:rr};
  } finally { lock.releaseLock(); }
}

function ensureReregistration_(registrationId, actorUserId, createBill) {
  const rrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REREGISTRATIONS);
  if (!rrSheet) return null;
  const existing = findRowById_(rrSheet, 'registrationId', registrationId);
  if (existing) return existing.object;
  const found = findRegistration_(registrationId);
  if (!found) return null;
  const now = new Date();
  const record = {
    reregistrationId: generateId_('RRG'), registrationId:String(registrationId), status:'PENDING', completedAt:'',
    note:'Daftar ulang dibuka setelah pengumuman hasil seleksi.', createdAt:now, updatedAt:now
  };
  const headers = rrSheet.getRange(1,1,1,rrSheet.getLastColumn()).getValues()[0].map(String);
  rrSheet.appendRow(headers.map(h => record[h] == null ? '' : record[h]));
  try { writeAudit_(actorUserId || 'SYSTEM','REREGISTRATION','REREGISTRATION',record.reregistrationId,'',JSON.stringify(record),'Daftar ulang dibuka'); } catch(e) {}
  if (createBill) ensureReregistrationBill_(found, actorUserId || 'SYSTEM');
  return record;
}

function ensureReregistrationBill_(found, actorUserId) {
  const typeItems = getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN');
  const type = typeItems.find(x => /daftar\s*ulang/i.test(String(x.name || '')));
  if (!type) return null;
  const billSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.BILLS);
  if (!billSheet) return null;
  const rows = sheetRows_(billSheet);
  const existing = rows.find(x => String(x.registrationId) === String(found.registration.registrationId) && String(x.paymentTypeId) === String(type.paymentTypeId) && String(x.status || '').toUpperCase() !== 'CANCELLED');
  if (existing) return existing;
  const headers = billSheet.getRange(1,1,1,billSheet.getLastColumn()).getValues()[0].map(String);
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 86400000);
  const record = {billId:generateId_('BIL'),registrationId:String(found.registration.registrationId),paymentTypeId:type.paymentTypeId,amount:Number(type.amount || 0),dueDate:due,status:'UNPAID',createdAt:now,updatedAt:now};
  billSheet.appendRow(headers.map(h => record[h] == null ? '' : record[h]));
  try { writeAudit_(actorUserId || 'SYSTEM','CREATE','PAYMENT',record.billId,'',JSON.stringify(record),'Tagihan Daftar Ulang dibuat otomatis'); } catch(e) {}
  return record;
}

function finalizeReregistration(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_REREGISTRATION_ADMIN_ROLES);
  assertOperationalMutation_(actor);
  const id = String(registrationId || '').trim();
  if (!id) return fail_('Pendaftaran wajib dipilih.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REREGISTRATIONS);
    const rrFound = findRowById_(rrSheet, 'registrationId', id);
    const regFound = findRegistration_(id);
    if (!rrFound || !regFound) return fail_('Data daftar ulang tidak ditemukan.');
    if(String(rrFound.object.status||'').toUpperCase()==='COMPLETED' || String(regFound.registration.status||'').toUpperCase()==='COMPLETED') return {success:true,message:'Daftar ulang sudah selesai.',status:'COMPLETED',alreadyCompleted:true};
    if(!['REREGISTRATION','PAYMENT_VERIFIED'].includes(String(regFound.registration.status||'').toUpperCase())) return fail_('Pendaftaran belum berada pada tahap Daftar Ulang.');
    const docs = getCurrentDocuments_(id);
    const required = getActiveMasterItems_('MASTER_DOKUMEN').filter(x => x.required);
    for (const t of required) {
      const d = docs.find(x => String(x.documentTypeId) === String(t.documentTypeId));
      if (!d || String(d.status || '').toUpperCase() !== 'VERIFIED') return fail_('Dokumen wajib belum lengkap/terverifikasi: ' + String(t.name || t.documentTypeId));
    }
    const payment = buildPaymentData_(id).bills.find(b => /daftar\s*ulang/i.test(String(b.paymentTypeName || '')));
    if (!payment || String(payment.status || '').toUpperCase() !== 'PAID') return fail_('Pembayaran Daftar Ulang belum lunas.');
    const now = new Date(), headers = rrSheet.getRange(1,1,1,rrSheet.getLastColumn()).getValues()[0].map(String);
    const statusIdx=headers.indexOf('status'), completedIdx=headers.indexOf('completedAt'), updatedIdx=headers.indexOf('updatedAt'), noteIdx=headers.indexOf('note');
    if(statusIdx>=0) rrSheet.getRange(rrFound.rowNumber,statusIdx+1).setValue('COMPLETED');
    if(completedIdx>=0) rrSheet.getRange(rrFound.rowNumber,completedIdx+1).setValue(now);
    if(updatedIdx>=0) rrSheet.getRange(rrFound.rowNumber,updatedIdx+1).setValue(now);
    if(noteIdx>=0) rrSheet.getRange(rrFound.rowNumber,noteIdx+1).setValue('Daftar ulang selesai.');
    setRegistrationStatus_(regFound.registration,'COMPLETED',actor.userId,'Daftar ulang selesai.');
    createNotification_(String(regFound.registration.userId),'Daftar Ulang Selesai','Proses daftar ulang untuk ' + String(regFound.candidate?.fullName || 'calon santri') + ' telah selesai.','SUCCESS');
    writeAudit_(actor.userId,'REREGISTRATION','REREGISTRATION',String(rrFound.object.reregistrationId),'',JSON.stringify({status:'COMPLETED'}),'Daftar ulang diselesaikan');
    return {success:true,message:'Daftar ulang berhasil diselesaikan.',status:'COMPLETED'};
  } finally { lock.releaseLock(); }
}

function syncReregistrationAfterPayment_(registrationId, actorUserId) {
  const rrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REREGISTRATIONS);
  const rrFound = findRowById_(rrSheet, 'registrationId', String(registrationId));
  if (!rrFound) return;
  const docs = getCurrentDocuments_(String(registrationId));
  const required = getActiveMasterItems_('MASTER_DOKUMEN').filter(x => x.required);
  const docsReady = required.every(t => { const d=docs.find(x=>String(x.documentTypeId)===String(t.documentTypeId)); return d && String(d.status||'').toUpperCase()==='VERIFIED'; });
  const payment = buildPaymentData_(String(registrationId)).bills.find(b=>/daftar\s*ulang/i.test(String(b.paymentTypeName||'')));
  if (!payment || String(payment.status||'').toUpperCase() !== 'PAID') return;
  const now=new Date(), headers=rrSheet.getRange(1,1,1,rrSheet.getLastColumn()).getValues()[0].map(String);
  const statusIdx=headers.indexOf('status'), updatedIdx=headers.indexOf('updatedAt');
  if(statusIdx>=0) rrSheet.getRange(rrFound.rowNumber,statusIdx+1).setValue(docsReady?'COMPLETED':'PAYMENT_VERIFIED');
  if(updatedIdx>=0) rrSheet.getRange(rrFound.rowNumber,updatedIdx+1).setValue(now);
  if(docsReady){
    const reg=findRegistration_(String(registrationId));
    if(reg && String(reg.registration.status)!=='COMPLETED') setRegistrationStatus_(reg.registration,'COMPLETED',actorUserId||'SYSTEM','Dokumen dan pembayaran Daftar Ulang lengkap.');
    const userId=String(reg?.registration?.userId||''); if(userId) createNotification_(userId,'Daftar Ulang Selesai','Dokumen dan pembayaran daftar ulang telah lengkap.','SUCCESS');
  }
}

// =====================================================
// STAGE 6 - VERIFIKASI
// =====================================================

// =====================================================
// STAGE 11 - DASHBOARD & REPORTING
// =====================================================

const PSB_DASHBOARD_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'];
const PSB_REPORT_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'];
const PSB_MONITORING_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'];
const PSB_INCIDENT_ROLES = ['SUPERADMIN','ADMIN_PSB'];
const PSB_INCIDENT_STATUSES = ['OPEN','INVESTIGATING','RESOLVED','CLOSED'];
const PSB_INCIDENT_PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'];

function getDashboardPageData(sessionToken) {
  const actor = requireRole_(sessionToken, PSB_DASHBOARD_ROLES);
  const dashboardCache = CacheService.getScriptCache();
  const actorRoles = String(actor.role || '').split(',').map(r=>r.trim().toUpperCase()).filter(Boolean).sort().join(',');
  const dashboardKey = 'PSB_DASHBOARD_V4_' + String(getConfig_('ACTIVE_YEAR') || '2027/2028').replace(/[^A-Za-z0-9_-]/g, '_') + '_' + sha256Hex_(actorRoles).substring(0, 16);
  const dashboardCached = dashboardCache.get(dashboardKey);
  if (dashboardCached) {
    try { return JSON.parse(dashboardCached); } catch (e) {}
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '2027/2028');
  const regs = sheetRows_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS));
  const candidates = sheetRows_(ss.getSheetByName(PSB_SHEETS.CANDIDATES));
  const users = sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const bills = sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS));
  const payments = sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENTS));
  const participants = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS));
  const results = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS));
  const reregistrations = sheetRows_(ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS));
  const schedules = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE));
  const yearMasters = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN));
  const jenjangMasters = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_JENJANG));
  const gelombangMasters = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_GELOMBANG));
  const candidateMap = {};
  candidates.forEach(x => candidateMap[String(x.candidateId)] = x);
  const userMap = {};
  users.forEach(x => userMap[String(x.userId)] = x);
  const yearMap = {};
  yearMasters.forEach(x => yearMap[String(x.tahunAjaranId)] = x);
  const jenjangMap = {};
  jenjangMasters.forEach(x => jenjangMap[String(x.jenjangId)] = x);
  const gelombangMap = {};
  gelombangMasters.forEach(x => gelombangMap[String(x.gelombangId)] = x);

  // Dashboard hanya menghitung periode aktif agar angka operasional tidak tercampur tahun ajaran lama.
  const activeYearId = yearMasters.find(x => String(x.name || '') === activeYear)?.tahunAjaranId || '';
  const periodRegs = activeYearId ? regs.filter(x => String(x.tahunAjaranId) === String(activeYearId)) : regs;
  const periodRegIds = {};
  periodRegs.forEach(x => periodRegIds[String(x.registrationId)] = true);
  const periodBills = bills.filter(x => periodRegIds[String(x.registrationId)]);
  const periodPayments = payments.filter(x => periodRegIds[String(x.registrationId)]);
  const periodParticipants = participants.filter(x => periodRegIds[String(findParticipantRegistration_(x, participants))]);
  const periodResults = results.filter(x => periodRegIds[String(x.registrationId)]);
  const periodRereg = reregistrations.filter(x => periodRegIds[String(x.registrationId)]);

  const byStatus = {};
  periodRegs.forEach(x => { const k=String(x.status||'UNKNOWN').toUpperCase(); byStatus[k]=(byStatus[k]||0)+1; });
  const paymentByStatus = {unpaid:0,review:0,paid:0,rejected:0};
  periodBills.forEach(b => {
    const st=String(b.status||'').toUpperCase();
    if(st==='PAID') paymentByStatus.paid++;
    else if(st==='PAYMENT_REVIEW') paymentByStatus.review++;
    else paymentByStatus.unpaid++;
    const p=periodPayments.filter(x=>String(x.billId)===String(b.billId)).sort((a,z)=>new Date(z.createdAt||0)-new Date(a.createdAt||0))[0];
    if(String(p?.status||'').toUpperCase()==='REJECTED') paymentByStatus.rejected++;
  });
  const resultCounts={passed:0,notPassed:0,waitlist:0,pending:0};
  periodResults.forEach(x=>{const st=String(x.status||'').toUpperCase();if(st==='PASSED')resultCounts.passed++;else if(st==='NOT_PASSED')resultCounts.notPassed++;else if(st==='WAITLIST')resultCounts.waitlist++;else resultCounts.pending++;});
  const reregCounts={pending:0,paymentVerified:0,completed:0};
  periodRereg.forEach(x=>{const st=String(x.status||'').toUpperCase();if(st==='COMPLETED')reregCounts.completed++;else if(st==='PAYMENT_VERIFIED')reregCounts.paymentVerified++;else reregCounts.pending++;});
  const jenjangCounts={};
  periodRegs.forEach(x=>{const name=jenjangMap[String(x.jenjangId)]?.name||'Belum dipilih';jenjangCounts[name]=(jenjangCounts[name]||0)+1;});
  const gelombangCounts={};
  periodRegs.forEach(x=>{const name=gelombangMap[String(x.gelombangId)]?.name||'Belum dipilih';gelombangCounts[name]=(gelombangCounts[name]||0)+1;});
  const revenue = periodBills.filter(x=>String(x.status||'').toUpperCase()==='PAID').reduce((sum,x)=>sum+(Number(x.amount)||0),0);

  const role = String(actor.role||'').split(',').map(x=>x.trim().toUpperCase());
  const isWali = role.indexOf('WALI') >= 0;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tomorrow = Utilities.formatDate(tomorrowDate, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  const candidateNameByReg = {};
  periodRegs.forEach(r => { candidateNameByReg[String(r.registrationId)] = String(candidateMap[String(r.candidateId)]?.fullName || '-'); });
  const makeTask = (r, type, label, action, extra) => ({registrationId:r.registrationId,registrationNumber:r.registrationNumber||'',candidateName:candidateNameByReg[String(r.registrationId)]||'-',status:String(r.status||''),statusLabel:statusLabel_(String(r.status||'')),type,label,action,updatedAt:r.updatedAt||r.createdAt||'',...extra});
  const verificationItems = periodRegs.filter(r=>['SUBMITTED','UNDER_REVIEW','REVISION'].indexOf(String(r.status||'').toUpperCase())>=0).sort((a,b)=>new Date(a.updatedAt||a.createdAt||0)-new Date(b.updatedAt||b.createdAt||0));
  const paymentItems = periodBills.filter(b=>String(b.status||'').toUpperCase()==='PAYMENT_REVIEW').map(b=>{const r=periodRegs.find(x=>String(x.registrationId)===String(b.registrationId));return r?makeTask(r,'PAYMENT','Bukti pembayaran menunggu verifikasi','payments',{billId:b.billId,amount:Number(b.amount)||0}):null;}).filter(Boolean).sort((a,b)=>new Date(a.updatedAt||0)-new Date(b.updatedAt||0));
  const participantMap = {}; periodParticipants.forEach(x=>participantMap[String(x.registrationId)] = x);
  const selectionItems = periodParticipants.filter(x=>['SCHEDULED','PRESENT','PENDING'].indexOf(String(x.status||'').toUpperCase())>=0).map(x=>{const r=periodRegs.find(reg=>String(reg.registrationId)===String(x.registrationId));return r?makeTask(r,'SELECTION','Peserta tes perlu ditindaklanjuti','selection',{participantId:x.participantId,scheduleId:x.scheduleId,participantStatus:String(x.status||'')}):null;}).filter(Boolean);
  const scheduleItems = schedules.filter(x=>String(x.isActive).toUpperCase()==='TRUE' && [today,tomorrow].indexOf(String(x.selectionDate||'').slice(0,10))>=0).sort((a,b)=>String(a.selectionDate||'').localeCompare(String(b.selectionDate||'')));
  const publishItems = periodResults.filter(x=>['PASSED','NOT_PASSED','WAITLIST'].indexOf(String(x.status||'').toUpperCase())>=0 && !String(x.announcementDate||'').trim()).map(x=>{const r=periodRegs.find(reg=>String(reg.registrationId)===String(x.registrationId));return r?makeTask(r,'ANNOUNCEMENT','Hasil seleksi siap dipublikasikan','announcement',{resultId:x.resultId,resultStatus:String(x.status||'')}):null;}).filter(Boolean);
  const reregItems = periodRereg.filter(x=>['PENDING','PAYMENT_PENDING','PAYMENT_VERIFIED'].indexOf(String(x.status||'').toUpperCase())>=0).map(x=>{const r=periodRegs.find(reg=>String(reg.registrationId)===String(x.registrationId));return r?makeTask(r,'REREGISTRATION','Daftar ulang masih perlu diselesaikan','reregistration',{reregistrationId:x.reregistrationId,reregistrationStatus:String(x.status||'')}):null;}).filter(Boolean);
  const operational = {
    activeSchedules:schedules.filter(x=>String(x.isActive).toUpperCase()==='TRUE').length,
    activeUsers:users.filter(x=>String(x.status).toUpperCase()==='ACTIVE').length,
    today,
    verification:{count:verificationItems.length,items:verificationItems.slice(0,6).map(r=>makeTask(r,'VERIFICATION',String(r.status||'')==='REVISION'?'Pendaftaran perlu diperbaiki':'Pendaftaran menunggu pemeriksaan','verification'))},
    payments:{count:paymentItems.length,items:paymentItems.slice(0,6)},
    selection:{count:selectionItems.length,items:selectionItems.slice(0,6)},
    schedules:{today:scheduleItems.filter(x=>String(x.selectionDate||'').slice(0,10)===today),tomorrow:scheduleItems.filter(x=>String(x.selectionDate||'').slice(0,10)===tomorrow)},
    announcements:{count:publishItems.length,items:publishItems.slice(0,6)},
    reregistration:{count:reregItems.length,items:reregItems.slice(0,6)}
  };
  const response = {
    success:true, activeYear,
    summary:{total:periodRegs.length,submitted:(byStatus.SUBMITTED||0),underReview:(byStatus.UNDER_REVIEW||0),revision:(byStatus.REVISION||0),verified:(byStatus.VERIFIED||0),paymentVerified:(byStatus.PAYMENT_VERIFIED||0),selection:(byStatus.SELECTION||0),reregistration:(byStatus.REREGISTRATION||0),completed:(byStatus.COMPLETED||0)},
    payments:paymentByStatus, selection:{participants:periodParticipants.length,results:periodResults.length,...resultCounts}, reregistration:reregCounts,
    finance:{paidAmount:revenue}, distributions:{jenjang:sortCountMap_(jenjangCounts),gelombang:sortCountMap_(gelombangCounts)},
    operational,
    permissions:{canReport:role.some(r=>PSB_REPORT_ROLES.indexOf(r)>=0),canVerification:role.some(r=>PSB_VERIFICATION_ROLES.indexOf(r)>=0),canPayments:role.some(r=>PSB_PAYMENT_MANAGE_ROLES.indexOf(r)>=0),canSelection:role.some(r=>PSB_SELECTION_ADMIN_ROLES.indexOf(r)>=0),canAnnouncement:role.some(r=>PSB_ANNOUNCEMENT_ADMIN_ROLES.indexOf(r)>=0),canReregistration:role.some(r=>PSB_REREGISTRATION_ADMIN_ROLES.indexOf(r)>=0),canMonitoring:role.some(r=>PSB_MONITORING_ROLES.indexOf(r)>=0),canIncident:role.some(r=>PSB_INCIDENT_ROLES.indexOf(r)>=0),canChat:role.some(r=>PSB_CHAT_ACCESS_ROLES.indexOf(r)>=0)},
    generatedAt:new Date().toISOString()
  };
  try { dashboardCache.put(dashboardKey, JSON.stringify(response), 30); } catch (e) {}
  return response;
}

function findParticipantRegistration_(participant) {
  return participant && participant.registrationId ? participant.registrationId : '';
}
function sortCountMap_(obj) {
  return Object.keys(obj||{}).map(k=>({name:k,count:Number(obj[k]||0)})).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name));
}


// =====================================================
// STAGE 24 - PRODUCTION READINESS
// =====================================================
function getProductionReadiness(sessionToken) {
  const actor = requireRole_(sessionToken, ['SUPERADMIN','ADMIN_PSB']);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '').trim();
  const checks = [];
  const add = (key, label, status, detail, meta) => checks.push(Object.assign({key,label,status,detail}, meta || {}));
  const requiredSheets = Object.keys(PSB_SHEETS).map(k => PSB_SHEETS[k]);
  const missingSheets = requiredSheets.filter(name => !ss.getSheetByName(name));
  add('sheets','Struktur Spreadsheet',missingSheets.length?'ERROR':'OK',missingSheets.length?'Sheet belum tersedia: '+missingSheets.join(', '):'Semua sheet aplikasi tersedia.',{category:'Foundation'});

  const configSheet = ss.getSheetByName('CONFIG');
  const configValues = {};
  if (configSheet && configSheet.getLastRow() >= 2) {
    configSheet.getRange(2,1,configSheet.getLastRow()-1,2).getValues().forEach(r=>{if(String(r[0]||'').trim()) configValues[String(r[0]).trim()]=r[1];});
  }
  add('activeYear','Tahun ajaran aktif',activeYear?'OK':'ERROR',activeYear?('Periode aktif: '+activeYear):'ACTIVE_YEAR belum dikonfigurasi.',{category:'Configuration'});
  add('timezone','Timezone aplikasi',String(PSB_SETUP.TIMEZONE||'').trim()?'OK':'WARNING',String(PSB_SETUP.TIMEZONE||'')||'Timezone belum ditetapkan.',{category:'Configuration'});
  add('registrationOpen','Status penerimaan',String(configValues.REGISTRATION_OPEN).toUpperCase()==='TRUE'?'OPEN':'CLOSED',String(configValues.REGISTRATION_OPEN).toUpperCase()==='TRUE'?'Pendaftaran sedang terbuka.':'Pendaftaran sedang tidak dibuka.',{category:'Configuration'});
  const rootId=String(props.getProperty('PSB_DRIVE_ROOT_ID')||'').trim();
  const yearId=String(props.getProperty('PSB_DRIVE_YEAR_ID')||'').trim();
  let rootOk=false, yearOk=false;
  if(rootId){try{DriveApp.getFolderById(rootId);rootOk=true}catch(e){}}
  if(yearId){try{DriveApp.getFolderById(yearId);yearOk=true}catch(e){}}
  add('driveRoot','Folder Drive utama',rootOk?'OK':'ERROR',rootOk?'Folder Drive utama dapat diakses.':'ID folder Drive utama belum ada atau tidak dapat diakses.',{category:'Storage'});
  add('driveYear','Folder tahun aktif',yearOk?'OK':'WARNING',yearOk?'Folder Drive tahun aktif dapat diakses.':'Folder tahun aktif belum tersedia; aplikasi dapat membuatnya saat diperlukan.',{category:'Storage'});

  const users = sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const activeSuperadmins = users.filter(u=>String(u.status).toUpperCase()==='ACTIVE' && String(u.role).toUpperCase().split(',').map(x=>x.trim()).indexOf('SUPERADMIN')>=0);
  add('superadmin','Akun SUPERADMIN aktif',activeSuperadmins.length?'OK':'ERROR',activeSuperadmins.length?activeSuperadmins.length+' akun SUPERADMIN aktif.':'Tidak ditemukan akun SUPERADMIN aktif.',{category:'Security'});
  const sessionSheet=ss.getSheetByName(PSB_SHEETS.SESSIONS);
  const auditSheet=ss.getSheetByName(PSB_SHEETS.AUDIT_LOG);
  add('securitySheets','Session & audit',sessionSheet&&auditSheet?'OK':'ERROR',sessionSheet&&auditSheet?'SESSIONS dan AUDIT_LOG tersedia.':'SESSIONS atau AUDIT_LOG belum tersedia.',{category:'Security'});

  const idFields = [[PSB_SHEETS.USERS,'userId'],[PSB_SHEETS.REGISTRATIONS,'registrationId'],[PSB_SHEETS.CANDIDATES,'candidateId'],[PSB_SHEETS.DOCUMENTS,'documentId'],[PSB_SHEETS.BILLS,'billId'],[PSB_SHEETS.PAYMENTS,'paymentId']];
  let duplicateIds=[];
  idFields.forEach(([sheetName,idField])=>{const rows=sheetRows_(ss.getSheetByName(sheetName));const seen={};rows.forEach(r=>{const id=String(r[idField]||'').trim();if(!id)return;seen[id]=(seen[id]||0)+1;});Object.keys(seen).filter(id=>seen[id]>1).forEach(id=>duplicateIds.push(sheetName+': '+id+' ('+seen[id]+')'));});
  add('duplicateIds','Duplikasi ID utama',duplicateIds.length?'ERROR':'OK',duplicateIds.length?'Ditemukan: '+duplicateIds.slice(0,10).join('; '):'Tidak ditemukan duplikasi pada ID utama yang diperiksa.',{category:'Data Integrity'});

  const testTokens=['TEST-','example.test'];
  let testRows=0;
  [PSB_SHEETS.USERS,PSB_SHEETS.REGISTRATIONS,PSB_SHEETS.CANDIDATES,PSB_SHEETS.GUARDIANS,PSB_SHEETS.ADDRESSES,PSB_SHEETS.SCHOOLS,PSB_SHEETS.DOCUMENTS,PSB_SHEETS.BILLS,PSB_SHEETS.PAYMENTS,PSB_SHEETS.PAYMENT_VERIFICATIONS,PSB_SHEETS.SELECTION_SCHEDULE,PSB_SHEETS.SELECTION_PARTICIPANTS,PSB_SHEETS.SELECTION_SCORES,PSB_SHEETS.SELECTION_RESULTS,PSB_SHEETS.REREGISTRATIONS].forEach(name=>{sheetRows_(ss.getSheetByName(name)).forEach(r=>{const joined=Object.keys(r).map(k=>String(r[k]||'')).join('|');if(testTokens.some(t=>joined.indexOf(t)>=0))testRows++;});});
  add('testData','Dummy/test data',testRows?'WARNING':'OK',testRows?testRows+' baris terindikasi mengandung TEST-/example.test. Pastikan hanya data produksi yang dipakai.':'Tidak ditemukan indikator dummy TEST-/example.test.',{category:'Data Integrity'});

  const requiredConfigKeys=['APP_NAME','ACTIVE_YEAR'];
  const missingConfig=requiredConfigKeys.filter(k=>!String(configValues[k]||'').trim());
  add('requiredConfig','Konfigurasi minimum',missingConfig.length?'ERROR':'OK',missingConfig.length?'Config belum ada: '+missingConfig.join(', '):'Konfigurasi minimum tersedia.',{category:'Configuration'});
  const errors=checks.filter(x=>x.status==='ERROR').length;
  const warnings=checks.filter(x=>x.status==='WARNING'||x.status==='CLOSED').length;
  const result={success:true,checkedAt:new Date().toISOString(),activeYear,checks,summary:{total:checks.length,errors,warnings,ok:checks.length-errors-warnings},productionReady:errors===0};
  writeAudit_(actor.userId,'PRODUCTION_READINESS','SYSTEM','', '', JSON.stringify({errors,warnings}), 'Pemeriksaan production readiness dijalankan');
  return result;
}


function psbDate_(value){
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}
function psbAgeDays_(value){
  const d=psbDate_(value); if(!d) return null;
  return Math.max(0, (Date.now()-d.getTime())/86400000);
}
function psbAgingBand_(days){
  if(days===null || days===undefined) return 'UNKNOWN';
  if(days < 1) return 'NORMAL';
  if(days <= 2) return 'ATTENTION';
  return 'OVERDUE';
}
function psbAgingLabel_(band){ return ({NORMAL:'< 1 hari',ATTENTION:'1–2 hari',OVERDUE:'> 2 hari',UNKNOWN:'Tidak diketahui'})[band] || band; }
function psbActiveYearRegistrationSet_(ss){
  const activeYear=String(getConfig_('ACTIVE_YEAR')||'2027/2028');
  const years=sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN));
  const id=years.find(x=>String(x.name||'')===activeYear)?.tahunAjaranId||'';
  const regs=sheetRows_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS));
  const period=id?regs.filter(x=>String(x.tahunAjaranId)===String(id)):regs;
  const ids={}; period.forEach(x=>ids[String(x.registrationId)]=true);
  return {activeYear,period,ids};
}

function getMonitoringPageData(sessionToken){
  const actor=requireRole_(sessionToken,PSB_MONITORING_ROLES);
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const period=psbActiveYearRegistrationSet_(ss);
  const regs=period.period, regIds=period.ids;
  const candidates=sheetRows_(ss.getSheetByName(PSB_SHEETS.CANDIDATES));
  const users=sheetRows_(ss.getSheetByName(PSB_SHEETS.USERS));
  const bills=sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS)).filter(x=>regIds[String(x.registrationId)]);
  const payments=sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENTS)).filter(x=>regIds[String(x.registrationId)]);
  const verificationsAll=sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENT_VERIFICATIONS));
  const docs=sheetRows_(ss.getSheetByName(PSB_SHEETS.DOCUMENTS)).filter(x=>regIds[String(x.registrationId)]);
  const participants=sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS)).filter(x=>regIds[String(x.registrationId)]);
  const schedules=sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE));
  const scores=sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCORES));
  const results=sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS)).filter(x=>regIds[String(x.registrationId)]);
  const rereg=sheetRows_(ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS)).filter(x=>regIds[String(x.registrationId)]);
  const incidents=sheetRows_(ss.getSheetByName(PSB_SHEETS.INCIDENTS));
  const candidateMap={};candidates.forEach(x=>candidateMap[String(x.candidateId)]=x);
  const regMap={};regs.forEach(x=>regMap[String(x.registrationId)]=x);
  const paymentMap={};payments.forEach(x=>paymentMap[String(x.paymentId)]=x);
  const verifications=verificationsAll.filter(x=>paymentMap[String(x.paymentId)]);
  const billMap={};bills.forEach(x=>billMap[String(x.billId)]=x);
  const participantMap={};participants.forEach(x=>participantMap[String(x.participantId)]=x);
  const userMap={};users.forEach(x=>userMap[String(x.userId)]=x);
  const now=new Date();
  const task=(registrationId,type,label,stamp,extra)=>{const r=regMap[String(registrationId)]||{};const days=psbAgeDays_(stamp);return {registrationId,registrationNumber:r.registrationNumber||'',candidateName:String(candidateMap[String(r.candidateId)]?.fullName||'-'),status:String(r.status||''),type,label,ageDays:days===null?null:Math.round(days*10)/10,aging:psbAgingBand_(days),agingLabel:psbAgingLabel_(psbAgingBand_(days)),timestamp:stamp||'',...extra};};
  const verification=regs.filter(r=>['SUBMITTED','UNDER_REVIEW','REVISION'].indexOf(String(r.status||'').toUpperCase())>=0).map(r=>task(r.registrationId,'VERIFICATION',String(r.status||'')==='REVISION'?'Perlu perbaikan':'Menunggu verifikasi',r.submittedAt||r.updatedAt||r.createdAt,{}));
  const paymentQueue=bills.filter(b=>['PAYMENT_REVIEW','PENDING'].indexOf(String(b.status||'').toUpperCase())>=0).map(b=>{const p=payments.filter(x=>String(x.billId)===String(b.billId)).sort((a,z)=>new Date(z.createdAt||0)-new Date(a.createdAt||0))[0];return task(b.registrationId,'PAYMENT','Pembayaran perlu ditindaklanjuti',p?.submittedAt||b.updatedAt||b.createdAt,{billId:b.billId,paymentId:p?.paymentId||'',amount:Number(b.amount)||0});});
  const selectionQueue=participants.filter(p=>['SCHEDULED','PRESENT','PENDING'].indexOf(String(p.status||'').toUpperCase())>=0).map(p=>task(p.registrationId,'SELECTION','Peserta tes perlu ditindaklanjuti',p.createdAt||p.updatedAt,{participantId:p.participantId,scheduleId:p.scheduleId,participantStatus:p.status}));
  const publishQueue=results.filter(x=>['PASSED','NOT_PASSED','WAITLIST'].indexOf(String(x.status||'').toUpperCase())>=0&&!String(x.announcementDate||'').trim()).map(x=>task(x.registrationId,'ANNOUNCEMENT','Hasil siap dipublikasikan',x.createdAt||x.updatedAt,{resultId:x.resultId,resultStatus:x.status}));
  const reregQueue=rereg.filter(x=>['PENDING','PAYMENT_PENDING','PAYMENT_VERIFIED'].indexOf(String(x.status||'').toUpperCase())>=0).map(x=>task(x.registrationId,'REREGISTRATION','Daftar ulang belum selesai',x.updatedAt||x.createdAt,{reregistrationId:x.reregistrationId,reregistrationStatus:x.status}));
  const queues=[...verification,...paymentQueue,...selectionQueue,...publishQueue,...reregQueue];
  const aging={NORMAL:0,ATTENTION:0,OVERDUE:0,UNKNOWN:0}; queues.forEach(x=>aging[x.aging]=(aging[x.aging]||0)+1);

  // Payment reconciliation: bill ↔ payment ↔ verification.
  const paymentExceptions=[]; const seenPayments={}; const seenVerifications={};
  bills.forEach(b=>{const ps=payments.filter(p=>String(p.billId)===String(b.billId)); if(!ps.length) paymentExceptions.push({type:'BILL_WITHOUT_PAYMENT',severity:'WARNING',recordId:b.billId,detail:'Tagihan belum memiliki pembayaran.'}); ps.forEach(p=>{seenPayments[String(p.paymentId)]=true; const amountMismatch=Math.abs(Number(p.amount||0)-Number(b.amount||0))>0.001; if(amountMismatch) paymentExceptions.push({type:'AMOUNT_MISMATCH',severity:'ERROR',recordId:p.paymentId,detail:'Nominal pembayaran berbeda dengan tagihan.'});});});
  payments.forEach(p=>{if(!billMap[String(p.billId)]) paymentExceptions.push({type:'PAYMENT_WITHOUT_BILL',severity:'ERROR',recordId:p.paymentId,detail:'Pembayaran tidak memiliki tagihan yang valid.'}); const vs=verifications.filter(v=>String(v.paymentId)===String(p.paymentId)); if(vs.length>1) paymentExceptions.push({type:'DUPLICATE_VERIFICATION',severity:'ERROR',recordId:p.paymentId,detail:'Lebih dari satu record verifikasi pembayaran.'}); if(vs.length) vs.forEach(v=>seenVerifications[String(v.verificationId)]=true);});
  verifications.forEach(v=>{if(!paymentMap[String(v.paymentId)]) paymentExceptions.push({type:'VERIFICATION_WITHOUT_PAYMENT',severity:'ERROR',recordId:v.verificationId,detail:'Verifikasi tidak memiliki pembayaran yang valid.'});});
  const billDuplicate={};bills.forEach(b=>{const k=String(b.registrationId)+'|'+String(b.paymentTypeId);billDuplicate[k]=(billDuplicate[k]||0)+1;}); Object.keys(billDuplicate).filter(k=>billDuplicate[k]>1).slice(0,50).forEach(k=>paymentExceptions.push({type:'DUPLICATE_BILL',severity:'ERROR',recordId:k,detail:'Terdapat lebih dari satu tagihan untuk kombinasi pendaftaran dan jenis pembayaran.'}));

  // Registration reconciliation: relationship chain across core operational sheets.
  const regExceptions=[]; const childSheets=[['DOCUMENTS','registrationId'],['BILLS','registrationId'],['PAYMENTS','registrationId'],['SELECTION_PARTICIPANTS','registrationId'],['SELECTION_RESULTS','registrationId'],['REREGISTRATIONS','registrationId']];
  regs.forEach(r=>{if(!String(r.userId||'').trim()||!userMap[String(r.userId)]) regExceptions.push({type:'REGISTRATION_USER_MISSING',severity:'ERROR',recordId:r.registrationId,detail:'Pendaftaran tidak memiliki user wali yang valid.'}); if(!String(r.candidateId||'').trim()||!candidateMap[String(r.candidateId)]) regExceptions.push({type:'REGISTRATION_CANDIDATE_MISSING',severity:'ERROR',recordId:r.registrationId,detail:'Pendaftaran tidak memiliki calon santri yang valid.'});});
  const allChildRows={DOCUMENTS:sheetRows_(ss.getSheetByName(PSB_SHEETS.DOCUMENTS)),BILLS:sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS)),PAYMENTS:sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENTS)),SELECTION_PARTICIPANTS:sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS)),SELECTION_RESULTS:sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS)),REREGISTRATIONS:sheetRows_(ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS))};
  childSheets.forEach(([sheet,field])=>{(allChildRows[sheet]||[]).filter(x=>String(x[field]||'').trim()&&!regIds[String(x[field])]).slice(0,50).forEach(x=>{const idField=Object.keys(x).find(k=>/Id$/.test(k))||field;regExceptions.push({type:'ORPHAN_'+sheet,severity:'ERROR',recordId:x[idField]||x[field],detail:sheet+' mengarah ke registrationId yang tidak ada pada periode aktif.'});});});
  docs.forEach(d=>{if(!String(d.fileId||'').trim()) regExceptions.push({type:'DOCUMENT_FILE_MISSING',severity:'WARNING',recordId:d.documentId,detail:'Dokumen memiliki record tetapi fileId kosong.'});});
  participants.forEach(p=>{if(!schedules.some(s=>String(s.scheduleId)===String(p.scheduleId))) regExceptions.push({type:'PARTICIPANT_SCHEDULE_MISSING',severity:'ERROR',recordId:p.participantId,detail:'Peserta tes mengarah ke jadwal yang tidak tersedia.'});});
  scores.forEach(sc=>{if(!participantMap[String(sc.participantId)]) regExceptions.push({type:'SCORE_PARTICIPANT_MISSING',severity:'ERROR',recordId:sc.scoreId,detail:'Nilai mengarah ke peserta tes yang tidak tersedia.'});});

  const allExceptions=paymentExceptions.concat(regExceptions); const severityCounts={ERROR:0,WARNING:0}; allExceptions.forEach(x=>severityCounts[x.severity]=(severityCounts[x.severity]||0)+1);
  const openIncidents=incidents.filter(x=>['OPEN','INVESTIGATING'].indexOf(String(x.status||'').toUpperCase())>=0).length;
  const dailyKey=Utilities.formatDate(now,Session.getScriptTimeZone()||'Asia/Jakarta','yyyy-MM-dd');
  const daily={date:dailyKey,newRegistrations:regs.filter(r=>String(r.createdAt||'').slice(0,10)===dailyKey).length,submitted:regs.filter(r=>String(r.submittedAt||'').slice(0,10)===dailyKey).length,paymentsSubmitted:payments.filter(r=>String(r.submittedAt||'').slice(0,10)===dailyKey).length,paymentsVerified:verifications.filter(r=>String(r.verifiedAt||'').slice(0,10)===dailyKey&&String(r.status||'').toUpperCase()==='VERIFIED').length,selectionParticipants:participants.filter(r=>String(r.createdAt||'').slice(0,10)===dailyKey).length,announcements:results.filter(r=>String(r.announcementDate||'').slice(0,10)===dailyKey).length,reregCompleted:rereg.filter(r=>String(r.completedAt||'').slice(0,10)===dailyKey).length};
  const response={success:true,activeYear:period.activeYear,generatedAt:now.toISOString(),sla:{thresholds:{normal:'< 1 hari',attention:'1–2 hari',overdue:'> 2 hari'},counts:aging,total:queues.length,overdue:queues.filter(x=>x.aging==='OVERDUE').slice(0,20),attention:queues.filter(x=>x.aging==='ATTENTION').slice(0,20)},reconciliation:{payments:{exceptions:paymentExceptions.slice(0,100),summary:{total:paymentExceptions.length,errors:paymentExceptions.filter(x=>x.severity==='ERROR').length,warnings:paymentExceptions.filter(x=>x.severity==='WARNING').length}},registrations:{exceptions:regExceptions.slice(0,100),summary:{total:regExceptions.length,errors:regExceptions.filter(x=>x.severity==='ERROR').length,warnings:regExceptions.filter(x=>x.severity==='WARNING').length}}},exceptions:{total:allExceptions.length,errors:severityCounts.ERROR||0,warnings:severityCounts.WARNING||0,items:allExceptions.slice(0,100)},incidents:{open:openIncidents,total:incidents.length},daily,permissions:{canIncident:hasRoleDirect_(actor,PSB_INCIDENT_ROLES)}};
  writeAudit_(actor.userId,'MONITORING_VIEW','OPERATIONS','', '', JSON.stringify({exceptions:allExceptions.length,openIncidents}), 'Monitoring operasional dan rekonsiliasi dijalankan');
  return response;
}

function getIncidentPageData(sessionToken){
  const actor=requireRole_(sessionToken,PSB_INCIDENT_ROLES); const ss=SpreadsheetApp.getActiveSpreadsheet();
  const incidents=sheetRows_(ss.getSheetByName(PSB_SHEETS.INCIDENTS)).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  return {success:true,items:incidents.slice(0,200),statuses:PSB_INCIDENT_STATUSES,priorities:PSB_INCIDENT_PRIORITIES,actorRole:actor.role};
}
function saveIncident(sessionToken,payload){
  const actor=requireRole_(sessionToken,PSB_INCIDENT_ROLES); assertOperationalMutation_(actor); payload=payload||{};
  const title=String(payload.title||'').trim(), description=String(payload.description||'').trim(); if(!title)return fail_('Judul insiden wajib diisi.'); if(!description)return fail_('Deskripsi insiden wajib diisi.');
  const priority=String(payload.priority||'MEDIUM').toUpperCase(); if(PSB_INCIDENT_PRIORITIES.indexOf(priority)<0)return fail_('Prioritas insiden tidak valid.');
  const status=String(payload.status||'OPEN').toUpperCase(); if(PSB_INCIDENT_STATUSES.indexOf(status)<0)return fail_('Status insiden tidak valid.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.INCIDENTS); if(!sheet)return fail_('Sheet INCIDENTS belum tersedia.');
  const now=new Date(), existingId=String(payload.incidentId||'').trim(); let row=null, old=null;
  if(existingId){const found=findRowById_(sheet,'incidentId',existingId); if(!found)return fail_('Insiden tidak ditemukan.'); row=found.rowNumber; old=found.object;}
  const obj={incidentId:existingId||('INC-'+Utilities.formatDate(now,Session.getScriptTimeZone()||'Asia/Jakarta','yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,8)),category:String(payload.category||'GENERAL').trim().toUpperCase(),priority,status,title,description,relatedModule:String(payload.relatedModule||'').trim(),relatedRecordId:String(payload.relatedRecordId||'').trim(),reportedBy:old?.reportedBy||actor.userId,assignedTo:String(payload.assignedTo||old?.assignedTo||'').trim(),resolutionNote:String(payload.resolutionNote||'').trim(),createdAt:old?.createdAt||now,updatedAt:now,resolvedAt:status==='RESOLVED'||status==='CLOSED'?(old?.resolvedAt||now):'',closedAt:status==='CLOSED'?(old?.closedAt||now):''};
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String); const vals=headers.map(h=>obj[h]===undefined?'':obj[h]); if(row)sheet.getRange(row,1,1,headers.length).setValues([vals]); else sheet.appendRow(vals);
  writeAudit_(actor.userId,old?'INCIDENT_UPDATE':'INCIDENT_CREATE','INCIDENT',obj.incidentId,old?JSON.stringify(old):'',JSON.stringify(obj),old?'Insiden diperbarui':'Insiden dibuat');
  return {success:true,message:old?'Insiden diperbarui.':'Insiden dibuat.',item:rpcSafe_(obj)};
}
function closeIncident(sessionToken,incidentId,resolutionNote){
  const actor=requireRole_(sessionToken,PSB_INCIDENT_ROLES); assertOperationalMutation_(actor); const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.INCIDENTS); if(!sheet)return fail_('Sheet INCIDENTS belum tersedia.');
  const found=findRowById_(sheet,'incidentId',String(incidentId||'')); if(!found)return fail_('Insiden tidak ditemukan.'); const old=found.object; const now=new Date();
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), set={status:'CLOSED',resolutionNote:String(resolutionNote||old.resolutionNote||'').trim(),updatedAt:now,closedAt:now,resolvedAt:old.resolvedAt||now};
  headers.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(set,h))sheet.getRange(found.rowNumber,i+1).setValue(set[h]);});
  writeAudit_(actor.userId,'INCIDENT_CLOSE','INCIDENT',old.incidentId,JSON.stringify(old),JSON.stringify(Object.assign({},old,set)),'Insiden ditutup');
  return {success:true,message:'Insiden ditutup.'};
}

function normalizeReportGender_(gender) {
  const g = String(gender || '').trim().toUpperCase();
  return g === 'L' || g === 'P' ? g : '';
}
function reportGenderName_(gender) {
  const g = normalizeReportGender_(gender);
  return g === 'L' ? 'Laki-laki' : g === 'P' ? 'Perempuan' : 'Belum diisi';
}
function reportGroupName_(jenjangName, gender) {
  const j = String(jenjangName || '').trim() || 'Jenjang belum diisi';
  const g = normalizeReportGender_(gender);
  if (g === 'L') return j + ' Putra';
  if (g === 'P') return j + ' Putri';
  return j + ' · Gender belum diisi';
}

function getReportingPageData(sessionToken, filters) {
  const actor = requireRole_(sessionToken, PSB_REPORT_ROLES);
  filters = filters || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '2027/2028');
  const year = String(filters.tahunAjaranId || '').trim();
  const status = String(filters.status || '').trim().toUpperCase();
  const gelombangId = String(filters.gelombangId || '').trim();
  const jenjangId = String(filters.jenjangId || '').trim();
  const gender = normalizeReportGender_(filters.gender);
  const regs = sheetRows_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS));
  const candidates = sheetRows_(ss.getSheetByName(PSB_SHEETS.CANDIDATES));
  const bills = sheetRows_(ss.getSheetByName(PSB_SHEETS.BILLS));
  const payments = sheetRows_(ss.getSheetByName(PSB_SHEETS.PAYMENTS));
  const participants = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS));
  const results = sheetRows_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS));
  const rereg = sheetRows_(ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS));
  const years = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN));
  const gelombangs = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_GELOMBANG));
  const jenjangs = sheetRows_(ss.getSheetByName(PSB_SHEETS.MASTER_JENJANG));
  const yearMap={},gelombangMap={},jenjangMap={},candidateMap={};
  years.forEach(x=>yearMap[String(x.tahunAjaranId)]=x); gelombangs.forEach(x=>gelombangMap[String(x.gelombangId)]=x); jenjangs.forEach(x=>jenjangMap[String(x.jenjangId)]=x); candidates.forEach(x=>candidateMap[String(x.candidateId)]=x);
  const activeYearId=years.find(x=>String(x.name||'')===activeYear)?.tahunAjaranId||'';
  let rows=regs.filter(r=>!year && activeYearId ? String(r.tahunAjaranId)===String(activeYearId) : (!year || String(r.tahunAjaranId)===year));
  if(gelombangId) rows=rows.filter(r=>String(r.gelombangId)===gelombangId);
  if(jenjangId) rows=rows.filter(r=>String(r.jenjangId)===jenjangId);
  if(gender) rows=rows.filter(r=>normalizeReportGender_(candidateMap[String(r.candidateId)]?.gender)===gender);
  if(status) rows=rows.filter(r=>String(r.status||'').toUpperCase()===status);
  const billMap={}; bills.forEach(b=>{const k=String(b.registrationId);if(!billMap[k])billMap[k]=[];billMap[k].push(b);});
  const paymentMap={}; payments.forEach(p=>{const k=String(p.registrationId);if(!paymentMap[k])paymentMap[k]=[];paymentMap[k].push(p);});
  const participantMap={}; participants.forEach(p=>participantMap[String(p.registrationId)]=p);
  const resultMap={}; results.forEach(r=>resultMap[String(r.registrationId)]=r);
  const reregMap={}; rereg.forEach(r=>reregMap[String(r.registrationId)]=r);
  const dataRows=rows.map(r=>{
    const c=candidateMap[String(r.candidateId)]||{};
    const jenjangName=jenjangMap[String(r.jenjangId)]?.name||'-';
    const billList=billMap[String(r.registrationId)]||[];
    const paid=billList.filter(b=>String(b.status||'').toUpperCase()==='PAID').reduce((sum,b)=>sum+(Number(b.amount)||0),0);
    const latestPayment=(paymentMap[String(r.registrationId)]||[]).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))[0]||{};
    const participant=participantMap[String(r.registrationId)]||{};
    const result=resultMap[String(r.registrationId)]||{};
    const rr=reregMap[String(r.registrationId)]||{};
    return {registrationId:r.registrationId,registrationNumber:r.registrationNumber,candidateName:c.fullName||'-',tahunAjaranName:yearMap[String(r.tahunAjaranId)]?.name||'-',gelombangName:gelombangMap[String(r.gelombangId)]?.name||'-',jenjangName,gender:normalizeReportGender_(c.gender),genderName:reportGenderName_(c.gender),reportGroup:reportGroupName_(jenjangName,c.gender),status:String(r.status||''),submittedAt:r.submittedAt||'',verifiedAt:r.verifiedAt||'',paymentStatus:billList.some(b=>String(b.status).toUpperCase()==='PAID')?'PAID':latestPayment.status||'UNPAID',paidAmount:paid,selectionStatus:result.status||'',announcementDate:result.announcementDate||'',reregistrationStatus:rr.status||'',createdAt:r.createdAt||''};
  });
  const summary={total:dataRows.length,paid:dataRows.filter(x=>x.paymentStatus==='PAID').length,passed:dataRows.filter(x=>String(x.selectionStatus).toUpperCase()==='PASSED').length,completed:dataRows.filter(x=>String(x.reregistrationStatus).toUpperCase()==='COMPLETED'||String(x.status).toUpperCase()==='COMPLETED').length};
  const groupMap={}; dataRows.forEach(x=>{const k=x.reportGroup||'Jenjang · Gender belum diisi'; groupMap[k]=(groupMap[k]||0)+1;});
  const groupBreakdown=Object.keys(groupMap).map(k=>({label:k,count:groupMap[k]})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'id'));
  return {success:true,activeYear,filters:{tahunAjaranId:year||activeYearId,gelombangId,jenjangId,gender,status},summary,groupBreakdown,rows:dataRows,options:{tahunAjaran:years.slice().sort((a,b)=>String(b.name||'').localeCompare(String(a.name||''))),gelombang:gelombangs.filter(x=>year?String(x.tahunAjaranId)===year:String(x.tahunAjaranId)===String(activeYearId)),jenjang:jenjangs.filter(x=>String(x.isActive).toUpperCase()==='TRUE'),gender:[{value:'L',name:'Laki-laki',groupName:'Putra'},{value:'P',name:'Perempuan',groupName:'Putri'}],statuses:['DRAFT','SUBMITTED','UNDER_REVIEW','REVISION','VERIFIED','PAYMENT_VERIFIED','SELECTION','PASSED','NOT_PASSED','REREGISTRATION','COMPLETED']},generatedAt:new Date().toISOString()};
}


function getAdvancedReportingData(sessionToken, filters) {
  const actor = requireRole_(sessionToken, PSB_REPORT_ROLES);
  filters = filters || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeYear = String(getConfig_('ACTIVE_YEAR') || '2027/2028');
  const selectedYear = String(filters.tahunAjaranId || '').trim();
  const gelombangId = String(filters.gelombangId || '').trim();
  const jenjangId = String(filters.jenjangId || '').trim();
  const gender = normalizeReportGender_(filters.gender);
  const status = String(filters.status || '').trim().toUpperCase();
  const fromDate = filters.fromDate ? new Date(filters.fromDate + 'T00:00:00') : null;
  const toDate = filters.toDate ? new Date(filters.toDate + 'T23:59:59') : null;
  const rows = name => sheetRows_(ss.getSheetByName(PSB_SHEETS[name]));
  const regs=rows('REGISTRATIONS'), candidates=rows('CANDIDATES'), bills=rows('BILLS'), payments=rows('PAYMENTS'), participants=rows('SELECTION_PARTICIPANTS'), results=rows('SELECTION_RESULTS'), rereg=rows('REREGISTRATIONS');
  const years=rows('MASTER_TAHUN_AJARAN'), gels=rows('MASTER_GELOMBANG'), jins=rows('MASTER_JENJANG');
  const activeYearId=years.find(x=>String(x.name||'')===activeYear)?.tahunAjaranId||'';
  const yearId=selectedYear||activeYearId;
  const ym={},gm={},jm={},cm={}; years.forEach(x=>ym[String(x.tahunAjaranId)]=x); gels.forEach(x=>gm[String(x.gelombangId)]=x); jins.forEach(x=>jm[String(x.jenjangId)]=x); candidates.forEach(x=>cm[String(x.candidateId)]=x);
  let filtered=regs.filter(r=>String(r.tahunAjaranId||'')===String(yearId));
  if(gelombangId) filtered=filtered.filter(r=>String(r.gelombangId||'')===gelombangId);
  if(jenjangId) filtered=filtered.filter(r=>String(r.jenjangId||'')===jenjangId);
  if(gender) filtered=filtered.filter(r=>normalizeReportGender_(cm[String(r.candidateId)]?.gender)===gender);
  if(status) filtered=filtered.filter(r=>String(r.status||'').toUpperCase()===status);
  if(fromDate||toDate) filtered=filtered.filter(r=>{const d=new Date(r.createdAt||r.submittedAt||0); return (!fromDate||d>=fromDate)&&(!toDate||d<=toDate);});
  const regIds={}; filtered.forEach(r=>regIds[String(r.registrationId)]=true);
  const inScope=a=>a.filter(x=>regIds[String(x.registrationId||'')]);
  const scopedBills=inScope(bills), scopedPayments=inScope(payments), scopedParticipants=inScope(participants), scopedResults=inScope(results), scopedRereg=inScope(rereg);
  const verifiedPayments=scopedPayments.filter(p=>String(p.status||'').toUpperCase()==='VERIFIED');
  const paidBills=scopedBills.filter(b=>String(b.status||'').toUpperCase()==='PAID');
  const passed=scopedResults.filter(r=>String(r.status||'').toUpperCase()==='PASSED');
  const announced=scopedResults.filter(r=>String(r.announcementDate||'').trim());
  const completed=scopedRereg.filter(r=>String(r.status||'').toUpperCase()==='COMPLETED');
  const msPerDay=86400000, days=(a,b)=>{const x=new Date(a||0),y=new Date(b||0); return isNaN(x)||isNaN(y)||!a||!b?null:Math.max(0,(y-x)/msPerDay);};
  const avg=a=>{const v=a.filter(x=>typeof x==='number'&&isFinite(x));return v.length?Math.round((v.reduce((s,x)=>s+x,0)/v.length)*10)/10:null;};
  const by=(arr,keyFn)=>{const m={};arr.forEach(x=>{const k=keyFn(x)||'-';m[k]=(m[k]||0)+1;});return Object.keys(m).map(k=>({label:k,count:m[k]})).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,'id'));};
  const regMap={}; filtered.forEach(r=>regMap[String(r.registrationId)]=r);
  const funnel={registrations:filtered.length,submitted:filtered.filter(r=>String(r.submittedAt||'').trim()).length,verified:filtered.filter(r=>['VERIFIED','PAYMENT_PENDING','PAYMENT_VERIFIED','SELECTION','PASSED','NOT_PASSED','REREGISTRATION','COMPLETED'].includes(String(r.status||''))).length,paymentVerified:filtered.filter(r=>{const id=String(r.registrationId);return scopedPayments.some(p=>String(p.registrationId)===id&&String(p.status||'').toUpperCase()==='VERIFIED')||scopedBills.some(b=>String(b.registrationId)===id&&String(b.status||'').toUpperCase()==='PAID');}).length,selection:scopedParticipants.length,announced:announced.length,passed:passed.length,reregistration:scopedRereg.length,completed:completed.length};
  const conversion={verificationRate:funnel.registrations?Math.round(funnel.verified/funnel.registrations*1000)/10:0,paymentRate:funnel.verified?Math.round(funnel.paymentVerified/funnel.verified*1000)/10:0,selectionRate:funnel.paymentVerified?Math.round(funnel.selection/funnel.paymentVerified*1000)/10:0,passRate:funnel.selection?Math.round(funnel.passed/funnel.selection*1000)/10:0,reregistrationCompletionRate:funnel.passed?Math.round(funnel.completed/funnel.passed*1000)/10:0};
  const trendMap={}; const monthKey=d=>{const x=new Date(d);return isNaN(x)?null:Utilities.formatDate(x,Session.getScriptTimeZone()||'Asia/Jakarta','yyyy-MM');};
  filtered.forEach(r=>{const k=monthKey(r.createdAt||r.submittedAt);if(k){if(!trendMap[k])trendMap[k]={month:k,registrations:0,submitted:0,verified:0};trendMap[k].registrations++;if(r.submittedAt)trendMap[k].submitted++;if(['VERIFIED','PAYMENT_PENDING','PAYMENT_VERIFIED','SELECTION','PASSED','NOT_PASSED','REREGISTRATION','COMPLETED'].includes(String(r.status||'')))trendMap[k].verified++;}});
  const trends=Object.keys(trendMap).sort().map(k=>trendMap[k]);
  const byJenjang=by(filtered,r=>jm[String(r.jenjangId)]?.name||r.jenjangId);
  const byGelombang=by(filtered,r=>gm[String(r.gelombangId)]?.name||r.gelombangId);
  const byStatus=by(filtered,r=>String(r.status||'-'));
  const byKelompok=by(filtered,r=>reportGroupName_(jm[String(r.jenjangId)]?.name||r.jenjangId,cm[String(r.candidateId)]?.gender));
  const outcome={passed:passed.length,notPassed:scopedResults.filter(r=>String(r.status||'').toUpperCase()==='NOT_PASSED').length,waitlist:scopedResults.filter(r=>String(r.status||'').toUpperCase()==='WAITLIST').length,pending:scopedResults.filter(r=>!String(r.status||'').trim()).length};
  const paymentAmount=paidBills.reduce((s,b)=>s+(Number(b.amount)||0),0);
  const processing={registrationToSubmit:avg(filtered.map(r=>days(r.createdAt,r.submittedAt))),submitToVerified:avg(filtered.map(r=>days(r.submittedAt,r.verifiedAt))),paymentToSelection:avg(scopedParticipants.map(p=>{const r=regMap[String(p.registrationId)];return r?days(r.verifiedAt,p.createdAt):null;})),resultToAnnouncement:avg(scopedResults.map(r=>days(r.createdAt,r.announcementDate))),reregistrationCompletion:avg(completed.map(rr=>days(rr.createdAt,rr.completedAt||rr.updatedAt)))};
  const byPaymentType=by(paidBills,b=>String(b.paymentTypeId||'-')).map(x=>{const total=paidBills.filter(b=>String(b.paymentTypeId||'-')===x.label).reduce((s,b)=>s+(Number(b.amount)||0),0);return Object.assign(x,{amount:total});});
  const last30={registrations:filtered.filter(r=>new Date(r.createdAt||0)>=new Date(Date.now()-30*msPerDay)).length,payments:verifiedPayments.filter(p=>new Date(p.submittedAt||p.createdAt||0)>=new Date(Date.now()-30*msPerDay)).length,announcements:announced.filter(r=>new Date(r.announcementDate||0)>=new Date(Date.now()-30*msPerDay)).length};
  writeAudit_(actor.userId,'ADVANCED_REPORT_VIEW','REPORTING','', '', JSON.stringify({yearId,gelombangId,jenjangId,gender,fromDate:filters.fromDate||'',toDate:filters.toDate||''}), 'Advanced Reporting & Analytics dijalankan');
  return {success:true,activeYear,filters:{tahunAjaranId:yearId,gelombangId,jenjangId,gender,status,fromDate:filters.fromDate||'',toDate:filters.toDate||''},funnel,conversion,trends,breakdowns:{jenjang:byJenjang.slice(0,20),kelompok:byKelompok.slice(0,20),gelombang:byGelombang.slice(0,20),status:byStatus.slice(0,20)},outcome,finance:{paidAmount:paymentAmount,paidBills:paidBills.length,byPaymentType:byPaymentType.slice(0,20)},processing,last30,generatedAt:new Date().toISOString()};
}

function exportAdvancedReportingCsv(sessionToken, filters) {
  const actor=requireRole_(sessionToken,PSB_REPORT_ROLES);
  const data=getAdvancedReportingData(sessionToken, filters||{});
  if(!data.success) return data;
  const lines=[['Metric','Value'],['Registrations',data.funnel.registrations],['Submitted',data.funnel.submitted],['Verified',data.funnel.verified],['Payment Verified',data.funnel.paymentVerified],['Selection Participants',data.funnel.selection],['Announced',data.funnel.announced],['Passed',data.funnel.passed],['Reregistration',data.funnel.reregistration],['Completed',data.funnel.completed],['Verification Rate %',data.conversion.verificationRate],['Payment Rate %',data.conversion.paymentRate],['Selection Rate %',data.conversion.selectionRate],['Pass Rate %',data.conversion.passRate],['Reregistration Completion Rate %',data.conversion.reregistrationCompletionRate],['Paid Amount',data.finance.paidAmount],['Paid Bills',data.finance.paidBills]];
  data.trends.forEach(x=>lines.push(['Trend '+x.month+' registrations',x.registrations],['Trend '+x.month+' submitted',x.submitted],['Trend '+x.month+' verified',x.verified]));
  (data.breakdowns?.kelompok||[]).forEach(x=>lines.push(['Kelompok '+x.label,x.count]));
  const csv=lines.map(r=>r.map(v=>{const x=String(v??'');return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;}).join(',')).join('\n');
  return {success:true,filename:'PSB_Fathan_Mubina_Advanced_Analytics.csv',csv:'\ufeff'+csv};
}


const PSB_VERIFICATION_ROLES = ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'];
const PSB_VERIFICATION_REGISTRATION_STATUSES = ['SUBMITTED','UNDER_REVIEW','REVISION','REREGISTRATION'];

function getVerificationQueue(sessionToken, filters) {
  const actor = requireRole_(sessionToken, PSB_VERIFICATION_ROLES);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  if (!sheet || sheet.getLastRow() < 2) return {success:true, registrations:[]};
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  filters = filters || {};
  let items = rows.map((r,i)=>rowObject_(headers,r,i+2));
  const allowed = filters.status ? [String(filters.status)] : ['SUBMITTED','UNDER_REVIEW','REVISION','VERIFIED','REREGISTRATION'];
  items = items.filter(x=>allowed.indexOf(String(x.status))>=0);
  if (filters.search) {
    const q=String(filters.search).trim().toLowerCase();
    items=items.filter(x=>[x.registrationNumber,x.registrationId].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  return {success:true, registrations:enrichRegistrationList_(items).slice(0,200)};
}

function getVerificationDetail(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_VERIFICATION_ROLES);
  const found=findRegistration_(String(registrationId||''));
  if(!found) return fail_('Pendaftaran tidak ditemukan.');
  const documents=getCurrentDocuments_(registrationId);
  const types=getActiveMasterItems_('MASTER_DOKUMEN');
  const byType={}; documents.forEach(d=>byType[String(d.documentTypeId)]=d);
  const checklist=types.map(t=>Object.assign({},t,{document:byType[String(t.documentTypeId)]||null,uploaded:!!byType[String(t.documentTypeId)]}));
  return {success:true,registration:found.registration,candidate:found.candidate,guardian:found.guardian,address:found.address,school:found.school,documents,checklist};
}

function startVerification(sessionToken, registrationId) {
  const actor=requireRole_(sessionToken,PSB_VERIFICATION_ROLES);
  assertOperationalMutation_(actor);
  const found=findRegistration_(String(registrationId||''));
  if(!found) return fail_('Pendaftaran tidak ditemukan.');
  const status=String(found.registration.status||'');
  if(['SUBMITTED','REVISION'].indexOf(status)<0) return fail_('Pendaftaran tidak berada pada status yang dapat diverifikasi.');
  const result=setRegistrationStatus_(found.registration, 'UNDER_REVIEW', actor.userId, 'Pendaftaran masuk proses verifikasi');
  return result;
}

function verifyDocument(sessionToken, payload) {
  const actor=requireRole_(sessionToken,PSB_VERIFICATION_ROLES);
  assertOperationalMutation_(actor);
  payload=payload||{};
  const documentId=String(payload.documentId||'').trim();
  const status=String(payload.status||'').toUpperCase();
  const note=String(payload.note||'').trim();
  if(!documentId) return fail_('Dokumen belum dipilih.');
  if(['VERIFIED','REVISION'].indexOf(status)<0) return fail_('Status verifikasi dokumen tidak valid.');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.DOCUMENTS);
  if(!sheet || sheet.getLastRow()<2) return fail_('Dokumen tidak ditemukan.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const found=findRowById_(sheet,'documentId',documentId);
  if(!found) return fail_('Dokumen tidak ditemukan.');
  const reg=findRegistration_(String(found.object.registrationId||''));
  if(!reg) return fail_('Pendaftaran dokumen tidak ditemukan.');
  if(PSB_VERIFICATION_REGISTRATION_STATUSES.indexOf(String(reg.registration.status))<0) return fail_('Pendaftaran tidak sedang dalam proses verifikasi.');
  const statusIdx=headers.indexOf('status'), verifiedIdx=headers.indexOf('verifiedAt'), byIdx=headers.indexOf('verifiedBy'), noteIdx=headers.indexOf('revisionNote');
  const now=new Date();
  if(statusIdx>=0) sheet.getRange(found.rowNumber,statusIdx+1).setValue(status);
  if(verifiedIdx>=0) sheet.getRange(found.rowNumber,verifiedIdx+1).setValue(status==='VERIFIED'?now:'');
  if(byIdx>=0) sheet.getRange(found.rowNumber,byIdx+1).setValue(status==='VERIFIED'?actor.userId:'');
  if(noteIdx>=0) sheet.getRange(found.rowNumber,noteIdx+1).setValue(status==='REVISION'?note:'');
  writeAudit_(actor.userId,status==='VERIFIED'?'VERIFY':'REVISION','DOCUMENT',documentId,JSON.stringify(found.object),JSON.stringify({status:status,note:note}),status==='VERIFIED'?'Dokumen diverifikasi':'Dokumen perlu diperbaiki');
  const docType=findMasterItemById_('MASTER_DOKUMEN','documentTypeId',String(found.object.documentTypeId||''));
  if(status==='REVISION') notifyRegistrationOwner_(String(found.object.registrationId),'Dokumen Perlu Diperbaiki','Dokumen '+String(docType?.name||'yang diunggah')+' perlu diperbaiki.'+(note?' Catatan: '+note:''),'WARNING');
  if(String(reg.registration.status)==='REREGISTRATION' && status==='VERIFIED') syncReregistrationAfterPayment_(String(found.object.registrationId),actor.userId);
  return {success:true,message:status==='VERIFIED'?'Dokumen ditandai terverifikasi.':'Dokumen ditandai perlu diperbaiki.'};
}

function finalizeVerification(sessionToken, payload) {
  const actor=requireRole_(sessionToken,PSB_VERIFICATION_ROLES);
  assertOperationalMutation_(actor);
  payload=payload||{};
  const registrationId=String(payload.registrationId||'').trim();
  const decision=String(payload.decision||'').toUpperCase();
  const note=String(payload.note||'').trim();
  if(!registrationId) return fail_('Pendaftaran belum dipilih.');
  if(['VERIFIED','REVISION'].indexOf(decision)<0) return fail_('Keputusan verifikasi tidak valid.');
  const found=findRegistration_(registrationId);
  if(!found) return fail_('Pendaftaran tidak ditemukan.');
  if(['SUBMITTED','UNDER_REVIEW','REVISION'].indexOf(String(found.registration.status))<0) return fail_('Pendaftaran tidak berada pada status verifikasi.');
  if(decision==='VERIFIED') {
    const docs=getCurrentDocuments_(registrationId);
    const required=getActiveMasterItems_('MASTER_DOKUMEN').filter(x=>x.required);
    for(const t of required){
      const d=docs.find(x=>String(x.documentTypeId)===String(t.documentTypeId));
      if(!d) return fail_('Dokumen wajib belum lengkap: '+String(t.name||t.documentTypeId));
      if(String(d.status||'').toUpperCase()!=='VERIFIED') return fail_('Dokumen wajib belum diverifikasi: '+String(t.name||t.documentTypeId));
    }
  }
  const result=setRegistrationStatus_(found.registration,decision,actor.userId,note|| (decision==='VERIFIED'?'Pendaftaran terverifikasi':'Pendaftaran dikembalikan untuk perbaikan'));
  if(result?.success){
    notifyRegistrationOwner_(registrationId,decision==='VERIFIED'?'Pendaftaran Terverifikasi':'Pendaftaran Perlu Perbaikan',decision==='VERIFIED'?'Pendaftaran dan dokumen wajib telah terverifikasi. Silakan lanjut ke tahap pembayaran formulir.':'Pendaftaran dikembalikan untuk perbaikan.'+(note?' Catatan: '+note:''),decision==='VERIFIED'?'SUCCESS':'WARNING');
  }
  return result;
}

function setRegistrationStatus_(registration, status, actorUserId, note) {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  if(!sheet) return fail_('Sheet REGISTRATIONS belum tersedia.');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const row=registration.rowNumber, now=new Date();
  const statusIdx=headers.indexOf('status'), verifiedIdx=headers.indexOf('verifiedAt'), updatedIdx=headers.indexOf('updatedAt');
  if(statusIdx>=0) sheet.getRange(row,statusIdx+1).setValue(status);
  if(verifiedIdx>=0 && status==='VERIFIED') sheet.getRange(row,verifiedIdx+1).setValue(now);
  if(verifiedIdx>=0 && status==='REVISION') sheet.getRange(row,verifiedIdx+1).setValue('');
  if(updatedIdx>=0) sheet.getRange(row,updatedIdx+1).setValue(now);
  writeAudit_(actorUserId,status==='REVISION'?'REVISION':status==='VERIFIED'?'VERIFY':'UPDATE','REGISTRATION',registration.registrationId,JSON.stringify({status:registration.status}),JSON.stringify({status:status,note:note}),note);
  return {success:true,message:status==='VERIFIED'?'Pendaftaran berhasil diverifikasi.':status==='REREGISTRATION'?'Tahap Daftar Ulang dibuka.':status==='COMPLETED'?'Daftar ulang selesai.':'Pendaftaran dikembalikan untuk perbaikan.',status:status};
}

// =====================================================
// STAGE 5 - DOKUMEN & GOOGLE DRIVE
// =====================================================

const PSB_DOCUMENT_ACCESS_ROLES = ['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR'];
const PSB_DOCUMENT_EDITABLE_REGISTRATION_STATUSES = ['DRAFT','SUBMITTED','UNDER_REVIEW','REVISION','REREGISTRATION'];

function getDocumentOptions(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_DOCUMENT_ACCESS_ROLES);
  const found = findRegistration_(String(registrationId || ''));
  if (!found) return fail_('Pendaftaran tidak ditemukan.');
  if (!canAccessRegistration_(actor, found.registration)) return fail_('Anda tidak memiliki akses ke dokumen pendaftaran ini.');

  const types = getActiveMasterItems_('MASTER_DOKUMEN');
  const documents = getCurrentDocuments_(String(registrationId));
  const byType = {};
  documents.forEach(d => { byType[String(d.documentTypeId)] = d; });
  const checklist = types.map(t => Object.assign({}, t, {
    document: byType[String(t.documentTypeId)] || null,
    uploaded: !!byType[String(t.documentTypeId)]
  }));

  return {
    success: true,
    registration: found.registration,
    candidate: found.candidate,
    documentTypes: types,
    documents: documents,
    checklist: checklist,
    canUpload: PSB_DOCUMENT_EDITABLE_REGISTRATION_STATUSES.indexOf(String(found.registration.status)) >= 0 || hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])
  };
}

function getRegistrationDocuments(sessionToken, registrationId) {
  return getDocumentOptions(sessionToken, registrationId);
}
function getDocumentPageData(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, PSB_DOCUMENT_ACCESS_ROLES);
  const isWali = hasRoleDirect_(actor, ['WALI']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  let registrations = [];
  if (sheet && sheet.getLastRow() >= 2) {
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    let items = rows.map((r,i) => rowObject_(headers,r,i+2));
    if (isWali) items = items.filter(x => String(x.userId) === String(actor.userId));
    registrations = enrichRegistrationList_(items).slice(0,200);
  }
  if (!registrations.length) return { success:true, registrations:[], documentData:null };
  const selectedId = String(registrationId || '');
  const selected = registrations.some(x => String(x.registrationId) === selectedId) ? selectedId : String(registrations[0].registrationId);
  const found = findRegistration_(selected);
  if (!found) return { success:true, registrations:registrations, documentData:null };
  if (!canAccessRegistration_(actor, found.registration)) return fail_('Anda tidak memiliki akses ke dokumen pendaftaran ini.');
  const types = getActiveMasterItems_('MASTER_DOKUMEN');
  const documents = getCurrentDocuments_(selected);
  const byType = {};
  documents.forEach(d => { byType[String(d.documentTypeId)] = d; });
  const checklist = types.map(t => Object.assign({}, t, { document: byType[String(t.documentTypeId)] || null, uploaded: !!byType[String(t.documentTypeId)] }));
  const documentData = {
    success:true, registration:found.registration, candidate:found.candidate, documentTypes:types, documents:documents, checklist:checklist,
    canUpload: PSB_DOCUMENT_EDITABLE_REGISTRATION_STATUSES.indexOf(String(found.registration.status)) >= 0 || hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])
  };
  return { success:true, registrations:registrations, documentData:documentData };
}


function uploadDocument(sessionToken, payload) {
  const actor = requireRole_(sessionToken, PSB_DOCUMENT_ACCESS_ROLES);
  assertOperationalMutation_(actor);
  payload = payload || {};
  const registrationId = String(payload.registrationId || '').trim();
  const documentTypeId = String(payload.documentTypeId || '').trim();
  const fileName = sanitizeFileName_(payload.fileName || 'dokumen');
  const mimeType = String(payload.mimeType || '').trim().toLowerCase();
  const base64 = String(payload.base64 || '').trim();
  const clientSize = Number(payload.fileSize || 0);

  if (!registrationId) return fail_('Pendaftaran belum dipilih.');
  if (!documentTypeId) return fail_('Jenis dokumen wajib dipilih.');
  if (!base64) return fail_('File dokumen belum diterima server.');

  const found = findRegistration_(registrationId);
  if (!found) return fail_('Pendaftaran tidak ditemukan.');
  if (!canAccessRegistration_(actor, found.registration)) return fail_('Anda tidak memiliki akses ke dokumen pendaftaran ini.');

  const canEditByStatus = PSB_DOCUMENT_EDITABLE_REGISTRATION_STATUSES.indexOf(String(found.registration.status)) >= 0;
  if (!canEditByStatus && !hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])) return fail_('Dokumen tidak dapat diubah pada status pendaftaran saat ini.');

  const type = findMasterItemById_('MASTER_DOKUMEN', 'documentTypeId', documentTypeId);
  if (!type || !type.isActive) return fail_('Jenis dokumen tidak aktif atau tidak ditemukan.');
  if (!mimeType) return fail_('Tipe file tidak terbaca.');

  const allowed = String(type.allowedMimeTypes || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.some(rule => rule === mimeType || (rule.endsWith('/*') && mimeType.indexOf(rule.slice(0,-1)) === 0))) {
    return fail_('Tipe file tidak diizinkan untuk dokumen "' + String(type.name || '') + '".');
  }

  const bytes = Utilities.base64Decode(base64);
  const actualSize = bytes.length;
  const maxSizeMb = Number(type.maxSizeMb || 0);
  if (maxSizeMb > 0 && actualSize > maxSizeMb * 1024 * 1024) {
    return fail_('Ukuran file melebihi batas ' + maxSizeMb + ' MB.');
  }
  if (clientSize > 0 && Math.abs(clientSize - actualSize) > 1024) {
    return fail_('Ukuran file tidak sesuai. Silakan pilih file kembali.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PSB_SHEETS.DOCUMENTS);
    if (!sheet) return fail_('Sheet DOCUMENTS belum tersedia. Jalankan setup database terlebih dahulu.');

    const folder = getRegistrationDocumentFolder_(found.registration);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = folder.createFile(blob);
    const detectedMime = String(file.getMimeType() || '').toLowerCase();
    if (detectedMime && detectedMime !== mimeType && !(mimeType === 'application/pdf' && detectedMime === 'application/pdf')) {
      try { file.setTrashed(true); } catch (trashError) {}
      return fail_('Tipe file aktual tidak sesuai dengan tipe file yang diizinkan.');
    }
    const now = new Date();
    const documentId = generateId_('DOC');
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);

    // Satu dokumen aktif per jenis dokumen. Riwayat lama tetap disimpan untuk audit.
    const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    const regIdx = headers.indexOf('registrationId');
    const typeIdx = headers.indexOf('documentTypeId');
    const statusIdx = headers.indexOf('status');
    const oldDocuments = [];
    for (let i=0;i<rows.length;i++) {
      if (String(rows[i][regIdx] || '') === registrationId && String(rows[i][typeIdx] || '') === documentTypeId && String(rows[i][statusIdx] || '').toUpperCase() !== 'REPLACED') {
        oldDocuments.push({rowNumber:i+2, object:rowObject_(headers, rows[i], i+2)});
      }
    }
    oldDocuments.forEach(old => {
      if (statusIdx >= 0) sheet.getRange(old.rowNumber, statusIdx + 1).setValue('REPLACED');
    });

    const record = {};
    headers.forEach(h => record[h] = '');
    record.documentId = documentId;
    record.registrationId = registrationId;
    record.documentTypeId = documentTypeId;
    record.fileId = file.getId();
    record.fileName = file.getName();
    record.fileUrl = file.getUrl();
    record.mimeType = mimeType;
    record.fileSize = actualSize;
    record.status = 'PENDING';
    record.uploadedAt = now;
    record.verifiedAt = '';
    record.verifiedBy = '';
    record.revisionNote = '';

    sheet.appendRow(headers.map(h => record[h] !== undefined ? record[h] : ''));
    writeAudit_(actor.userId, 'UPLOAD', 'DOCUMENT', documentId, oldDocuments.length ? JSON.stringify(oldDocuments.map(x => x.object)) : '', JSON.stringify({documentId:documentId,registrationId:registrationId,documentTypeId:documentTypeId,fileId:file.getId(),fileName:file.getName(),mimeType:mimeType,fileSize:actualSize,status:'PENDING'}), 'Dokumen diunggah ke Google Drive');

    return { success:true, message:'Dokumen berhasil diunggah.', document:rowObject_(headers, headers.map(h => record[h] !== undefined ? record[h] : ''), sheet.getLastRow()) };
  } catch (e) {
    console.error(e);
    return fail_('Gagal mengunggah dokumen ke Google Drive.');
  } finally {
    lock.releaseLock();
  }
}

function canAccessRegistration_(actor, registration) {
  return hasRoleDirect_(actor, PSB_REGISTRATION_ADMIN_ROLES) ||
    (hasRoleDirect_(actor, ['WALI']) && String(registration.userId) === String(actor.userId));
}

function getCurrentDocuments_(registrationId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.DOCUMENTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  const regIdx = headers.indexOf('registrationId');
  const statusIdx = headers.indexOf('status');
  return rows.map((r,i)=>rowObject_(headers,r,i+2))
    .filter(x => String(x.registrationId) === String(registrationId) && String(x.status || '').toUpperCase() !== 'REPLACED')
    .sort((a,b)=>String(b.uploadedAt||'').localeCompare(String(a.uploadedAt||'')));
}

function getChatAttachmentFolder_(registration,thread){
  const props=PropertiesService.getScriptProperties();let yearFolder=null;const yearId=props.getProperty('PSB_DRIVE_YEAR_ID');
  if(yearId){try{yearFolder=DriveApp.getFolderById(yearId);}catch(e){}}
  if(!yearFolder){const rootId=props.getProperty('PSB_DRIVE_ROOT_ID');if(rootId){try{yearFolder=getOrCreateFolderInParent_(DriveApp.getFolderById(rootId),PSB_SETUP.YEAR_FOLDER_NAME);}catch(e){}}}
  if(!yearFolder){const folders=DriveApp.getFoldersByName(PSB_SETUP.YEAR_FOLDER_NAME);yearFolder=folders.hasNext()?folders.next():DriveApp.createFolder(PSB_SETUP.YEAR_FOLDER_NAME);}
  const chatRoot=getOrCreateFolderInParent_(yearFolder,'Chat PSB');
  const regFolder=getOrCreateFolderInParent_(chatRoot,sanitizeFolderName_(registration.registrationNumber||registration.registrationId));
  return getOrCreateFolderInParent_(regFolder,sanitizeFolderName_(thread.threadId||'THREAD'));
}

function getRegistrationDocumentFolder_(registration) {
  const props = PropertiesService.getScriptProperties();
  let yearFolder = null;
  const yearId = props.getProperty('PSB_DRIVE_YEAR_ID');
  if (yearId) { try { yearFolder = DriveApp.getFolderById(yearId); } catch (e) {} }
  if (!yearFolder) {
    const rootId = props.getProperty('PSB_DRIVE_ROOT_ID');
    if (rootId) {
      try {
        const root = DriveApp.getFolderById(rootId);
        yearFolder = getOrCreateFolderInParent_(root, PSB_SETUP.YEAR_FOLDER_NAME);
      } catch (e) {}
    }
  }
  if (!yearFolder) {
    const rootId = props.getProperty('PSB_DRIVE_ROOT_ID');
    if (rootId) {
      try { yearFolder = getOrCreateFolderInParent_(DriveApp.getFolderById(rootId), PSB_SETUP.YEAR_FOLDER_NAME); } catch (e) {}
    }
  }
  if (!yearFolder) {
    const folders = DriveApp.getFoldersByName(PSB_SETUP.YEAR_FOLDER_NAME);
    yearFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PSB_SETUP.YEAR_FOLDER_NAME);
  }
  const docsRoot = getOrCreateFolderInParent_(yearFolder, 'Dokumen Santri');
  const safeName = sanitizeFolderName_(registration.registrationNumber || registration.registrationId);
  return getOrCreateFolderInParent_(docsRoot, safeName);
}

function sanitizeFileName_(name) {
  const raw = String(name || 'dokumen').trim().replace(/[\\/:*?"<>|#%{}~]/g, '_');
  return raw.substring(0, 180) || 'dokumen';
}

function sanitizeFolderName_(name) {
  const raw = String(name || 'Pendaftaran').trim().replace(/[\\/:*?"<>|#%{}~]/g, '_');
  return raw.substring(0, 120) || 'Pendaftaran';
}

function saveRegistration(sessionToken, payload) {
  const actor = requireRole_(sessionToken, PSB_REGISTRATION_EDIT_ROLES);
  assertOperationalMutation_(actor);
  payload = payload || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const regSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
    const candidateSheet = ss.getSheetByName(PSB_SHEETS.CANDIDATES);
    const guardianSheet = ss.getSheetByName(PSB_SHEETS.GUARDIANS);
    const addressSheet = ss.getSheetByName(PSB_SHEETS.ADDRESSES);
    const schoolSheet = ss.getSheetByName(PSB_SHEETS.SCHOOLS);
    if ([regSheet,candidateSheet,guardianSheet,addressSheet,schoolSheet].some(x => !x)) return fail_('Struktur database pendaftaran belum tersedia. Jalankan setup database terlebih dahulu.');

    const registrationId = String(payload.registrationId || '').trim();
    // A new form may carry a stable client-side REG-* id so a retry updates
    // the same draft. A missing row therefore means "new registration",
    // not "registration not found". Existing rows are still checked below.
    let existing = registrationId ? findRegistration_(registrationId) : null;
    if (existing) {
      if (String(existing.registration.userId) !== String(actor.userId) && !hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB'])) return fail_('Anda tidak memiliki akses untuk mengubah pendaftaran ini.');
      if (PSB_REGISTRATION_EDITABLE_STATUSES.indexOf(String(existing.registration.status)) < 0) return fail_('Pendaftaran sudah tidak dapat diedit pada status saat ini.');
    } else {
      if (!hasRoleDirect_(actor, ['WALI'])) return fail_('Pendaftaran baru hanya dapat dibuat oleh akun Wali.');
      assertRegistrationOpenForNew_();
    }
    // Preserve the original owner when an admin edits an existing record.
    // Never transfer ownership merely because the editor is an admin.
    const registrationOwnerUserId = String(existing?.registration?.userId || actor.userId).trim();

    const validation = validateRegistrationPayload_(payload, false);
    if (!validation.success) return validation;

    const year = findMasterItemById_('MASTER_TAHUN_AJARAN', 'tahunAjaranId', payload.tahunAjaranId);
    const wave = findMasterItemById_('MASTER_GELOMBANG', 'gelombangId', payload.gelombangId);
    const level = findMasterItemById_('MASTER_JENJANG', 'jenjangId', payload.jenjangId);
    if (!year || !year.isActive) return fail_('Tahun ajaran tidak aktif atau tidak ditemukan.');
    if (!wave || !wave.isActive || String(wave.tahunAjaranId) !== String(payload.tahunAjaranId)) return fail_('Gelombang tidak aktif atau tidak sesuai tahun ajaran.');
    if (!level || !level.isActive) return fail_('Jenjang tidak aktif atau tidak ditemukan.');

    const now = new Date();
    const candidateId = existing ? String(existing.registration.candidateId) : generateId_('CND');
    const guardianId = existing && existing.guardian ? String(existing.guardian.guardianId) : generateId_('GRD');
    const addressId = existing && existing.address ? String(existing.address.addressId) : generateId_('ADR');
    const schoolId = existing && existing.school ? String(existing.school.schoolId) : generateId_('SCH');
    const finalRegistrationId = existing ? String(existing.registration.registrationId) : generateId_('REG');
    const registrationNumber = existing ? String(existing.registration.registrationNumber) : nextRegistrationNumber_(regSheet, payload.tahunAjaranId);

    const candidate = {
      candidateId, fullName: clean_(payload.candidate?.fullName), nik: digits_(payload.candidate?.nik), birthPlace: clean_(payload.candidate?.birthPlace),
      birthDate: dateOrBlank_(payload.candidate?.birthDate), gender: clean_(payload.candidate?.gender), birthOrder: numberOrBlank_(payload.candidate?.birthOrder),
      familyStatus: clean_(payload.candidate?.familyStatus), photoFileId: existing?.candidate?.photoFileId || '', createdAt: existing?.candidate?.createdAt || now, updatedAt: now
    };
    const guardian = {
      guardianId, userId: registrationOwnerUserId, candidateId, relationship: clean_(payload.guardian?.relationship), fullName: clean_(payload.guardian?.fullName),
      nik: digits_(payload.guardian?.nik), phone: clean_(payload.guardian?.phone), email: clean_(payload.guardian?.email).toLowerCase(), occupation: clean_(payload.guardian?.occupation),
      education: clean_(payload.guardian?.education), isPrimary: true, createdAt: existing?.guardian?.createdAt || now, updatedAt: now
    };
    const address = {
      addressId, candidateId, addressType: 'DOMICILE', addressLine: clean_(payload.address?.addressLine), rt: clean_(payload.address?.rt), rw: clean_(payload.address?.rw),
      village: clean_(payload.address?.village), district: clean_(payload.address?.district), regency: clean_(payload.address?.regency), province: clean_(payload.address?.province), postalCode: clean_(payload.address?.postalCode),
      createdAt: existing?.address?.createdAt || now, updatedAt: now
    };
    const school = {
      schoolId, candidateId, schoolName: clean_(payload.school?.schoolName), schoolType: clean_(payload.school?.schoolType), npsn: clean_(payload.school?.npsn),
      address: clean_(payload.school?.address), graduationYear: numberOrBlank_(payload.school?.graduationYear), createdAt: existing?.school?.createdAt || now, updatedAt: now
    };
    const registration = {
      registrationId: finalRegistrationId, registrationNumber, userId: registrationOwnerUserId, candidateId, tahunAjaranId: String(payload.tahunAjaranId),
      gelombangId: String(payload.gelombangId), jenjangId: String(payload.jenjangId), status: existing ? String(existing.registration.status) : 'DRAFT',
      submittedAt: existing?.registration?.submittedAt || '', verifiedAt: existing?.registration?.verifiedAt || '', completedAt: existing?.registration?.completedAt || '',
      createdAt: existing?.registration?.createdAt || now, updatedAt: now
    };

    upsertById_(candidateSheet, 'candidateId', candidateId, candidate);
    upsertById_(guardianSheet, 'guardianId', guardianId, guardian);
    upsertById_(addressSheet, 'addressId', addressId, address);
    upsertById_(schoolSheet, 'schoolId', schoolId, school);
    upsertById_(regSheet, 'registrationId', finalRegistrationId, registration);

    const action = existing ? 'UPDATE' : 'CREATE';
    // Audit tidak boleh membuat penyimpanan yang sudah berhasil terlihat gagal
    // di client. Jika audit mengalami gangguan, data utama tetap dianggap tersimpan.
    try {
      writeAudit_(actor.userId, action, 'REGISTRATION', finalRegistrationId, existing ? JSON.stringify(existing.registration) : '', JSON.stringify(registration), existing ? 'Draft pendaftaran diperbarui' : 'Draft pendaftaran dibuat');
    } catch (auditError) {
      console.error('Audit REGISTRATION gagal setelah data tersimpan:', auditError);
    }
    // google.script.run hanya dapat mengirim nilai yang dapat diserialisasi ke
    // browser. Object pendaftaran di atas masih mengandung Date (createdAt /
    // updatedAt / birthDate). Jika Date dikirim langsung, Apps Script dapat
    // menyimpan data ke Spreadsheet terlebih dahulu lalu gagal saat
    // men-serialize response. Gejalanya persis: data masuk database tetapi
    // Wali mendapat popup "proses gagal". Ubah seluruh response menjadi
    // plain JSON sebelum dikirim ke frontend.
    const response = {
      success:true,
      message:existing ? 'Draft pendaftaran berhasil diperbarui.' : 'Draft pendaftaran berhasil dibuat.',
      registration:registration,
      candidate:candidate,
      guardian:guardian,
      address:address,
      school:school
    };
    return JSON.parse(JSON.stringify(response));
  } finally { lock.releaseLock(); }
}

function submitRegistration(sessionToken, registrationId) {
  const actor = requireRole_(sessionToken, ['WALI','SUPERADMIN','ADMIN_PSB']);
  assertOperationalMutation_(actor);
  const found = findRegistration_(String(registrationId || ''));
  if (!found) return fail_('Pendaftaran tidak ditemukan.');
  if (String(found.registration.userId) !== String(actor.userId) && !hasRoleDirect_(actor, ['SUPERADMIN','ADMIN_PSB'])) return fail_('Anda tidak memiliki akses untuk mengirim pendaftaran ini.');
  if (PSB_REGISTRATION_EDITABLE_STATUSES.indexOf(String(found.registration.status)) < 0) return fail_('Pendaftaran tidak berada pada status yang dapat dikirim.');
  const validation = validateCompleteRegistration_(found);
  if (!validation.success) return validation;
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const latest=findRegistration_(String(registrationId||''));
  if(!latest) return fail_('Pendaftaran tidak ditemukan.');
  if(String(latest.registration.userId)!==String(actor.userId) && !hasRoleDirect_(actor,['SUPERADMIN','ADMIN_PSB'])) return fail_('Anda tidak memiliki akses untuk mengirim pendaftaran ini.');
  if(PSB_REGISTRATION_EDITABLE_STATUSES.indexOf(String(latest.registration.status))<0) return fail_('Pendaftaran tidak berada pada status yang dapat dikirim.');
  const latestValidation=validateCompleteRegistration_(latest); if(!latestValidation.success) return latestValidation;
  found=latest;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const row = found.registration.rowNumber;
  const statusIdx = headers.indexOf('status');
  const submittedIdx = headers.indexOf('submittedAt');
  const updatedIdx = headers.indexOf('updatedAt');
  const now = new Date();
  if (statusIdx >= 0) sheet.getRange(row,statusIdx+1).setValue('SUBMITTED');
  if (submittedIdx >= 0) sheet.getRange(row,submittedIdx+1).setValue(now);
  if (updatedIdx >= 0) sheet.getRange(row,updatedIdx+1).setValue(now);
  writeAudit_(actor.userId, 'SUBMIT', 'REGISTRATION', found.registration.registrationId, JSON.stringify({status:found.registration.status}), JSON.stringify({status:'SUBMITTED'}), 'Pendaftaran dikirim untuk verifikasi');
  const candidateName=String(found.candidate?.fullName||'calon santri');
  notifyUsersByRoles_(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'],'Pendaftaran Baru Menunggu Verifikasi',candidateName+' telah mengirim pendaftaran '+String(found.registration.registrationNumber||found.registration.registrationId)+' dan menunggu verifikasi.','INFO');
  notifyRegistrationOwner_(found.registration.registrationId,'Pendaftaran Berhasil Dikirim','Pendaftaran '+String(found.registration.registrationNumber||'')+' berhasil dikirim dan sedang menunggu verifikasi.','SUCCESS');
  return { success:true, message:'Pendaftaran berhasil dikirim untuk verifikasi.', status:'SUBMITTED' };
  } finally { lock.releaseLock(); }
}

function validateRegistrationPayload_(payload, strict) {
  const c = payload.candidate || {}, g = payload.guardian || {}, a = payload.address || {}, s = payload.school || {};
  const contextRequired = [['tahunAjaranId','Tahun ajaran'],['gelombangId','Gelombang'],['jenjangId','Jenjang']];
  for (const [v,label] of contextRequired) if (!String(v == null ? '' : v).trim()) return fail_(label + ' wajib diisi.');
  if (strict) {
    const required = [
      [c.fullName,'Nama lengkap calon santri'],[c.birthPlace,'Tempat lahir'],[c.birthDate,'Tanggal lahir'],[c.gender,'Jenis kelamin'],
      [g.relationship,'Hubungan wali'],[g.fullName,'Nama wali'],[g.phone,'No. HP wali'],
      [a.addressLine,'Alamat lengkap'],[a.village,'Desa/Kelurahan'],[a.district,'Kecamatan'],[a.regency,'Kabupaten/Kota'],[a.province,'Provinsi'],
      [s.schoolName,'Nama sekolah asal'],[s.graduationYear,'Tahun lulus']
    ];
    for (const [v,label] of required) if (!String(v == null ? '' : v).trim()) return fail_(label + ' wajib diisi.');
  }
  if (c.gender && String(c.gender) !== 'L' && String(c.gender) !== 'P') return fail_('Jenis kelamin tidak valid.');
  if (String(g.phone || '').trim() && digits_(g.phone).length < 8) return fail_('No. HP wali tidak valid.');
  if (c.nik && digits_(c.nik).length !== 16) return fail_('NIK calon santri harus 16 digit jika diisi.');
  if (g.nik && digits_(g.nik).length !== 16) return fail_('NIK wali harus 16 digit jika diisi.');
  if (String(s.graduationYear == null ? '' : s.graduationYear).trim()) {
    const year = Number(s.graduationYear);
    if (!Number.isFinite(year) || year < 1900 || year > 2200) return fail_('Tahun lulus tidak valid.');
  }
  return { success:true };
}

function validateCompleteRegistration_(found) {
  return validateRegistrationPayload_({tahunAjaranId:found.registration.tahunAjaranId,gelombangId:found.registration.gelombangId,jenjangId:found.registration.jenjangId,candidate:found.candidate,guardian:found.guardian,address:found.address,school:found.school}, true);
}

function findRegistration_(registrationId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = findRowById_(ss.getSheetByName(PSB_SHEETS.REGISTRATIONS), 'registrationId', registrationId);
  if (!reg) return null;
  const candidate = findRowById_(ss.getSheetByName(PSB_SHEETS.CANDIDATES), 'candidateId', reg.object.candidateId);
  const guardian = findFirstBy_(ss.getSheetByName(PSB_SHEETS.GUARDIANS), 'candidateId', reg.object.candidateId, true);
  const address = findFirstBy_(ss.getSheetByName(PSB_SHEETS.ADDRESSES), 'candidateId', reg.object.candidateId, true);
  const school = findFirstBy_(ss.getSheetByName(PSB_SHEETS.SCHOOLS), 'candidateId', reg.object.candidateId, true);
  return {registration:reg.object,candidate:candidate?.object||null,guardian:guardian?.object||null,address:address?.object||null,school:school?.object||null};
}

function enrichRegistrationList_(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const candidates = sheetMapById_(ss.getSheetByName(PSB_SHEETS.CANDIDATES), 'candidateId');
  const years = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN), 'tahunAjaranId');
  const waves = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_GELOMBANG), 'gelombangId');
  const levels = sheetMapById_(ss.getSheetByName(PSB_SHEETS.MASTER_JENJANG), 'jenjangId');
  return items.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).map(r => Object.assign({}, r, {
    candidateName: candidates[r.candidateId]?.name || candidates[r.candidateId]?.fullName || '-',
    tahunAjaranName: years[r.tahunAjaranId]?.name || r.tahunAjaranId,
    gelombangName: waves[r.gelombangId]?.name || r.gelombangId,
    jenjangName: levels[r.jenjangId]?.name || r.jenjangId
  }));
}

function getActiveMasterItems_(masterKey) {
  const def = PSB_MASTER_DEFINITIONS[masterKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues().map((r,i)=>masterObjectFromRow_(headers,r,i+2)).filter(x=>x.isActive===true);
}

function findMasterItemById_(masterKey, idField, id) {
  const def = PSB_MASTER_DEFINITIONS[masterKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
  if (!sheet) return null;
  return findRowById_(sheet,idField,String(id||''))?.object || null;
}

function nextRegistrationNumber_(sheet, tahunAjaranId) {
  const yearItem = findMasterItemById_('MASTER_TAHUN_AJARAN','tahunAjaranId',tahunAjaranId);
  const match = String(yearItem?.name || getConfig_('ACTIVE_YEAR') || '2027/2028').match(/20\d{2}/);
  const prefix = match ? match[0] : '2027';
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  const idx = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String).indexOf('registrationNumber');
  let max = 0;
  rows.forEach(r=>{const m=String(r[idx]||'').match(new RegExp('^PSB-'+prefix+'-(\\d+)$'));if(m)max=Math.max(max,Number(m[1])||0);});
  return 'PSB-'+prefix+'-'+String(max+1).padStart(4,'0');
}

function upsertById_(sheet, idField, id, object) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const idIdx = headers.indexOf(idField);
  let rowNumber = 0;
  if (sheet.getLastRow() >= 2) {
    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
    for (let i=0;i<rows.length;i++) if (String(rows[i][idIdx]||'')===String(id)) { rowNumber=i+2; break; }
  }
  const row = headers.map(h=>object[h] === undefined ? '' : object[h]);
  if (rowNumber) sheet.getRange(rowNumber,1,1,headers.length).setValues([row]); else sheet.appendRow(row);
}

function rowObject_(headers,row,rowNumber) { const o={rowNumber:rowNumber}; headers.forEach((h,i)=>o[h]=row[i] instanceof Date ? Utilities.formatDate(row[i],getConfig_('TIMEZONE')||'Asia/Jakarta',"yyyy-MM-dd'T'HH:mm:ss") : row[i]); return o; }
function findRowById_(sheet,idField,id) { if(!sheet||sheet.getLastRow()<2)return null; const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), idx=h.indexOf(idField); if(idx<0)return null; const rows=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(); for(let i=0;i<rows.length;i++)if(String(rows[i][idx]||'')===String(id))return {rowNumber:i+2,object:rowObject_(h,rows[i],i+2)}; return null; }
function findFirstBy_(sheet,field,value,preferPrimary) { if(!sheet||sheet.getLastRow()<2)return null; const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), idx=h.indexOf(field), primary=h.indexOf('isPrimary'); if(idx<0)return null; const rows=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(); let fallback=null; for(let i=0;i<rows.length;i++){if(String(rows[i][idx]||'')!==String(value))continue; const obj=rowObject_(h,rows[i],i+2); if(!fallback)fallback={rowNumber:i+2,object:obj}; if(preferPrimary&&primary>=0&&(rows[i][primary]===true||String(rows[i][primary]).toUpperCase()==='TRUE'))return {rowNumber:i+2,object:obj};} return fallback; }
function sheetMapById_(sheet,idField) { const out={}; if(!sheet||sheet.getLastRow()<2)return out; const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String), idx=h.indexOf(idField); if(idx<0)return out; const rows=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(); rows.forEach((r,i)=>{const o=rowObject_(h,r,i+2);out[String(r[idx]||'')]=o;}); return out; }
function hasRoleDirect_(user, roles) { const mine=String(user.role||'').split(',').map(x=>x.trim().toUpperCase()); return roles.some(r=>mine.indexOf(r)>=0); }
function clean_(v) { return String(v==null?'':v).trim(); }
function digits_(v) { return clean_(v).replace(/\D/g,''); }
function numberOrBlank_(v) { return v===''||v==null?'':Number(v); }
function dateOrBlank_(v) { return clean_(v) ? new Date(clean_(v)+'T00:00:00') : ''; }

function fail_(message) { return { success: false, message: message }; }


// ============================================================
// STATIC PWA API BRIDGE — GitHub Pages -> Apps Script
// ============================================================
const PSB_PWA_BRIDGE_VERSION = '32.3.7';
const PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS = Object.freeze([
  'getAppInfo','getPublicConfig','getPublicGallery',
  'login','finalizeLogin','registerWali','validateSession','logout','changePassword',
  'getProductionControlData','setProductionControl','getGoLiveChecklist','createProductionBackup','runSecurityMaintenance',
  'getUserManagementData','adminResetUserPassword','createManualUser','getAuditLogPageData',
  'getAcademicYearLifecycleData','setActiveAcademicYear','getMasterDefinitions','getMasterData','saveMasterItem','deactivateMasterItem',
  'getRegistrationFormOptions','getWaliHomeData','getMyRegistrations','getRegistrationList','getRegistrationDetail',
  'getPaymentPageData','getPaymentsForRegistration','createBill','submitPayment','verifyPayment',
  'getSelectionPageData','createSelectionSchedule','updateSelectionScheduleStatus','addSelectionParticipant','addSelectionParticipantsBulk','updateSelectionParticipantStatus','saveSelectionScore','saveSelectionResult',
  'getAnnouncementPageData','publishAnnouncement',
  'getNotifications','markNotificationRead','markAllNotificationsRead',
  'getChatPageData','getChatThread','openChatThread','sendChatMessage','markChatThreadRead','closeChatThread','cleanupChatRetention','runChatAutomationNow',
  'getCommunicationCenterData','sendCommunication',
  'getReregistrationPageData','openReregistration','finalizeReregistration',
  'getDashboardPageData','getProductionReadiness','getMonitoringPageData','getIncidentPageData','saveIncident','closeIncident',
  'getReportingPageData','getAdvancedReportingData','exportAdvancedReportingCsv',
  'getVerificationQueue','getVerificationDetail','getDocumentOptions','getRegistrationDocuments','getDocumentPageData','uploadDocument','verifyDocument',
  'saveRegistration','submitRegistration','finalizeVerification'
]);
function getPwaBridgeConfig() {
  const raw = String(PropertiesService.getScriptProperties().getProperty('PWA_ALLOWED_ORIGINS') || '').trim();
  const configured = raw.split(',').map(function(x){return String(x||'').trim();}).filter(Boolean);
  return {success:true,bridgeVersion:PSB_PWA_BRIDGE_VERSION,appName:getConfig_('APP_NAME')||'PSB Fathan Mubina',allowedOrigins:configured.length ? configured : ['https://appfathanmubina.github.io']};
}
function pwaBridgeCall(functionName,args) {
  const fn=String(functionName||'').trim();
  if(PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS.indexOf(fn)<0)return {success:false,code:'BRIDGE_FUNCTION_NOT_ALLOWED',message:'Fungsi API bridge tidak diizinkan.'};
  const callArgs=Array.isArray(args)?args:[];
  try{
    const handler=globalThis[fn];
    if(typeof handler!=='function')return {success:false,code:'BRIDGE_FUNCTION_NOT_FOUND',message:'Fungsi backend tidak ditemukan.'};
    return rpcSafe_(handler.apply(null,callArgs));
  }catch(e){
    console.error('PWA bridge backend error: '+e);
    return {success:false,code:'BRIDGE_BACKEND_ERROR',message:String(e&&e.message||'Terjadi kesalahan pada backend.')};
  }
}
