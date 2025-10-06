/**
 * RA Team Dashboard – Backend (FIXED VERSION)
 * - Auto-detects user via Session.getActiveUser().getEmail()
 * - Enhanced error handling and logging
 * - Safer HOD matching with fallback options
 */

const SHEET_ID         = '1bmJFhR-RbYtSf6g3LKi-nj2piSUV9csmm3fuuB0XQYU';
const SHEET_USERS      = 'users';
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
function getSS_() { 
  return SpreadsheetApp.openById(SHEET_ID); 
}

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
  const data = sh.getDataRange().getValues();
  if (!data || data.length === 0) return [];
  
  const headers = data[0].map(h => String(h || '').trim());
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const obj = { _rowIndex: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  
  return rows;
}

/* Normalization */
function norm(s) { 
  return String(s || '').trim(); 
}

function normLower(s) { 
  return norm(s).toLowerCase(); 
}

function normKey(s) {
  return norm(s).toLowerCase().replace(/[\s._\-\/]+/g, '');
}

/* Find a header name by tolerant matching */
function findHeaderName_(headers, candidates) {
  if (!headers || !headers.length || !candidates || !candidates.length) {
    return null;
  }
  
  const targetKeys = candidates.map(normKey);
  
  // Try exact match first
  for (const h of headers) {
    const nk = normKey(h);
    if (targetKeys.includes(nk)) {
      return h;
    }
  }
  
  // Try partial match
  for (const h of headers) {
    const nk = normKey(h);
    for (const t of targetKeys) {
      if (nk.includes(t) || t.includes(nk)) {
        return h;
      }
    }
  }
  
  return null;
}

/* Get a value from a row by trying multiple header names */
function getValueByHeader_(row, candidates) {
  if (!row || !candidates) return '';
  
  const keys = Object.keys(row);
  const header = findHeaderName_(keys, candidates);
  
  if (header && row[header] !== undefined) {
    return row[header];
  }
  
  return '';
}

/* Boolean-ish */
function asBool(v) {
  if (v === true || v === false) return v;
  const s = normLower(v);
  return s === 'true' || s === 'yes' || s === '1' || s === 'active';
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
  
  Logger.log(`Found ${rows.length} total rows in Users sheet`);
  
  if (rows.length === 0) {
    throw new Error('Users sheet is empty. Please add user data.');
  }
  
  // Log headers for debugging
  const sampleHeaders = rows[0] ? Object.keys(rows[0]).filter(k => k !== '_rowIndex') : [];
  Logger.log(`Users sheet headers: ${sampleHeaders.join(', ')}`);
  
  const users = rows.map(r => ({
    email: norm(getValueByHeader_(r, ['email', 'mail', 'e-mail'])),
    name: norm(getValueByHeader_(r, ['name', 'username', 'full name', 'fullname'])),
    hod: norm(getValueByHeader_(r, ['hod', 'hodname', 'hod name', 'head of dept', 'head of department'])),
    role: norm(getValueByHeader_(r, ['role', 'user role'])) || 'User',
    active: asBool(getValueByHeader_(r, ['active', 'enabled', 'status']))
  })).filter(u => u.email);
  
  Logger.log(`Processed ${users.length} valid users`);
  
  return users;
}

