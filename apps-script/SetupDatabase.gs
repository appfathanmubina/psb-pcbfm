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
 * Keamanan:
 * - Tidak menyimpan hash/salt/password Superadmin di source repository.
 * - Kredensial bootstrap disimpan di Script Properties melalui
 *   configureInitialSuperadmin_() yang dijalankan manual oleh editor tepercaya.
 * - Tidak menyediakan fungsi seed/clear data dummy di source produksi.
 */

const PSB_SETUP = {
  APP_NAME: 'PSB Fathan Mubina',
  ACTIVE_YEAR: '2027/2028',
  TIMEZONE: 'Asia/Jakarta',
  ROOT_FOLDER_NAME: 'PSB Fathan Mubina',
  YEAR_FOLDER_NAME: '2027-2028'
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
  WALI_OTP: 'WALI_OTP'
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
  WALI_OTP: ['verificationId','name','phone','phoneNormalized','email','emailNormalized','passwordHash','passwordSalt','otpHash','otpSalt','expiresAt','attempts','maxAttempts','sendCount','lastSentAt','status','createdAt','verifiedAt','waMessageId']
};

function setupPSBDatabase_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');

  PropertiesService.getScriptProperties().setProperties({
    PSB_SPREADSHEET_ID: ss.getId(),
    PSB_ROOT_FOLDER_ID: getOrCreateFolder_(PSB_SETUP.ROOT_FOLDER_NAME).getId()
  }, false);

  Object.keys(PSB_SHEETS).forEach(key => ensureSheet_(ss, PSB_SHEETS[key], PSB_HEADERS[key]));

  ensureDefaultConfig_();
  ensureInitialMasterData_();
  setupDriveFolders_();
  const superadminBootstrap = createInitialSuperadmin_();
  removeLegacyChatAutomationTriggers_();

  return {
    success: true,
    message: superadminBootstrap && superadminBootstrap.created === false &&
      superadminBootstrap.code === 'SUPERADMIN_BOOTSTRAP_NOT_CONFIGURED'
      ? 'Foundation PSB disiapkan. Akun Superadmin belum dibuat; konfigurasi kredensial melalui editor Apps Script tepercaya.'
      : 'Foundation PSB berhasil disiapkan.',
    spreadsheetId: ss.getId(),
    superadminBootstrap: superadminBootstrap
  };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < headers.length) {
    throw new Error(
      'Struktur sheet "' + name + '" tidak sesuai. Ditemukan ' +
      lastColumn + ' kolom, sedangkan diperlukan minimal ' + headers.length +
      '. Header tidak diubah untuk melindungi data. Periksa sheet secara manual.'
    );
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0]
    .map(value => String(value || '').trim());
  const mismatches = headers
    .map((expected, index) => current[index] === expected ? '' :
      (index + 1) + ': seharusnya "' + expected + '", ditemukan "' + current[index] + '"')
    .filter(Boolean);

  if (mismatches.length) {
    throw new Error(
      'Header sheet "' + name + '" tidak cocok. Tidak ada perubahan yang dilakukan. ' +
      mismatches.join('; ')
    );
  }

  sheet.setFrozenRows(1);
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
  }, false);
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

function removeLegacyChatAutomationTriggers_() {
  // Chat PSB sudah dihentikan. Hapus pemicu lama agar Apps Script tidak lagi
  // mencoba menjalankan runChatAutomation/runChatAutomation_ yang sudah tidak ada.
  const legacyHandlers = ['runChatAutomation', 'runChatAutomation_'];
  let removed = 0;
  try {
    ScriptApp.getProjectTriggers().forEach(trigger => {
      if (legacyHandlers.indexOf(trigger.getHandlerFunction()) >= 0) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });
    PropertiesService.getScriptProperties().deleteProperty('PSB_CHAT_AUTOMATION_TRIGGER');
    return { success: true, removed: removed };
  } catch (e) {
    console.error('Legacy chat trigger cleanup failed: ' + String(e && e.message || e));
    return { success: false, removed: removed };
  }
}

