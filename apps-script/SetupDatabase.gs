/**
 * PSB FATHAN MUBINA
 * SetupDatabase.gs
 * STAGE 1 - FOUNDATION
 *
 * Tugas file ini:
 * - Membuat / memastikan struktur database Spreadsheet
 * - Membuat struktur folder Google Drive
 * - Menyiapkan konfigurasi dasar
 * - Membuat akun Superadmin awal
 *
 * Catatan:
 * Password awal tidak disimpan dalam bentuk asli.
 * Hash + salt awal sudah ditanamkan untuk bootstrap pertama.
 * Setelah login, gunakan fitur Ganti Password pada stage Authentication.
 */

const PSB_SETUP = {
  APP_NAME: 'PSB Fathan Mubina',
  ACTIVE_YEAR: '2027/2028',
  TIMEZONE: 'Asia/Jakarta',
  ROOT_FOLDER_NAME: 'PSB Fathan Mubina',
  YEAR_FOLDER_NAME: '2027-2028',
  INITIAL_SUPERADMIN_USERNAME: 'Superadmin',
  INITIAL_SUPERADMIN_NAME: 'Aba Nadheera',
  INITIAL_SUPERADMIN_SALT: 'b887a583c81d5ddd927542dcce69605e',
  INITIAL_SUPERADMIN_HASH: '9cd7ef2a49bc84b807471dc5fa65f48d74072842a24d4b4b5f828aeedaa385c5'
};

const PSB_SHEETS = {
  CONFIG: 'CONFIG',
  USERS: 'USERS',
  SESSIONS: 'SESSIONS',
  AUDIT_LOG: 'AUDIT_LOG',
  NOTIFICATIONS: 'NOTIFICATIONS',
  MASTER_TAHUN_AJARAN: 'MASTER_TAHUN_AJARAN',
  MASTER_GELOMBANG: 'MASTER_GELOMBANG',
  MASTER_JENJANG: 'MASTER_JENJANG',
  MASTER_KELAS: 'MASTER_KELAS',
  MASTER_DOKUMEN: 'MASTER_DOKUMEN',
  MASTER_JENIS_PEMBAYARAN: 'MASTER_JENIS_PEMBAYARAN',
  REGISTRATIONS: 'REGISTRATIONS',
  CANDIDATES: 'CANDIDATES',
  GUARDIANS: 'GUARDIANS',
  ADDRESSES: 'ADDRESSES',
  SCHOOLS: 'SCHOOLS',
  DOCUMENTS: 'DOCUMENTS',
  BILLS: 'BILLS',
  PAYMENTS: 'PAYMENTS',
  PAYMENT_VERIFICATIONS: 'PAYMENT_VERIFICATIONS',
  SELECTION_SCHEDULE: 'SELECTION_SCHEDULE',
  SELECTION_PARTICIPANTS: 'SELECTION_PARTICIPANTS',
  SELECTION_SCORES: 'SELECTION_SCORES',
  SELECTION_RESULTS: 'SELECTION_RESULTS',
  REREGISTRATIONS: 'REREGISTRATIONS',
  INCIDENTS: 'INCIDENTS',
  CHAT_THREADS: 'CHAT_THREADS',
  CHAT_MESSAGES: 'CHAT_MESSAGES'
};