/* -------------------- Main API -------------------- */
function getAllDataForEmail(email) {
  Logger.log('========== START getAllDataForEmail ==========');
  
  // Get active user email
  const activeEmail = email && norm(email) !== ''
    ? normLower(email)
    : normLower(Session.getActiveUser().getEmail());

  if (!activeEmail) {
    throw new Error('Could not detect signed-in user. Deploy as "Execute as Me" + "Anyone in your domain".');
  }

  Logger.log(`Active email: ${activeEmail}`);

  // Get users and find current user
  const users = getUsers();
  const user = users.find(u => normLower(u.email) === activeEmail);
  
  if (!user) {
    Logger.log(`Available users: ${users.map(u => u.email).join(', ')}`);
    throw new Error(`User not found: ${activeEmail}. Please add this user to the Users sheet.`);
  }
  
  if (!user.active) {
    throw new Error(`User is marked as inactive: ${activeEmail}`);
  }

  Logger.log(`User found: ${user.name}`);
  Logger.log(`User HOD: "${user.hod}" (normalized: "${normKey(user.hod)}")`);
  Logger.log(`User Role: ${user.role}`);

  // Load sheets
  Logger.log('Loading sheets...');
  const mgmt = sheetToObjects_(getSheet_(SHEET_MANAGEMENT));
  const merch = sheetToObjects_(getSheet_(SHEET_MERCHANT));
  const billed = sheetToObjects_(getSheet_(SHEET_BILLED));
  const unbilled = sheetToObjects_(getSheet_(SHEET_UNBILLED));

  Logger.log(`Loaded sheets - Management: ${mgmt.length}, Merchant: ${merch.length}, Billed: ${billed.length}, Unbilled: ${unbilled.length}`);

  // If all sheets are empty
  if (mgmt.length === 0 && merch.length === 0 && billed.length === 0 && unbilled.length === 0) {
    Logger.log('WARNING: All data sheets are empty!');
  }

  // Log headers from each sheet
  if (mgmt.length > 0) {
    const mgmtHeaders = Object.keys(mgmt[0]).filter(k => k !== '_rowIndex');
    Logger.log(`Management headers: ${mgmtHeaders.join(' | ')}`);
  }
  
  if (merch.length > 0) {
    const merchHeaders = Object.keys(merch[0]).filter(k => k !== '_rowIndex');
    Logger.log(`Merchant headers: ${merchHeaders.join(' | ')}`);
  }
  
  if (billed.length > 0) {
    const billedHeaders = Object.keys(billed[0]).filter(k => k !== '_rowIndex');
    Logger.log(`Billed headers: ${billedHeaders.join(' | ')}`);
  }
  
  if (unbilled.length > 0) {
    const unbilledHeaders = Object.keys(unbilled[0]).filter(k => k !== '_rowIndex');
    Logger.log(`Unbilled headers: ${unbilledHeaders.join(' | ')}`);
  }

  // Check if user is admin
  const isAdmin = normLower(user.role) === 'admin';
  Logger.log(`Is Admin: ${isAdmin}`);

  // HOD matching function with detailed logging
  function matchesUserHOD(row, sheetName) {
    if (isAdmin) return true;
    
    const rowHOD = norm(getValueByHeader_(row, ['hod', 'hodname', 'hod name', 'head of dept', 'head of department']));
    
    // If user has no HOD set, they see nothing (unless admin)
    if (!user.hod || user.hod === '') {
      if (mgmt.indexOf(row) === 0) {
        Logger.log(`WARNING: User has no HOD set. They will see no data.`);
      }
      return false;
    }
    
    // If row has no HOD, skip it
    if (!rowHOD || rowHOD === '') {
      return false;
    }
    
    const match = normKey(rowHOD) === normKey(user.hod);
    
    // Log first few mismatches for debugging
    if (!match && row._rowIndex <= 3) {
      Logger.log(`[${sheetName}] Row ${row._rowIndex} HOD mismatch: Row="${rowHOD}" (norm:"${normKey(rowHOD)}") vs User="${user.hod}" (norm:"${normKey(user.hod)}")`);
    }
    
    return match;
  }

  // Filter data by HOD
  const management = mgmt.filter(r => matchesUserHOD(r, 'Management')).map(r => ({
    id: r._rowIndex,
    HOD: getValueByHeader_(r, ['hod', 'hodname', 'hod name']),
    merchant: getValueByHeader_(r, ['merchant', 'merchant name', 'merchantname']),
    status: getValueByHeader_(r, ['status']),
    revenue: getValueByHeader_(r, ['revenue', 'amount', 'total']),
    date: getValueByHeader_(r, ['date', 'bill date', 'dt']),
    _rowIndex: r._rowIndex
  }));

  const merchantWise = merch.filter(r => matchesUserHOD(r, 'Merchant')).map(r => {
    // For Expected Date and Remarks, try V/W columns or named columns
    let expectedDate = '';
    let remarks = '';
    
    // Try to find by header name first
    expectedDate = getValueByHeader_(r, ['expected date', 'expecteddate', 'expected_date']);
    remarks = getValueByHeader_(r, ['remarks', 'remark', 'comments']);
    
    // If not found, try V/W columns (assuming they exist)
    if (!expectedDate && r['V']) expectedDate = r['V'];
    if (!remarks && r['W']) remarks = r['W'];
    
    return {
      id: r._rowIndex,
      HOD: getValueByHeader_(r, ['hod', 'hodname', 'hod name']),
      merchant: getValueByHeader_(r, ['merchant', 'merchant name', 'merchantname']),
      amount: getValueByHeader_(r, ['amount', 'amt', 'value']),
      status: getValueByHeader_(r, ['status']),
      expectedDate: expectedDate,
      remarks: remarks,
      _rowIndex: r._rowIndex
    };
  });

  const billedRows = billed.filter(r => matchesUserHOD(r, 'Billed')).map(r => ({
    id: r._rowIndex,
    HOD: getValueByHeader_(r, ['hod', 'hodname', 'hod name']),
    merchant: getValueByHeader_(r, ['merchant', 'merchant name', 'merchantname']),
    invoice: getValueByHeader_(r, ['invoice', 'invoice no', 'invoiceno', 'inv']),
    amount: getValueByHeader_(r, ['amount', 'amt', 'value']),
    date: getValueByHeader_(r, ['date', 'bill date', 'dt']),
    _rowIndex: r._rowIndex
  }));

  const unbilledRows = unbilled.filter(r => matchesUserHOD(r, 'Unbilled')).map(r => ({
    id: r._rowIndex,
    HOD: getValueByHeader_(r, ['hod', 'hodname', 'hod name']),
    merchant: getValueByHeader_(r, ['merchant', 'merchant name', 'merchantname']),
    amount: getValueByHeader_(r, ['amount', 'amt', 'value']),
    pending: getValueByHeader_(r, ['pending', 'pending on', 'pendingon']),
    days: getValueByHeader_(r, ['days', 'days pending', 'dayspending']),
    _rowIndex: r._rowIndex
  }));

  Logger.log(`Filtered results - Management: ${management.length}, Merchant: ${merchantWise.length}, Billed: ${billedRows.length}, Unbilled: ${unbilledRows.length}`);

  // Log sample data for debugging
  if (management.length > 0) {
    Logger.log(`Sample Management row: ${JSON.stringify(management[0])}`);
  }
  if (merchantWise.length > 0) {
    Logger.log(`Sample Merchant row: ${JSON.stringify(merchantWise[0])}`);
  }

  Logger.log('========== END getAllDataForEmail ==========');

  return {
    user: {
      email: user.email,
      name: user.name,
      hod: user.hod,
      role: user.role,
      active: user.active
    },
    data: {
      management: management,
      merchantWise: merchantWise,
      billed: billedRows,
      unbilled: unbilledRows
    },
    editingEnabled: isFortnightWindowOpen_(),
    lastUpdate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
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

/* -------------------- Save to Merchant Sheet -------------------- */
function saveMerchantWiseUpdates(email, updates) {
  Logger.log('========== START saveMerchantWiseUpdates ==========');
  
  const activeEmail = email && norm(email) !== ''
    ? normLower(email)
    : normLower(Session.getActiveUser().getEmail());
    
  const users = getUsers();
  const user = users.find(u => normLower(u.email) === activeEmail && u.active);
  
  if (!user) throw new Error('User not found or inactive.');
  if (!isFortnightWindowOpen_()) throw new Error('Editing window is closed.');

  const sh = getSheet_(SHEET_MERCHANT);
  const data = sh.getDataRange().getValues();
  
  if (!data || data.length === 0) {
    throw new Error('Merchant sheet is empty.');
  }

  const headers = data[0].map(h => String(h || '').trim());
  Logger.log(`Merchant sheet headers: ${headers.join(' | ')}`);

  // Find Expected Date and Remarks columns
  let colExpected = -1;
  let colRemarks = -1;
  
  // Try named headers first
  colExpected = headers.findIndex(h => {
    const nk = normKey(h);
    return nk === 'expecteddate' || nk === 'expected_date' || nk === 'v';
  });
  
  colRemarks = headers.findIndex(h => {
    const nk = normKey(h);
    return nk === 'remarks' || nk === 'remark' || nk === 'w';
  });
  
  // Fallback to V/W columns (21=V, 22=W in 0-based index)
  if (colExpected < 0 && headers.length > 21) colExpected = 21;
  if (colRemarks < 0 && headers.length > 22) colRemarks = 22;

  Logger.log(`Expected Date column index: ${colExpected}, Remarks column index: ${colRemarks}`);

  if (colExpected < 0 || colRemarks < 0) {
    throw new Error('Could not find Expected Date or Remarks columns in Merchant sheet.');
  }

  // Find HOD column
  const hodIdx = headers.findIndex(h => {
    const nk = normKey(h);
    return nk === 'hod' || nk === 'hodname';
  });
  
  Logger.log(`HOD column index: ${hodIdx}`);

  const isAdmin = normLower(user.role) === 'admin';
  let count = 0;

  for (const rowKey in updates) {
    const rowIndex = parseInt(rowKey, 10);
    if (!rowIndex || rowIndex <= 1 || rowIndex > data.length) continue;

    // Check HOD ownership
    if (!isAdmin && hodIdx >= 0) {
      const rowHOD = data[rowIndex - 1][hodIdx];
      if (normKey(rowHOD) !== normKey(user.hod)) {
        Logger.log(`Skipping row ${rowIndex} - HOD mismatch`);
        continue;
      }
    }

    const upd = updates[rowKey];
    
    if (upd.expectedDate !== undefined) {
      data[rowIndex - 1][colExpected] = upd.expectedDate;
      Logger.log(`Row ${rowIndex}: Setting Expected Date to "${upd.expectedDate}"`);
    }
    
    if (upd.remarks !== undefined) {
      data[rowIndex - 1][colRemarks] = upd.remarks;
      Logger.log(`Row ${rowIndex}: Setting Remarks to "${upd.remarks}"`);
    }

    sh.getRange(rowIndex, 1, 1, headers.length).setValues([data[rowIndex - 1]]);
    count++;
  }

  Logger.log(`Updated ${count} rows`);
  Logger.log('========== END saveMerchantWiseUpdates ==========');

  return { 
    updated: count, 
    at: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
}

/* -------------------- Refresh -------------------- */
function refreshNow() {
  return { 
    lastUpdate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
}

/* -------------------- Debug Functions -------------------- */
function debugUsers() {
  const users = getUsers();
  Logger.log('=== ALL USERS ===');
  users.forEach(u => {
    Logger.log(`Email: ${u.email}, Name: ${u.name}, HOD: "${u.hod}", Role: ${u.role}, Active: ${u.active}`);
  });
}

function debugSheetHeaders() {
  Logger.log('=== SHEET HEADERS ===');
  
  try {
    const mgmt = sheetToObjects_(getSheet_(SHEET_MANAGEMENT));
    if (mgmt.length > 0) {
      Logger.log(`Management View: ${Object.keys(mgmt[0]).filter(k => k !== '_rowIndex').join(' | ')}`);
    }
  } catch (e) {
    Logger.log(`Management View: ERROR - ${e.message}`);
  }
  
  try {
    const merch = sheetToObjects_(getSheet_(SHEET_MERCHANT));
    if (merch.length > 0) {
      Logger.log(`Merchant_wise_Final: ${Object.keys(merch[0]).filter(k => k !== '_rowIndex').join(' | ')}`);
    }
  } catch (e) {
    Logger.log(`Merchant_wise_Final: ERROR - ${e.message}`);
  }
  
  try {
    const billed = sheetToObjects_(getSheet_(SHEET_BILLED));
    if (billed.length > 0) {
      Logger.log(`Billed Detailed: ${Object.keys(billed[0]).filter(k => k !== '_rowIndex').join(' | ')}`);
    }
  } catch (e) {
    Logger.log(`Billed Detailed: ERROR - ${e.message}`);
  }
  
  try {
    const unbilled = sheetToObjects_(getSheet_(SHEET_UNBILLED));
    if (unbilled.length > 0) {
      Logger.log(`Unbilled Detailed: ${Object.keys(unbilled[0]).filter(k => k !== '_rowIndex').join(' | ')}`);
    }
  } catch (e) {
    Logger.log(`Unbilled Detailed: ERROR - ${e.message}`);
  }
}

function testUserData() {
  Logger.log('===================================');
  Logger.log('TESTING USER DATA LOADING');
  Logger.log('===================================');
  
  try {
    const result = getAllDataForEmail('');
    Logger.log('');
    Logger.log('=== RESULT SUMMARY ===');
    Logger.log(`User: ${result.user.name} (${result.user.email})`);
    Logger.log(`HOD: ${result.user.hod}`);
    Logger.log(`Role: ${result.user.role}`);
    Logger.log(`Management rows: ${result.data.management.length}`);
    Logger.log(`Merchant rows: ${result.data.merchantWise.length}`);
    Logger.log(`Billed rows: ${result.data.billed.length}`);
    Logger.log(`Unbilled rows: ${result.data.unbilled.length}`);
    Logger.log('');
    Logger.log('SUCCESS! Check the logs above for details.');
  } catch (e) {
    Logger.log('');
    Logger.log('=== ERROR ===');
    Logger.log(e.toString());
    Logger.log('');
    Logger.log('Stack trace:');
    Logger.log(e.stack);
  }
}

function debugEverything() {
  Logger.log('========================================');
  Logger.log('COMPLETE DEBUG - ALL INFORMATION');
  Logger.log('========================================');
  Logger.log('');
  
  debugUsers();
  Logger.log('');
  debugSheetHeaders();
  Logger.log('');
  testUserData();
}