function configureInitialSuperadmin_() {
  const ui = SpreadsheetApp.getUi();
  const usernamePrompt = ui.prompt(
    'Konfigurasi Superadmin awal',
    'Masukkan username Superadmin (4-40 karakter).',
    ui.ButtonSet.OK_CANCEL
  );
  if (usernamePrompt.getSelectedButton() !== ui.Button.OK) {
    return { success: false, cancelled: true, message: 'Konfigurasi dibatalkan.' };
  }

  const namePrompt = ui.prompt(
    'Konfigurasi Superadmin awal',
    'Masukkan nama tampilan Superadmin.',
    ui.ButtonSet.OK_CANCEL
  );
  if (namePrompt.getSelectedButton() !== ui.Button.OK) {
    return { success: false, cancelled: true, message: 'Konfigurasi dibatalkan.' };
  }

  const passwordPrompt = ui.prompt(
    'Konfigurasi Superadmin awal',
    'Masukkan password kuat minimal 12 karakter. Jangan gunakan password yang dipakai di layanan lain.',
    ui.ButtonSet.OK_CANCEL
  );
  if (passwordPrompt.getSelectedButton() !== ui.Button.OK) {
    return { success: false, cancelled: true, message: 'Konfigurasi dibatalkan.' };
  }

  const user = String(usernamePrompt.getResponseText() || '').trim();
  const displayName = String(namePrompt.getResponseText() || '').trim();
  const secret = String(passwordPrompt.getResponseText() || '');

  if (!user || !displayName || secret.length < 12) {
    throw new Error('Username, nama, dan password minimal 12 karakter wajib diisi.');
  }
  if (!/^[A-Za-z0-9._-]{4,40}$/.test(user)) {
    throw new Error('Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (4-40 karakter).');
  }

  const salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    PSB_INITIAL_SUPERADMIN_USERNAME: user,
    PSB_INITIAL_SUPERADMIN_NAME: displayName,
    PSB_INITIAL_SUPERADMIN_SALT: salt,
    PSB_INITIAL_SUPERADMIN_HASH: hashPassword_(secret, salt)
  }, false);

  return {
    success: true,
    message: 'Kredensial bootstrap tersimpan di Script Properties. Jalankan setupPSBDatabase_() untuk membuat akun jika belum ada.'
  };
}

function createInitialSuperadmin_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');
  const sheet = ss.getSheetByName(PSB_SHEETS.USERS);
  if (!sheet) throw new Error('Sheet USERS belum tersedia.');

  const props = PropertiesService.getScriptProperties();
  const username = String(props.getProperty('PSB_INITIAL_SUPERADMIN_USERNAME') || '').trim();
  const displayName = String(props.getProperty('PSB_INITIAL_SUPERADMIN_NAME') || '').trim();
  const hash = String(props.getProperty('PSB_INITIAL_SUPERADMIN_HASH') || '');
  const salt = String(props.getProperty('PSB_INITIAL_SUPERADMIN_SALT') || '');

  if (!username || !displayName || !hash || !salt) {
    return {
      success: false,
      created: false,
      code: 'SUPERADMIN_BOOTSTRAP_NOT_CONFIGURED',
      message: 'Akun Superadmin belum dibuat. Editor tepercaya harus menjalankan configureInitialSuperadmin_() terlebih dahulu.'
    };
  }

  const usernameNormalized = username.toLowerCase();
  const data = sheet.getDataRange().getValues();
  const exists = data.slice(1).some(row =>
    String(row[2] || '').toLowerCase() === usernameNormalized ||
    String(row[4] || '').toLowerCase() === usernameNormalized
  );
  if (exists) {
    ['PSB_INITIAL_SUPERADMIN_HASH','PSB_INITIAL_SUPERADMIN_SALT','PSB_INITIAL_SUPERADMIN_USERNAME','PSB_INITIAL_SUPERADMIN_NAME'].forEach(key => props.deleteProperty(key));
    return { success: true, created: false, message: 'Akun dengan username tersebut sudah ada. Data bootstrap sementara dibersihkan.' };
  }

  const userId = generateId_('USR');
  const now = new Date();
  sheet.appendRow([
    userId,
    displayName,
    username,
    usernameNormalized,
    '',
    '',
    hash,
    salt,
    'SUPERADMIN',
    'ACTIVE',
    '',
    '',
    now,
    now,
    true
  ]);

  // Hapus rahasia bootstrap setelah akun berhasil dibuat.
  props.deleteProperty('PSB_INITIAL_SUPERADMIN_HASH');
  props.deleteProperty('PSB_INITIAL_SUPERADMIN_SALT');
  props.deleteProperty('PSB_INITIAL_SUPERADMIN_USERNAME');
  props.deleteProperty('PSB_INITIAL_SUPERADMIN_NAME');

  return { success: true, created: true, userId: userId, username: username };
}