const PSB_HEADERS = {
  CONFIG: ['key','value','description','updatedAt'],
  USERS: ['userId','name','phone','phoneNormalized','email','emailNormalized','passwordHash','passwordSalt','role','status','photoFileId','lastLoginAt','createdAt','updatedAt','mustChangePassword'],
  SESSIONS: ['sessionId','userId','tokenHash','createdAt','expiresAt','lastSeenAt','status'],
  AUDIT_LOG: ['auditId','timestamp','userId','action','module','recordId','oldValue','newValue','description','ipAddress'],
  NOTIFICATIONS: ['notificationId','userId','title','message','type','isRead','createdAt','readAt'],
  MASTER_TAHUN_AJARAN: ['tahunAjaranId','name','isActive','createdAt','updatedAt'],
  MASTER_GELOMBANG: ['gelombangId','tahunAjaranId','name','startDate','endDate','isActive','createdAt','updatedAt'],
  MASTER_JENJANG: ['jenjangId','name','isActive','createdAt','updatedAt'],
  MASTER_KELAS: ['kelasId','jenjangId','name','isActive','createdAt','updatedAt'],
  MASTER_DOKUMEN: ['documentTypeId','name','required','allowedMimeTypes','maxSizeMb','isActive','createdAt','updatedAt'],
  MASTER_JENIS_PEMBAYARAN: ['paymentTypeId','name','amount','isActive','createdAt','updatedAt'],
  REGISTRATIONS: ['registrationId','registrationNumber','userId','candidateId','tahunAjaranId','gelombangId','jenjangId','status','submittedAt','verifiedAt','completedAt','createdAt','updatedAt'],
  CANDIDATES: ['candidateId','fullName','nik','birthPlace','birthDate','gender','birthOrder','familyStatus','photoFileId','createdAt','updatedAt'],
  GUARDIANS: ['guardianId','userId','candidateId','relationship','fullName','nik','phone','email','occupation','education','isPrimary','createdAt','updatedAt'],
  ADDRESSES: ['addressId','candidateId','addressType','addressLine','rt','rw','village','district','regency','province','postalCode','createdAt','updatedAt'],
  SCHOOLS: ['schoolId','candidateId','schoolName','schoolType','npsn','address','graduationYear','createdAt','updatedAt'],
  DOCUMENTS: ['documentId','registrationId','documentTypeId','fileId','fileName','fileUrl','mimeType','fileSize','status','uploadedAt','verifiedAt','verifiedBy','revisionNote'],
  BILLS: ['billId','registrationId','paymentTypeId','amount','dueDate','status','createdAt','updatedAt'],
  PAYMENTS: ['paymentId','billId','registrationId','amount','method','proofFileId','proofFileUrl','status','submittedAt','createdAt','updatedAt'],
  PAYMENT_VERIFICATIONS: ['verificationId','paymentId','status','verifiedBy','verifiedAt','note'],
  SELECTION_SCHEDULE: ['scheduleId','tahunAjaranId','name','selectionDate','location','isActive','createdAt','updatedAt'],
  SELECTION_PARTICIPANTS: ['participantId','registrationId','scheduleId','status','createdAt','updatedAt'],
  SELECTION_SCORES: ['scoreId','participantId','component','score','note','createdAt','updatedAt'],
  SELECTION_RESULTS: ['resultId','registrationId','status','announcementDate','note','createdAt','updatedAt'],
  REREGISTRATIONS: ['reregistrationId','registrationId','status','completedAt','note','createdAt','updatedAt'],
  INCIDENTS: ['incidentId','category','priority','status','title','description','relatedModule','relatedRecordId','reportedBy','assignedTo','resolutionNote','createdAt','updatedAt','resolvedAt','closedAt'],
  CHAT_THREADS: ['threadId','registrationId','waliUserId','adminUserId','subject','status','lastMessageAt','lastMessageBy','createdAt','updatedAt','closedAt'],
  CHAT_MESSAGES: ['messageId','threadId','senderUserId','senderRole','message','attachmentFileId','attachmentName','attachmentMimeType','isRead','createdAt','readAt']
};

function setupPSBDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');

  PropertiesService.getScriptProperties().setProperties({
    PSB_SPREADSHEET_ID: ss.getId(),
    PSB_ROOT_FOLDER_ID: getOrCreateFolder_(PSB_SETUP.ROOT_FOLDER_NAME).getId()
  }, true);

  Object.keys(PSB_SHEETS).forEach(key => ensureSheet_(ss, PSB_SHEETS[key], PSB_HEADERS[key]));

  ensureDefaultConfig_();
  ensureInitialMasterData_();
  setupDriveFolders_();
  createInitialSuperadmin();
  ensureChatAutomationTrigger_();

  return {
    success: true,
    message: 'Foundation PSB berhasil disiapkan.',
    spreadsheetId: ss.getId()
  };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsUpdate = headers.some((h, i) => current[i] !== h);
    if (needsUpdate) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureDefaultConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PSB_SHEETS.CONFIG);
  const existing = sheet.getDataRange().getValues();
  const keys = new Set(existing.slice(1).map(r => r[0]).filter(Boolean));
  const now = new Date();

  const defaults = [
    ['APP_NAME', PSB_SETUP.APP_NAME, 'Nama aplikasi', now],
    ['APP_LOGO_URL', '', 'URL logo utama aplikasi (HTTPS). Kosongkan untuk menggunakan logo default.', now],
    ['APP_ICON_URL', '', 'URL ikon utama aplikasi/favicon (HTTPS). Kosongkan untuk menggunakan ikon default.', now],
    ['APP_VERSION', '30.14', 'Versi aplikasi produksi', now],
    ['RELEASE_STAGE', 'PRODUCTION', 'Tahap rilis aplikasi', now],
    ['ACTIVE_YEAR', PSB_SETUP.ACTIVE_YEAR, 'Tahun ajaran aktif', now],
    ['ACTIVE_YEAR_ID', 'TA-2027-2028', 'ID tahun ajaran aktif; dikelola oleh lifecycle tahun ajaran', now],
    ['REGISTRATION_OPEN', 'TRUE', 'Apakah pendaftaran sedang dibuka', now],
    ['REGISTRATION_START', '', 'Tanggal mulai pendaftaran', now],
    ['REGISTRATION_END', '', 'Tanggal akhir pendaftaran', now],
    ['MAINTENANCE_MODE', 'FALSE', 'Mode pemeliharaan aplikasi', now],
    ['SESSION_TTL_MINUTES', '480', 'Masa berlaku session maksimal', now],
    ['SESSION_IDLE_MINUTES', '30', 'Masa idle session sebelum otomatis berakhir', now],
    ['LOGIN_MAX_ATTEMPTS', '5', 'Batas kegagalan login sebelum lock sementara', now],
    ['LOGIN_LOCK_MINUTES', '10', 'Durasi lock sementara setelah gagal login berulang', now],
    ['AUDIT_PAGE_SIZE', '50', 'Jumlah maksimum baris audit per halaman', now],
    ['SESSION_CLEANUP_BATCH', '500', 'Batas session yang diproses setiap maintenance', now],
    ['TIMEZONE', PSB_SETUP.TIMEZONE, 'Zona waktu aplikasi', now],
    ['CHAT_RETENTION_DAYS', '180', 'Jumlah hari penyimpanan chat yang sudah ditutup sebelum dapat dibersihkan', now],
    ['CHAT_MESSAGE_MAX_LENGTH', '1000', 'Batas karakter satu pesan chat', now],
    ['CHAT_POLL_SECONDS', '10', 'Interval polling chat near real-time dalam detik', now],
    ['CHAT_ATTACHMENT_MAX_SIZE_MB', '5', 'Batas ukuran satu lampiran chat dalam MB', now],
    ['CHAT_ATTACHMENT_ALLOWED_MIME_TYPES', 'image/jpeg,image/png,image/webp,application/pdf', 'Tipe file yang diizinkan untuk lampiran chat', now],
    ['CHAT_AUTOMATION_ENABLED', 'TRUE', 'Aktifkan otomasi chat terjadwal', now],
    ['CHAT_AUTO_CLOSE_DAYS', '7', 'Jumlah hari tanpa aktivitas sebelum chat terbuka otomatis ditutup', now],
    ['CHAT_ADMIN_REMINDER_MINUTES', '30', 'Menit sejak pesan Wali terakhir sebelum pengingat balasan Admin PSB dibuat', now]
  ];

  const rows = defaults.filter(r => !keys.has(r[0]));
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  const refreshed = sheet.getDataRange().getValues();
  const versionRow = refreshed.findIndex(r => String(r[0] || '') === 'APP_VERSION');
  if (versionRow >= 1 && String(refreshed[versionRow][1] || '') !== '30.14') {
    sheet.getRange(versionRow + 1, 2, 1, 2).setValues([['30.14', 'Versi aplikasi produksi']]);
    sheet.getRange(versionRow + 1, 4).setValue(now);
  }
}

function ensureInitialMasterData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const yearSheet = ss.getSheetByName(PSB_SHEETS.MASTER_TAHUN_AJARAN);
  if (yearSheet.getLastRow() === 1) {
    yearSheet.appendRow(['TA-2027-2028', PSB_SETUP.ACTIVE_YEAR, true, new Date(), new Date()]);
  }

  const jenjangSheet = ss.getSheetByName(PSB_SHEETS.MASTER_JENJANG);
  if (jenjangSheet.getLastRow() === 1) {
    jenjangSheet.getRange(2,1,2,4).setValues([
      ['JEN-SMP', 'SMP', true, new Date()],
      ['JEN-SMA', 'SMA', true, new Date()]
    ]);
  }
}

