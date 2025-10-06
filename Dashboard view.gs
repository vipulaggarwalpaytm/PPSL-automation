/**
 * RA Team Dashboard – Backend (Hardened header/value matching)
 * - Auto-detects user via Session.getActiveUser().getEmail()
 * - Tolerant header detection for HOD/Expected Date/Remarks
 * - Tolerant HOD value comparison (ignores case/spaces/dots/_/-)
 */

const SHEET_ID         = '1bmJFhR-RbYtSf6g3LKi-nj2piSUV9csmm3fuuB0XQYU';
const SHEET_USERS      = 'users';                 // also accepts "Users"
const SHEET_MANAGEMENT = 'Management View';
const SHEET_MERCHANT   = 'Merchant_wise_Final';
const SHEET_BILLED     = 'Billed Detailed';
const SHEET_UNBILLED   = 'Unbilled Detailed';

/* -------------------- Web App -------------------- */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('RA Team Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* -------------------- Helpers -------------------- */
function getSS_() { return SpreadsheetApp.openById(SHEET_ID); }
function getSheet_(name) {
  const sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error(`Sheet not found: ${name}`);
  return sh;
}
function getSheetAny_(names) {
  const ss = getSS_();
  for (const nm of names) {
    const sh = ss.getSheetByName(nm);
    if (sh) return sh;
  }
  throw new Error(`Sheet not found. Tried: ${names.join(', ')}`);
}

function sheetToObjects_(sh) {
  const values = sh.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(h => String(h || '').trim());
  return values.slice(1).map((row, idx) => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    obj._rowIndex = idx + 2; // 1-based
    return obj;
  });
}

/* Normalization */
function norm(s) { return String(s || '').trim(); }
function normLower(s) { return norm(s).toLowerCase(); }
/** Collapse separators for tolerant key/value matching */
function normKey(s) {
  return norm(s).toLowerCase().replace(/[\s._\-\/]+/g, '');
}

/* Find a header name by tolerant matching against candidate "meanings" */
function findHeaderName_(headers, candidateKeys /* array of strings */) {
  if (!headers || !headers.length) return null;
  const targetKeys = candidateKeys.map(normKey);
  // try exact normalized equality
  let found = headers.find(h => targetKeys.includes(normKey(h)));
  if (found) return found;

  // try prefix/contains (e.g., "HOD Name" should match "hod")
  found = headers.find(h => {
    const nk = normKey(h);
    return targetKeys.some(t => nk.startsWith(t) || nk.endsWith(t) || nk.includes(t));
  });
  return found || null;
}

/* Build a getter for a tolerant header - FIXED to use headers array directly */
function makeGetterForHeader_(headers, candidates) {
  const header = findHeaderName_(headers, candidates);
  if (!header) {
    Logger.log(`Warning: Header not found for candidates: ${candidates.join(', ')}`);
    return () => '';             // header not found
  }
  Logger.log(`Found header "${header}" for candidates: ${candidates.join(', ')}`);
  return (row) => row[header];   // getter for that header
}

/* Boolean-ish */
function asBool(v) {
  const s = normLower(v);
  return !(s === 'false' || s === 'no' || s === '0');
}