function setupDriveFolders_() {
  const root = getOrCreateFolder_(PSB_SETUP.ROOT_FOLDER_NAME);
  const year = getOrCreateFolderInParent_(root, PSB_SETUP.YEAR_FOLDER_NAME);

  ['Pendaftaran','Dokumen Santri','Bukti Pembayaran','Hasil Seleksi','Daftar Ulang']
    .forEach(name => getOrCreateFolderInParent_(year, name));

  PropertiesService.getScriptProperties().setProperties({
    PSB_DRIVE_ROOT_ID: root.getId(),
    PSB_DRIVE_YEAR_ID: year.getId()
  }, true);
}

function getOrCreateFolder_(name) {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('PSB_DRIVE_ROOT_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (e) {}
  }

  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function getOrCreateFolderInParent_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function ensureChatAutomationTrigger_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'runChatAutomation') ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger('runChatAutomation').timeBased().everyMinutes(15).create();
    PropertiesService.getScriptProperties().setProperty('PSB_CHAT_AUTOMATION_TRIGGER', 'INSTALLED');
    return true;
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty('PSB_CHAT_AUTOMATION_TRIGGER', 'FAILED');
    return false;
  }
}

function installChatAutomationTrigger() {
  return ensureChatAutomationTrigger_();
}

function createInitialSuperadmin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PSB_SHEETS.USERS);
  const data = sheet.getDataRange().getValues();

  const username = PSB_SETUP.INITIAL_SUPERADMIN_USERNAME;
  const usernameNormalized = username.toLowerCase();

  const exists = data.slice(1).some(row =>
    String(row[2] || '').toLowerCase() === usernameNormalized ||
    String(row[4] || '').toLowerCase() === usernameNormalized
  );

  if (exists) {
    // Migrasi aman Stage 2: versi awal Stage 2 memiliki hash bootstrap yang keliru.
    // Hanya perbaiki jika hash lama tersebut masih tersimpan; jangan menimpa password
    // yang sudah pernah diubah oleh Superadmin.
    const oldBrokenHash = '15b49e0a2ac7af9edde8bbd516b24c91b1cbc00049bb61965f3778f288724698';
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const phoneNorm = String(row[3] || '').toLowerCase();
      const emailNorm = String(row[5] || '').toLowerCase();
      if (phoneNorm === usernameNormalized || emailNorm === usernameNormalized) {
        if (String(row[6] || '') === oldBrokenHash) {
          sheet.getRange(i + 1, 7, 1, 2).setValues([[PSB_SETUP.INITIAL_SUPERADMIN_HASH, PSB_SETUP.INITIAL_SUPERADMIN_SALT]]);
          return { success: true, created: false, repaired: true, message: 'Hash Superadmin diperbaiki.' };
        }
        return { success: true, created: false, message: 'Superadmin sudah ada.' };
      }
    }
    return { success: true, created: false, message: 'Superadmin sudah ada.' };
  }

  const userId = generateId_('USR');
  const now = new Date();

  sheet.appendRow([
    userId,
    PSB_SETUP.INITIAL_SUPERADMIN_NAME,
    username,
    usernameNormalized,
    '',
    '',
    PSB_SETUP.INITIAL_SUPERADMIN_HASH,
    PSB_SETUP.INITIAL_SUPERADMIN_SALT,
    'SUPERADMIN',
    'ACTIVE',
    '',
    '',
    now,
    now,
    true
  ]);

  return {
    success: true,
    created: true,
    userId: userId,
    username: username
  };
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}


// =====================================================
// TEST DATA - SAFE / MANUAL ONLY
// =====================================================
// Fungsi ini TIDAK dipanggil otomatis oleh aplikasi.
// Jalankan manual dari Apps Script editor jika ingin mengisi data uji.
// Semua record dummy memakai prefix TEST- agar mudah dibedakan dan dihapus.
// Tidak membuat file Drive palsu dan tidak mengubah master data yang sudah ada.

const PSB_TEST_DATA = {
  PREFIX: 'TEST-',
  PASSWORD: 'Test12345!',
  VERSION: 'V1'
};

function seedPSBTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');

  const requiredSheets = Object.keys(PSB_SHEETS).filter(k => [
    'USERS','REGISTRATIONS','CANDIDATES','GUARDIANS','ADDRESSES','SCHOOLS',
    'BILLS','PAYMENTS','PAYMENT_VERIFICATIONS','SELECTION_SCHEDULE',
    'SELECTION_PARTICIPANTS','SELECTION_SCORES','SELECTION_RESULTS','NOTIFICATIONS','REREGISTRATIONS'
  ].indexOf(k) >= 0);
  const missing = requiredSheets.filter(k => !ss.getSheetByName(PSB_SHEETS[k]));
  if (missing.length) throw new Error('Sheet belum tersedia: ' + missing.map(k => PSB_SHEETS[k]).join(', ') + '. Jalankan setupPSBDatabase() terlebih dahulu.');

  const year = getActiveMasterItems_('MASTER_TAHUN_AJARAN')[0];
  const waves = getActiveMasterItems_('MASTER_GELOMBANG');
  const levels = getActiveMasterItems_('MASTER_JENJANG');
  const formPaymentType = getActiveMasterItems_('MASTER_JENIS_PEMBAYARAN').find(x => /formulir/i.test(String(x.name || '')));

  if (!year) throw new Error('Belum ada Tahun Ajaran aktif. Isi master Tahun Ajaran terlebih dahulu.');
  if (!waves.length) throw new Error('Belum ada Gelombang aktif. Isi master Gelombang terlebih dahulu.');
  if (!levels.length) throw new Error('Belum ada Jenjang aktif. Isi master Jenjang terlebih dahulu.');

  const regSheet = ss.getSheetByName(PSB_SHEETS.REGISTRATIONS);
  const existingTest = findRowById_(regSheet, 'registrationId', 'TEST-REG-001');
  if (existingTest) {
    return {
      success: true,
      alreadySeeded: true,
      message: 'Data dummy TEST- sudah tersedia. Tidak ada data tambahan yang dibuat.',
      registrationCount: countTestRows_(regSheet, 'registrationId'),
      userCount: countTestRows_(ss.getSheetByName(PSB_SHEETS.USERS), 'userId')
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Cek ulang setelah lock agar dua eksekusi bersamaan tidak menggandakan data.
    if (findRowById_(regSheet, 'registrationId', 'TEST-REG-001')) {
      return {success:true, alreadySeeded:true, message:'Data dummy TEST- sudah tersedia.'};
    }

    const now = new Date();
    const tz = getConfig_('TIMEZONE') || PSB_SETUP.TIMEZONE;
    const baseDate = new Date(now.getTime());
    const waveA = waves[0];
    const waveB = waves[1] || waves[0];
    const levelA = levels[0];
    const levelB = levels[1] || levels[0];
    const formAmount = formPaymentType ? Number(formPaymentType.amount || 0) : 0;

    // Variasi status sengaja dibuat untuk menguji queue verifikasi, pembayaran,
    // Generate Tes, nilai, hasil seleksi, dan alur lanjutan tanpa menyentuh data asli.
    const profiles = [
      {n:'Ahmad Fikri Pratama', gender:'L', status:'DRAFT',        level:levelA, wave:waveA, payment:'NONE',     participant:false, result:''},
      {n:'Bintang Ramadhan',      gender:'L', status:'SUBMITTED',   level:levelA, wave:waveA, payment:'SUBMITTED', participant:false, result:''},
      {n:'Citra Aulia Rahmah',    gender:'P', status:'UNDER_REVIEW',level:levelB, wave:waveA, payment:'NONE',     participant:false, result:''},
      {n:'Daffa Maulana',         gender:'L', status:'REVISION',    level:levelB, wave:waveA, payment:'REJECTED', participant:false, result:''},
      {n:'Eka Nur Safitri',       gender:'P', status:'VERIFIED',    level:levelA, wave:waveB, payment:'NONE',     participant:false, result:''},
      {n:'Fauzan Hakim',          gender:'L', status:'PAYMENT_VERIFIED', level:levelA, wave:waveB, payment:'VERIFIED', participant:true, result:'PASSED'},
      {n:'Ghina Maharani',        gender:'P', status:'PAYMENT_VERIFIED', level:levelB, wave:waveB, payment:'VERIFIED', participant:true, result:'NOT_PASSED'},
      {n:'Hafiz Alamsyah',        gender:'L', status:'PAYMENT_VERIFIED', level:levelB, wave:waveB, payment:'VERIFIED', participant:true, result:'WAITLIST'},
      {n:'Intan Permata Sari',    gender:'P', status:'VERIFIED',    level:levelA, wave:waveA, payment:'VERIFIED', participant:true, result:'PASSED'},
      {n:'Jauhar Akbar',          gender:'L', status:'PAYMENT_VERIFIED', level:levelB, wave:waveA, payment:'VERIFIED', participant:true, result:''},
      {n:'Kirana Putri',          gender:'P', status:'PAYMENT_VERIFIED', level:levelA, wave:waveB, payment:'VERIFIED', participant:false, result:''},
      {n:'Lukman Hakim',         gender:'L', status:'SUBMITTED',   level:levelB, wave:waveB, payment:'SUBMITTED', participant:false, result:''}
    ];

    // Akun WALI dummy: login memakai email dengan password yang sama.
    const userSheet = ss.getSheetByName(PSB_SHEETS.USERS);
    const regRows = [], candidateRows = [], guardianRows = [], addressRows = [], schoolRows = [], userRows = [];
    const billRows = [], paymentRows = [], paymentVerificationRows = [], notificationRows = [];
    const userByIndex = {};

    profiles.forEach((p, i) => {
      const no = String(i + 1).padStart(2, '0');
      const userId = 'TEST-USER-' + no;
      const candidateId = 'TEST-CND-' + no;
      const guardianId = 'TEST-GRD-' + no;
      const addressId = 'TEST-ADR-' + no;
      const schoolId = 'TEST-SCH-' + no;
      const registrationId = 'TEST-REG-' + no;
      const email = 'dummy.wali' + no + '@example.test';
      const phone = '081299900' + String(100 + i);
      const phoneNormalized = normalizePhone_(phone);
      const salt = 'TESTSALT' + no + '2027';
      const hash = hashPassword_(PSB_TEST_DATA.PASSWORD, salt);
      const birth = new Date(2012 + (i % 3), (i * 2) % 12, 5 + (i % 20));
      const graduationYear = 2026;

      userRows.push([
        userId, 'Wali ' + p.n, phone, phoneNormalized, email, email.toLowerCase(),
        hash, salt, 'WALI', 'ACTIVE', '', '', now, now, false
      ]);
      userByIndex[i] = userId;

      candidateRows.push([
        candidateId, p.n, '3276010101' + String(700000 + i).padStart(6, '0'),
        ['Bogor','Depok','Jakarta','Bekasi'][i % 4], birth, p.gender, 1 + (i % 3),
        ['ANAK_KANDUNG','ANAK_KANDUNG','ANAK_KANDUNG','ANAK_TIRI'][i % 4], '', now, now
      ]);

      guardianRows.push([
        guardianId, userId, candidateId, 'AYAH', 'Wali ' + p.n, '3276010101' + String(800000 + i).padStart(6, '0'),
        phone, email, ['Wiraswasta','Karyawan','Guru','Pedagang'][i % 4], ['SMA','D3','S1','S2'][i % 4], true, now, now
      ]);

      addressRows.push([
        addressId, candidateId, 'DOMISILI',
        'Jl. Dummy Uji Coba No. ' + (10 + i), String(1 + (i % 8)).padStart(2,'0'), String(1 + (i % 6)).padStart(2,'0'),
        ['Cibinong','Beji','Cipayung','Pondok Gede'][i % 4],
        ['Cibinong','Beji','Cimanggis','Jatiasih'][i % 4],
        ['Bogor','Depok','Depok','Bekasi'][i % 4], 'Jawa Barat', '16' + String(100 + i), now, now
      ]);

      schoolRows.push([
        schoolId, candidateId, ['SDN Contoh 01','SDIT Contoh 02','MI Contoh 03'][i % 3],
        i % 3 === 0 ? 'SDN' : i % 3 === 1 ? 'SDIT' : 'MI', 'TEST-NPSN-' + no,
        'Alamat Sekolah Dummy ' + no, graduationYear, now, now
      ]);

      regRows.push([
        registrationId, 'TEST-PSB-2027-' + no, userId, candidateId, year.tahunAjaranId, p.wave.gelombangId,
        p.level.jenjangId, p.status,
        ['DRAFT','SUBMITTED'].indexOf(p.status) >= 0 ? now : new Date(now.getTime() - (i + 1) * 86400000),
        ['VERIFIED','PAYMENT_VERIFIED'].indexOf(p.status) >= 0 ? new Date(now.getTime() - (i + 1) * 43200000) : '',
        '', now, now
      ]);

      if (p.payment !== 'NONE' && formPaymentType) {
        const billId = 'TEST-BIL-' + no;
        const paymentId = 'TEST-PAY-' + no;
        const verificationId = 'TEST-PVF-' + no;
        const paymentStatus = p.payment === 'VERIFIED' ? 'VERIFIED' : p.payment === 'REJECTED' ? 'REJECTED' : 'SUBMITTED';
        const billStatus = paymentStatus === 'VERIFIED' ? 'PAID' : paymentStatus === 'SUBMITTED' ? 'PAYMENT_REVIEW' : 'UNPAID';
        const amount = formAmount > 0 ? formAmount : 150000;
        const submittedAt = new Date(now.getTime() - (i + 1) * 3600000);

        billRows.push([billId, registrationId, formPaymentType.paymentTypeId, amount, new Date(now.getTime() + 7 * 86400000), billStatus, now, now]);
        paymentRows.push([paymentId, billId, registrationId, amount, 'TRANSFER', '', '', paymentStatus, submittedAt, submittedAt, now]);
        paymentVerificationRows.push([verificationId, paymentId, paymentStatus, 'TEST-USER-SYSTEM', now, p.payment === 'REJECTED' ? 'Dummy: bukti pembayaran ditolak.' : 'Dummy: verifikasi pembayaran formulir.']);
      }

      if (i < 3 || i === 11) {
        notificationRows.push(['TEST-NOTIF-' + no, userId, 'Notifikasi Uji Coba',
          i === 0 ? 'Ini contoh notifikasi untuk akun WALI dummy.' : 'Status pendaftaran dummy dapat digunakan untuk pengujian.',
          'INFO', i === 0 ? false : true, now, i === 0 ? '' : now]);
      }
    });

    // Jadwal seleksi dummy. Tidak memakai Drive dan tidak mengubah master.
    const scheduleId = 'TEST-SCH-SEL-01';
    const scheduleDate = new Date(now.getTime() + 3 * 86400000);
    const scheduleRows = [[scheduleId, year.tahunAjaranId, 'Tes Seleksi Dummy - Batch Uji', scheduleDate, 'Ruang Uji Coba PSB', true, now, now]];

    const participantRows = [];
    const scoreRows = [];
    const resultRows = [];
    const selectedIndexes = [5,6,7,8,9];
    selectedIndexes.forEach(i => {
      const no = String(i + 1).padStart(2, '0');
      const participantId = 'TEST-PTC-' + no;
      const registrationId = 'TEST-REG-' + no;
      const participantStatus = i === 6 ? 'ABSENT' : 'PRESENT';
      participantRows.push([participantId, registrationId, scheduleId, participantStatus, now, now]);

      const base = i === 5 ? 92 : i === 6 ? 55 : i === 7 ? 78 : i === 8 ? 88 : 81;
      [['AKADEMIK',base],['WAWANCARA',Math.max(0,base-3)],['BACA_QURAN',Math.max(0,base-5)]].forEach((sc, j) => {
        scoreRows.push(['TEST-SCR-' + no + '-' + (j + 1), participantId, sc[0], sc[1], 'Dummy score untuk pengujian.', now, now]);
      });

      const profile = profiles[i];
      if (profile.result) {
        resultRows.push(['TEST-RES-' + no, registrationId, profile.result, new Date(now.getTime() + 7 * 86400000), 'Hasil dummy untuk pengujian Stage 8.', now, now]);
      }
    });

    const reregRows = [[
      'TEST-RRG-06', 'TEST-REG-06', 'PENDING', '', 'Dummy daftar ulang untuk calon yang lulus.', now, now
    ]];

    appendRowsByHeaders_(userSheet, userRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.CANDIDATES), candidateRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.GUARDIANS), guardianRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.ADDRESSES), addressRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.SCHOOLS), schoolRows);
    appendRowsByHeaders_(regSheet, regRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.BILLS), billRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.PAYMENTS), paymentRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.PAYMENT_VERIFICATIONS), paymentVerificationRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.NOTIFICATIONS), notificationRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE), scheduleRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.SELECTION_PARTICIPANTS), participantRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCORES), scoreRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS), resultRows);
    appendRowsByHeaders_(ss.getSheetByName(PSB_SHEETS.REREGISTRATIONS), reregRows);

    return {
      success: true,
      message: 'Data dummy berhasil dibuat. Semua record memakai prefix TEST- dan tidak membuat file Drive.',
      password: PSB_TEST_DATA.PASSWORD,
      waliLoginHint: 'dummy.wali01@example.test s.d. dummy.wali12@example.test',
      counts: {
        users: userRows.length,
        registrations: regRows.length,
        bills: billRows.length,
        payments: paymentRows.length,
        participants: participantRows.length,
        scores: scoreRows.length,
        results: resultRows.length,
        notifications: notificationRows.length
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function clearPSBTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');
  const fields = [
    [PSB_SHEETS.SELECTION_SCORES, 'scoreId'],
    [PSB_SHEETS.SELECTION_RESULTS, 'resultId'],
    [PSB_SHEETS.SELECTION_PARTICIPANTS, 'participantId'],
    [PSB_SHEETS.SELECTION_SCHEDULE, 'scheduleId'],
    [PSB_SHEETS.PAYMENT_VERIFICATIONS, 'verificationId'],
    [PSB_SHEETS.PAYMENTS, 'paymentId'],
    [PSB_SHEETS.BILLS, 'billId'],
    [PSB_SHEETS.REREGISTRATIONS, 'reregistrationId'],
    [PSB_SHEETS.NOTIFICATIONS, 'notificationId'],
    [PSB_SHEETS.SCHOOLS, 'schoolId'],
    [PSB_SHEETS.ADDRESSES, 'addressId'],
    [PSB_SHEETS.GUARDIANS, 'guardianId'],
    [PSB_SHEETS.CANDIDATES, 'candidateId'],
    [PSB_SHEETS.REGISTRATIONS, 'registrationId'],
    [PSB_SHEETS.USERS, 'userId']
  ];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let removed = 0;
    fields.forEach(([sheetName, idField]) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const idx = headers.indexOf(idField);
      if (idx < 0) return;
      const rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
      for (let i = rows.length - 1; i >= 0; i--) {
        if (String(rows[i][idx] || '').indexOf(PSB_TEST_DATA.PREFIX) === 0) {
          sheet.deleteRow(i + 2);
          removed++;
        }
      }
    });
    // Bersihkan cache login untuk akun dummy yang mungkin pernah dipakai.
    for (let i = 1; i <= 12; i++) {
      const no = String(i).padStart(2, '0');
      const email = 'dummy.wali' + no + '@example.test';
      const phone = normalizePhone_('081299900' + String(100 + i - 1));
      try { CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(email).substring(0,32)); } catch (e) {}
      try { CacheService.getScriptCache().remove('PSB_USER_V3_' + sha256Hex_(phone).substring(0,32)); } catch (e) {}
    }
    return {success:true, removed:removed, message:'Semua data dummy dengan prefix TEST- berhasil dihapus.'};
  } finally {
    lock.releaseLock();
  }
}