/* Fortnight window: 1–5 and 16–20 IST */
function isFortnightWindowOpen_() {
  const day = parseInt(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd'), 10);
  return (day >= 1 && day <= 5) || (day >= 16 && day <= 20);
}

/* -------------------- Users -------------------- */
function getUsers() {
  const sh = getSheetAny_([SHEET_USERS, 'Users']);
  const rows = sheetToObjects_(sh);

  // Resolve tolerant header names on the Users sheet
  const hdrEmail = findHeaderName_(Object.keys(rows[0] || {}), ['email', 'mail']);
  const hdrName  = findHeaderName_(Object.keys(rows[0] || {}), ['name', 'username', 'full name']);
  const hdrHod   = findHeaderName_(Object.keys(rows[0] || {}), ['hod', 'hodname', 'head of dept', 'head of department']);
  const hdrRole  = findHeaderName_(Object.keys(rows[0] || {}), ['role']);
  const hdrAct   = findHeaderName_(Object.keys(rows[0] || {}), ['active', 'enabled']);

  return rows.map(r => ({
    email: hdrEmail ? norm(r[hdrEmail]) : '',
    name:  hdrName  ? norm(r[hdrName])  : '',
    hod:   hdrHod   ? norm(r[hdrHod])   : '',
    role:  hdrRole  ? norm(r[hdrRole])  : 'User',
    active: hdrAct ? asBool(r[hdrAct]) : true
  })).filter(u => u.email);
}

/* -------------------- Main API -------------------- */
function getAllDataForEmail(email) {
  const activeEmail = email && norm(email) !== ''
    ? normLower(email)
    : normLower(Session.getActiveUser().getEmail());

  if (!activeEmail) {
    throw new Error('Could not detect signed-in user. Deploy as "Execute as Me" + "Anyone in your domain".');
  }

  Logger.log(`Active email: ${activeEmail}`);

  const users = getUsers();
  const user = users.find(u => normLower(u.email) === activeEmail && u.active);
  if (!user) throw new Error(`User not found or inactive: ${activeEmail}`);

  Logger.log(`User found: ${user.name}, HOD: ${user.hod}, Role: ${user.role}`);

  // Load sheets
  const mgmt    = sheetToObjects_(getSheet_(SHEET_MANAGEMENT));
  const merch   = sheetToObjects_(getSheet_(SHEET_MERCHANT));
  const billed  = sheetToObjects_(getSheet_(SHEET_BILLED));
  const unbilled= sheetToObjects_(getSheet_(SHEET_UNBILLED));

  Logger.log(`Loaded sheets - Mgmt: ${mgmt.length}, Merch: ${merch.length}, Billed: ${billed.length}, Unbilled: ${unbilled.length}`);

  // Get headers from each sheet
  const mgmtHeaders    = mgmt.length ? Object.keys(mgmt[0]).filter(k => k !== '_rowIndex') : [];
  const merchHeaders   = merch.length ? Object.keys(merch[0]).filter(k => k !== '_rowIndex') : [];
  const billedHeaders  = billed.length ? Object.keys(billed[0]).filter(k => k !== '_rowIndex') : [];
  const unbilledHeaders= unbilled.length ? Object.keys(unbilled[0]).filter(k => k !== '_rowIndex') : [];

  Logger.log(`Headers - Mgmt: ${mgmtHeaders.join(', ')}`);
  Logger.log(`Headers - Merch: ${merchHeaders.join(', ')}`);
  Logger.log(`Headers - Billed: ${billedHeaders.join(', ')}`);
  Logger.log(`Headers - Unbilled: ${unbilledHeaders.join(', ')}`);

  // Build tolerant HOD getters per sheet (detect header dynamically)
  const getHOD_mgmt    = makeGetterForHeader_(mgmtHeaders,   ['hod', 'hodname', 'head of dept', 'head of department']);
  const getHOD_merch   = makeGetterForHeader_(merchHeaders,  ['hod', 'hodname', 'head of dept', 'head of department']);
  const getHOD_billed  = makeGetterForHeader_(billedHeaders, ['hod', 'hodname', 'head of dept', 'head of department']);
  const getHOD_unbilled= makeGetterForHeader_(unbilledHeaders, ['hod', 'hodname', 'head of dept', 'head of department']);

  const isAdmin = normLower(user.role) === 'admin';
  Logger.log(`Is Admin: ${isAdmin}`);

  const matchHOD = (getter, row) => {
    if (isAdmin) return true;
    const rowHOD = getter(row);
    const match = normKey(rowHOD) === normKey(user.hod);
    if (!match && mgmt.indexOf(row) < 5) { // Log first few mismatches
      Logger.log(`HOD mismatch - Row HOD: "${rowHOD}" (normalized: "${normKey(rowHOD)}") vs User HOD: "${user.hod}" (normalized: "${normKey(user.hod)}")`);
    }
    return match;
  };

  // Helper to find column name in row
  const findCol = (row, candidates) => {
    const keys = Object.keys(row).filter(k => k !== '_rowIndex');
    return findHeaderName_(keys, candidates) || '';
  };

  // Friendly helpers to read common columns by tolerant names
  const getMerchant = (row) => {
    const col = findCol(row, ['merchant', 'merchant name', 'merchant_name', 'merchantname']);
    return col ? row[col] : '';
  };
  const getStatus = (row) => {
    const col = findCol(row, ['status']);
    return col ? row[col] : '';
  };
  const getRevenue = (row) => {
    const col = findCol(row, ['revenue', 'amount', 'total']);
    return col ? row[col] : 0;
  };
  const getDate = (row) => {
    const col = findCol(row, ['date', 'bill date', 'dt']);
    return col ? row[col] : '';
  };
  const getAmount = (row) => {
    const col = findCol(row, ['amount', 'amt', 'value']);
    return col ? row[col] : 0;
  };
  const getInvoice = (row) => {
    const col = findCol(row, ['invoice', 'invoice no', 'invoice_no', 'inv']);
    return col ? row[col] : '';
  };
  const getPending = (row) => {
    const col = findCol(row, ['pending', 'pending on']);
    return col ? row[col] : '';
  };
  const getDays = (row) => {
    const col = findCol(row, ['days', 'days pending']);
    return col ? row[col] : '';
  };

  // Expected Date & Remarks for Merchant_wise_Final (headers OR V/W)
  const hdrExp = findHeaderName_(merchHeaders, ['expected date', 'expected_date', 'expecteddate', 'v']) || 'V';
  const hdrRem = findHeaderName_(merchHeaders, ['remarks', 'w']) || 'W';

  Logger.log(`Merchant sheet - Expected Date column: "${hdrExp}", Remarks column: "${hdrRem}"`);

  // Build data sets
  const management = mgmt.filter(r => matchHOD(getHOD_mgmt, r)).map(r => ({
    id: r._rowIndex,
    HOD: getHOD_mgmt(r),
    merchant: getMerchant(r),
    status: getStatus(r),
    revenue: getRevenue(r),
    date: getDate(r),
    _rowIndex: r._rowIndex
  }));

  const merchantWise = merch.filter(r => matchHOD(getHOD_merch, r)).map(r => ({
    id: r._rowIndex,
    HOD: getHOD_merch(r),
    merchant: getMerchant(r),
    amount: getAmount(r),
    status: getStatus(r),
    expectedDate: r[hdrExp] || '',
    remarks: r[hdrRem] || '',
    _rowIndex: r._rowIndex
  }));

  const billedRows = billed.filter(r => matchHOD(getHOD_billed, r)).map(r => ({
    id: r._rowIndex,
    HOD: getHOD_billed(r),
    merchant: getMerchant(r),
    invoice: getInvoice(r),
    amount: getAmount(r),
    date: getDate(r),
    _rowIndex: r._rowIndex
  }));

  const unbilledRows = unbilled.filter(r => matchHOD(getHOD_unbilled, r)).map(r => ({
    id: r._rowIndex,
    HOD: getHOD_unbilled(r),
    merchant: getMerchant(r),
    amount: getAmount(r),
    pending: getPending(r),
    days: getDays(r),
    _rowIndex: r._rowIndex
  }));

  Logger.log(`Filtered results - Mgmt: ${management.length}, Merch: ${merchantWise.length}, Billed: ${billedRows.length}, Unbilled: ${unbilledRows.length}`);

  return {
    user,
    data: {
      management,
      merchantWise,
      billed: billedRows,
      unbilled: unbilledRows
    },
    editingEnabled: isFortnightWindowOpen_(),
    lastUpdate: new Date().toLocaleString('en-IN'),
    debug: {
      totalRows: {
        management: mgmt.length,
        merchantWise: merch.length,
        billed: billed.length,
        unbilled: unbilled.length
      },
      filteredRows: {
        management: management.length,
        merchantWise: merchantWise.length,
        billed: billedRows.length,
        unbilled: unbilledRows.length
      }
    }
  };
}

/* -------------------- Save to V/W -------------------- */
function saveMerchantWiseUpdates(email, updates) {
  const activeEmail = email && norm(email) !== ''
    ? normLower(email)
    : normLower(Session.getActiveUser().getEmail());
  const users = getUsers();
  const user = users.find(u => normLower(u.email) === activeEmail && u.active);
  if (!user) throw new Error('User not found or inactive.');

  if (!isFortnightWindowOpen_()) throw new Error('Editing window is closed.');

  const sh = getSheet_(SHEET_MERCHANT);
  const values = sh.getDataRange().getValues();
  if (!values.length) return { updated: 0 };

  const headers = values[0].map(h => String(h || '').trim());

  // Find indices for Expected Date / Remarks (prefer V/W indexes if exist)
  let colV = headers.length > 21 ? 21 : headers.findIndex(h => normKey(h) === 'expecteddate' || normKey(h) === 'v');
  let colW = headers.length > 22 ? 22 : headers.findIndex(h => normKey(h) === 'remarks'      || normKey(h) === 'w');

  if (colV < 0) colV = headers.findIndex(h => normKey(h) === 'expecteddate' || normKey(h) === 'v');
  if (colW < 0) colW = headers.findIndex(h => normKey(h) === 'remarks'      || normKey(h) === 'w');

  if (colV < 0 || colW < 0) {
    throw new Error('Could not find columns V/W or headers "Expected Date"/"Remarks" in Merchant_wise_Final.');
  }

  // Find HOD column index tolerantly
  const hodIdx = (() => {
    const idx = headers.findIndex(h => {
      const nk = normKey(h);
      return nk === 'hod' || nk === 'hodname' || nk === 'headofdept' || nk === 'headofdepartment';
    });
    return idx >= 0 ? idx : -1;
  })();

  let count = 0;
  const keys = Object.keys(updates || {});
  for (const key of keys) {
    const upd = updates[key] || {};
    const rowIndex = parseInt(key, 10); // 1-based
    if (!rowIndex || rowIndex <= 1 || rowIndex > values.length) continue;

    // Enforce HOD ownership unless Admin
    const isAdmin = normLower(user.role) === 'admin';
    if (!isAdmin && hodIdx >= 0) {
      const rowHOD = values[rowIndex - 1][hodIdx];
      if (normKey(rowHOD) !== normKey(user.hod)) continue;
    }

    if (typeof upd.expectedDate !== 'undefined') values[rowIndex - 1][colV] = upd.expectedDate;
    if (typeof upd.remarks      !== 'undefined') values[rowIndex - 1][colW] = upd.remarks;

    sh.getRange(rowIndex, 1, 1, headers.length).setValues([values[rowIndex - 1]]);
    count++;
  }

  return { updated: count, at: new Date().toLocaleString('en-IN') };
}

/* -------------------- Publish/Refresh -------------------- */
function refreshNow() {
  return { lastUpdate: new Date().toLocaleString('en-IN') };
}

/* -------------------- Debug Helpers -------------------- */
function debugUsers() {
  Logger.log(JSON.stringify(getUsers(), null, 2));
}
function debugHeaders() {
  const mgmt = sheetToObjects_(getSheet_(SHEET_MANAGEMENT));
  const merch = sheetToObjects_(getSheet_(SHEET_MERCHANT));
  const billed = sheetToObjects_(getSheet_(SHEET_BILLED));
  const unbilled = sheetToObjects_(getSheet_(SHEET_UNBILLED));
  Logger.log('Mgmt headers: ' + Object.keys(mgmt[0] || {}).join(' | '));
  Logger.log('Merch headers: ' + Object.keys(merch[0] || {}).join(' | '));
  Logger.log('Billed headers: ' + Object.keys(billed[0] || {}).join(' | '));
  Logger.log('Unbilled headers: ' + Object.keys(unbilled[0] || {}).join(' | '));
}

/* Test function to debug specific user */
function testUserData() {
  try {
    const result = getAllDataForEmail('');
    Logger.log('SUCCESS: ' + JSON.stringify(result, null, 2));
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
    Logger.log('Stack: ' + e.stack);
  }
}