function appendRowsByHeaders_(sheet, rows) {
  if (!sheet || !rows || !rows.length) return;

  // Data dummy dibuat mengikuti PSB_HEADERS, sedangkan sheet yang sudah
  // dipakai sebelumnya bisa mempunyai susunan/kolom tambahan yang berbeda.
  // Jangan memaksa jumlah kolom harus identik; petakan berdasarkan nama header
  // agar seed tidak merusak struktur sheet yang sudah ada.
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  const canonical = PSB_HEADERS[Object.keys(PSB_SHEETS).find(k => PSB_SHEETS[k] === sheet.getName())] || [];
  if (!canonical.length) throw new Error('Header dummy untuk sheet ' + sheet.getName() + ' belum tersedia.');

  const canonicalIndex = {};
  canonical.forEach((h, i) => { canonicalIndex[String(h).trim()] = i; });
  const missing = canonical.filter(h => headers.indexOf(h) < 0);
  if (missing.length) {
    throw new Error('Struktur sheet ' + sheet.getName() + ' tidak sesuai. Header wajib yang belum ada: ' + missing.join(', '));
  }

  const normalized = rows.map(source => {
    if (source.length !== canonical.length) {
      throw new Error('Data dummy untuk sheet ' + sheet.getName() + ' tidak sesuai dengan PSB_HEADERS.');
    }
    return headers.map(h => {
      const idx = canonicalIndex[h];
      return idx === undefined ? '' : source[idx];
    });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, normalized.length, headers.length).setValues(normalized);
}

function countTestRows_(sheet, idField) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const idx = headers.indexOf(idField);
  if (idx < 0) return 0;
  return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues()
    .filter(r => String(r[idx] || '').indexOf(PSB_TEST_DATA.PREFIX) === 0).length;
}
