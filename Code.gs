/**
 * RA Team Dashboard - SIMPLIFIED & ROBUST VERSION
 * This version prioritizes showing data over strict filtering
 */

// ============= CONFIGURATION =============
const SHEET_ID = '1bmJFhR-RbYtSf6g3LKi-nj2piSUV9csmm3fuuB0XQYU';

// Sheet names - UPDATE THESE if your sheet names are different
const SHEET_NAMES = {
  users: 'users',                    // or 'Users'
  management: 'Management View',
  merchant: 'Merchant_wise_Final',
  billed: 'Billed Detailed',
  unbilled: 'Unbilled Detailed'
};

// ============= WEB APP ENTRY POINT =============
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('RA Team Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============= HELPER FUNCTIONS =============
function log_(message) {
  Logger.log(message);
  console.log(message);
}

function getSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    throw new Error('Cannot open spreadsheet. Check SHEET_ID: ' + SHEET_ID);
  }
}

function getSheetByName_(name) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  
  // Try case-insensitive match
  if (!sheet) {
    const sheets = ss.getSheets();
    for (const s of sheets) {
      if (s.getName().toLowerCase() === name.toLowerCase()) {
        sheet = s;
        break;
      }
    }
  }
  
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found. Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`);
  }
  
  return sheet;
}

function normalize_(text) {
  if (text === null || text === undefined) return '';
  return String(text).trim();
}

function normalizeLower_(text) {
  return normalize_(text).toLowerCase();
}

function normalizeKey_(text) {
  // Remove all spaces, dots, underscores, hyphens
  return normalizeLower_(text).replace(/[\s._\-]+/g, '');
}

function sheetToJSON_(sheetName) {
  log_(`Loading sheet: ${sheetName}`);
  
  try {
    const sheet = getSheetByName_(sheetName);
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length === 0) {
      log_(`  - Sheet is empty`);
      return [];
    }
    
    log_(`  - Found ${data.length - 1} data rows (plus header)`);
    
    const headers = data[0];
    const rows = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = { __rowNumber: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        const header = normalize_(headers[j]);
        if (header) {
          row[header] = data[i][j];
        }
      }
      rows.push(row);
    }
    
    return rows;
    
  } catch (e) {
    log_(`  - ERROR loading sheet: ${e.message}`);
    return [];
  }
}

function findColumn_(row, possibleNames) {
  if (!row) return null;
  
  const keys = Object.keys(row);
  
  // Try exact match first
  for (const name of possibleNames) {
    if (keys.includes(name)) {
      return name;
    }
  }
  
  // Try case-insensitive match
  const lowerPossibleNames = possibleNames.map(n => normalizeLower_(n));
  for (const key of keys) {
    if (lowerPossibleNames.includes(normalizeLower_(key))) {
      return key;
    }
  }
  
  // Try partial match (normalized)
  const normalizedPossible = possibleNames.map(n => normalizeKey_(n));
  for (const key of keys) {
    const normalizedKey = normalizeKey_(key);
    if (normalizedPossible.includes(normalizedKey)) {
      return key;
    }
  }
  
  return null;
}

function getColumnValue_(row, possibleNames, defaultValue = '') {
  const column = findColumn_(row, possibleNames);
  if (column && row[column] !== undefined && row[column] !== null) {
    return row[column];
  }
  return defaultValue;
}

// ============= USER MANAGEMENT =============
function getCurrentUserEmail_() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (email) return normalizeLower_(email);
  } catch (e) {
    log_('Cannot get active user email: ' + e.message);
  }
  return null;
}

function loadUsers_() {
  log_('Loading users...');
  
  const rows = sheetToJSON_(SHEET_NAMES.users);
  if (rows.length === 0) {
    log_('  - WARNING: Users sheet is empty!');
    return [];
  }
  
  log_(`  - Sample row keys: ${Object.keys(rows[0]).join(', ')}`);
  
  const users = rows.map(row => {
    const email = normalize_(getColumnValue_(row, ['Email', 'email', 'E-mail', 'Mail']));
    const name = normalize_(getColumnValue_(row, ['Name', 'name', 'Full Name', 'Username']));
    const hod = normalize_(getColumnValue_(row, ['HOD', 'hod', 'HOD Name', 'Head of Department']));
    const role = normalize_(getColumnValue_(row, ['Role', 'role', 'User Role'], 'User'));
    const activeValue = getColumnValue_(row, ['Active', 'active', 'Enabled', 'Status']);
    
    let active = true;
    if (activeValue !== '') {
      const activeStr = normalizeLower_(activeValue);
      active = activeStr === 'true' || activeStr === 'yes' || activeStr === '1' || activeStr === 'active';
    }
    
    return { email: normalizeLower_(email), name, hod, role, active };
  }).filter(u => u.email);
  
  log_(`  - Loaded ${users.length} valid users`);
  return users;
}

function findUser_(email) {
  const users = loadUsers_();
  
  if (!email) {
    log_('  - No email provided, trying to get current user');
    email = getCurrentUserEmail_();
  }
  
  if (!email) {
    log_('  - Still no email, returning null');
    return null;
  }
  
  email = normalizeLower_(email);
  log_(`  - Looking for user: ${email}`);
  
  const user = users.find(u => u.email === email);
  
  if (user) {
    log_(`  - Found user: ${user.name}, HOD: "${user.hod}", Role: ${user.role}, Active: ${user.active}`);
  } else {
    log_(`  - User not found in users sheet`);
    log_(`  - Available emails: ${users.map(u => u.email).join(', ')}`);
  }
  
  return user;
}

// ============= DATA FILTERING =============
function filterByHOD_(rows, userHOD, isAdmin, sheetName) {
  if (!rows || rows.length === 0) return [];
  
  log_(`Filtering ${sheetName} by HOD...`);
  log_(`  - Total rows: ${rows.length}`);
  log_(`  - User HOD: "${userHOD}" (normalized: "${normalizeKey_(userHOD)}")`);
  log_(`  - Is Admin: ${isAdmin}`);
  
  // If admin, return all rows
  if (isAdmin) {
    log_(`  - Admin user, returning all ${rows.length} rows`);
    return rows;
  }
  
  // If user has no HOD, return all rows (fallback)
  if (!userHOD || userHOD === '') {
    log_(`  - WARNING: User has no HOD set, returning all rows as fallback`);
    return rows;
  }
  
  // Find HOD column
  const hodColumn = findColumn_(rows[0], ['HOD', 'hod', 'HOD Name', 'Head of Department', 'Head of Dept']);
  
  if (!hodColumn) {
    log_(`  - WARNING: No HOD column found in sheet, returning all rows as fallback`);
    log_(`  - Available columns: ${Object.keys(rows[0]).filter(k => !k.startsWith('__')).join(', ')}`);
    return rows;
  }
  
  log_(`  - HOD column found: "${hodColumn}"`);
  
  const userHODNormalized = normalizeKey_(userHOD);
  const filtered = rows.filter(row => {
    const rowHOD = normalize_(row[hodColumn]);
    
    if (!rowHOD || rowHOD === '') return false;
    
    const rowHODNormalized = normalizeKey_(rowHOD);
    return rowHODNormalized === userHODNormalized;
  });
  
  log_(`  - Filtered result: ${filtered.length} rows match`);
  
  // Log first mismatch for debugging
  if (filtered.length === 0 && rows.length > 0) {
    const firstRowHOD = normalize_(rows[0][hodColumn]);
    log_(`  - Sample row HOD: "${firstRowHOD}" (normalized: "${normalizeKey_(firstRowHOD)}")`);
    log_(`  - This does NOT match user HOD: "${userHOD}" (normalized: "${userHODNormalized}")`);
  }
  
  // If no matches but user is not admin, still return all as fallback
  if (filtered.length === 0) {
    log_(`  - WARNING: No rows match HOD, returning all rows as fallback`);
    return rows;
  }
  
  return filtered;
}

function mapManagementData_(rows) {
  return rows.map(r => ({
    id: r.__rowNumber,
    HOD: normalize_(getColumnValue_(r, ['HOD', 'hod', 'HOD Name'])),
    merchant: normalize_(getColumnValue_(r, ['Merchant', 'merchant', 'Merchant Name', 'Merchant_Name'])),
    status: normalize_(getColumnValue_(r, ['Status', 'status'])),
    revenue: getColumnValue_(r, ['Revenue', 'revenue', 'Amount', 'Total'], 0),
    date: getColumnValue_(r, ['Date', 'date', 'Bill Date'], ''),
    _rowIndex: r.__rowNumber
  }));
}

function mapMerchantData_(rows) {
  return rows.map(r => ({
    id: r.__rowNumber,
    HOD: normalize_(getColumnValue_(r, ['HOD', 'hod', 'HOD Name'])),
    merchant: normalize_(getColumnValue_(r, ['Merchant', 'merchant', 'Merchant Name', 'Merchant_Name'])),
    amount: getColumnValue_(r, ['Amount', 'amount', 'Amt'], 0),
    status: normalize_(getColumnValue_(r, ['Status', 'status'])),
    expectedDate: getColumnValue_(r, ['Expected Date', 'expected_date', 'ExpectedDate', 'V'], ''),
    remarks: getColumnValue_(r, ['Remarks', 'remarks', 'Remark', 'W'], ''),
    _rowIndex: r.__rowNumber
  }));
}

function mapBilledData_(rows) {
  return rows.map(r => ({
    id: r.__rowNumber,
    HOD: normalize_(getColumnValue_(r, ['HOD', 'hod', 'HOD Name'])),
    merchant: normalize_(getColumnValue_(r, ['Merchant', 'merchant', 'Merchant Name', 'Merchant_Name'])),
    invoice: normalize_(getColumnValue_(r, ['Invoice', 'invoice', 'Invoice No', 'Invoice_No'])),
    amount: getColumnValue_(r, ['Amount', 'amount', 'Amt'], 0),
    date: getColumnValue_(r, ['Date', 'date', 'Bill Date'], ''),
    _rowIndex: r.__rowNumber
  }));
}

function mapUnbilledData_(rows) {
  return rows.map(r => ({
    id: r.__rowNumber,
    HOD: normalize_(getColumnValue_(r, ['HOD', 'hod', 'HOD Name'])),
    merchant: normalize_(getColumnValue_(r, ['Merchant', 'merchant', 'Merchant Name', 'Merchant_Name'])),
    amount: getColumnValue_(r, ['Amount', 'amount', 'Amt'], 0),
    pending: normalize_(getColumnValue_(r, ['Pending', 'pending', 'Pending On'])),
    days: getColumnValue_(r, ['Days', 'days', 'Days Pending'], ''),
    _rowIndex: r.__rowNumber
  }));
}

// ============= MAIN API =============
function getAllDataForEmail(email) {
  log_('========================================');
  log_('GET ALL DATA FOR EMAIL');
  log_('========================================');
  
  try {
    // Get user
    const user = findUser_(email);
    
    if (!user) {
      throw new Error('User not found. Please ensure your email is added to the Users sheet.');
    }
    
    if (!user.active) {
      throw new Error('Your account is marked as inactive. Please contact administrator.');
    }
    
    const isAdmin = normalizeLower_(user.role) === 'admin';
    
    // Load all sheets
    log_('');
    const mgmtRows = sheetToJSON_(SHEET_NAMES.management);
    const merchRows = sheetToJSON_(SHEET_NAMES.merchant);
    const billedRows = sheetToJSON_(SHEET_NAMES.billed);
    const unbilledRows = sheetToJSON_(SHEET_NAMES.unbilled);
    
    log_('');
    log_('Raw data loaded:');
    log_(`  Management: ${mgmtRows.length} rows`);
    log_(`  Merchant: ${merchRows.length} rows`);
    log_(`  Billed: ${billedRows.length} rows`);
    log_(`  Unbilled: ${unbilledRows.length} rows`);
    
    // Filter by HOD
    log_('');
    const mgmtFiltered = filterByHOD_(mgmtRows, user.hod, isAdmin, 'Management');
    const merchFiltered = filterByHOD_(merchRows, user.hod, isAdmin, 'Merchant');
    const billedFiltered = filterByHOD_(billedRows, user.hod, isAdmin, 'Billed');
    const unbilledFiltered = filterByHOD_(unbilledRows, user.hod, isAdmin, 'Unbilled');
    
    // Map to display format
    const management = mapManagementData_(mgmtFiltered);
    const merchantWise = mapMerchantData_(merchFiltered);
    const billed = mapBilledData_(billedFiltered);
    const unbilled = mapUnbilledData_(unbilledFiltered);
    
    log_('');
    log_('Final results:');
    log_(`  Management: ${management.length} rows`);
    log_(`  Merchant: ${merchantWise.length} rows`);
    log_(`  Billed: ${billed.length} rows`);
    log_(`  Unbilled: ${unbilled.length} rows`);
    
    // Check if editing window is open (days 1-5 or 16-20 of month)
    const today = new Date();
    const day = parseInt(Utilities.formatDate(today, 'Asia/Kolkata', 'd'), 10);
    const editingEnabled = (day >= 1 && day <= 5) || (day >= 16 && day <= 20);
    
    log_(`  Editing window: ${editingEnabled ? 'OPEN' : 'CLOSED'} (day ${day})`);
    log_('========================================');
    
    return {
      success: true,
      user: {
        email: user.email,
        name: user.name,
        hod: user.hod,
        role: user.role
      },
      data: {
        management: management,
        merchantWise: merchantWise,
        billed: billed,
        unbilled: unbilled
      },
      editingEnabled: editingEnabled,
      lastUpdate: Utilities.formatDate(today, 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss'),
      debug: {
        totalRows: {
          management: mgmtRows.length,
          merchantWise: merchRows.length,
          billed: billedRows.length,
          unbilled: unbilledRows.length
        },
        filteredRows: {
          management: management.length,
          merchantWise: merchantWise.length,
          billed: billed.length,
          unbilled: unbilled.length
        }
      }
    };
    
  } catch (error) {
    log_('ERROR: ' + error.message);
    log_('Stack: ' + error.stack);
    throw error;
  }
}

// ============= SAVE UPDATES =============
function saveMerchantWiseUpdates(email, updates) {
  log_('========================================');
  log_('SAVE MERCHANT WISE UPDATES');
  log_('========================================');
  
  try {
    const user = findUser_(email);
    if (!user || !user.active) {
      throw new Error('User not found or inactive');
    }
    
    // Check editing window
    const day = parseInt(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd'), 10);
    const editingEnabled = (day >= 1 && day <= 5) || (day >= 16 && day <= 20);
    
    if (!editingEnabled) {
      throw new Error('Editing window is closed. You can only edit during days 1-5 or 16-20 of the month.');
    }
    
    const sheet = getSheetByName_(SHEET_NAMES.merchant);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    log_(`Headers: ${headers.join(' | ')}`);
    
    // Find columns
    const expectedDateCol = findColumn_({ headers }, ['Expected Date', 'expected_date', 'ExpectedDate', 'V']) || 'V';
    const remarksCol = findColumn_({ headers }, ['Remarks', 'remarks', 'Remark', 'W']) || 'W';
    
    let colExpected = headers.indexOf(expectedDateCol);
    let colRemarks = headers.indexOf(remarksCol);
    
    // Fallback to V/W columns (21, 22 in 0-indexed)
    if (colExpected < 0) colExpected = 21;
    if (colRemarks < 0) colRemarks = 22;
    
    log_(`Expected Date column index: ${colExpected}`);
    log_(`Remarks column index: ${colRemarks}`);
    
    const isAdmin = normalizeLower_(user.role) === 'admin';
    const hodColumn = findColumn_({ headers }, ['HOD', 'hod', 'HOD Name']);
    const hodIdx = hodColumn ? headers.indexOf(hodColumn) : -1;
    
    let updateCount = 0;
    
    for (const rowKey in updates) {
      const rowNum = parseInt(rowKey, 10);
      if (!rowNum || rowNum < 2 || rowNum > data.length) continue;
      
      const rowIdx = rowNum - 1;
      
      // Check HOD permission
      if (!isAdmin && hodIdx >= 0) {
        const rowHOD = normalize_(data[rowIdx][hodIdx]);
        if (normalizeKey_(rowHOD) !== normalizeKey_(user.hod)) {
          log_(`  Skipping row ${rowNum} - HOD mismatch`);
          continue;
        }
      }
      
      const upd = updates[rowKey];
      
      if (upd.expectedDate !== undefined) {
        data[rowIdx][colExpected] = upd.expectedDate;
      }
      
      if (upd.remarks !== undefined) {
        data[rowIdx][colRemarks] = upd.remarks;
      }
      
      sheet.getRange(rowNum, 1, 1, headers.length).setValues([data[rowIdx]]);
      updateCount++;
      log_(`  Updated row ${rowNum}`);
    }
    
    log_(`Total updated: ${updateCount} rows`);
    log_('========================================');
    
    return {
      success: true,
      updated: updateCount,
      at: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss')
    };
    
  } catch (error) {
    log_('ERROR: ' + error.message);
    throw error;
  }
}

// ============= REFRESH =============
function refreshNow() {
  return {
    success: true,
    lastUpdate: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss')
  };
}

// ============= DEBUG & TEST FUNCTIONS =============
function testConnection() {
  log_('========================================');
  log_('TEST CONNECTION');
  log_('========================================');
  
  try {
    const ss = getSpreadsheet_();
    log_('✓ Connected to spreadsheet: ' + ss.getName());
    log_('');
    
    log_('Available sheets:');
    ss.getSheets().forEach(s => log_(`  - ${s.getName()}`));
    log_('');
    
    log_('Configured sheet names:');
    for (const key in SHEET_NAMES) {
      log_(`  ${key}: "${SHEET_NAMES[key]}"`);
    }
    
    log_('========================================');
    log_('Connection test PASSED');
    
  } catch (error) {
    log_('Connection test FAILED: ' + error.message);
  }
}

function testDataLoad() {
  log_('========================================');
  log_('TEST DATA LOAD');
  log_('========================================');
  
  log_('Loading all sheets...');
  log_('');
  
  for (const key in SHEET_NAMES) {
    if (key === 'users') continue;
    const rows = sheetToJSON_(SHEET_NAMES[key]);
    if (rows.length > 0) {
      log_(`Sample columns from ${SHEET_NAMES[key]}:`);
      log_(`  ${Object.keys(rows[0]).filter(k => !k.startsWith('__')).join(' | ')}`);
      log_('');
    }
  }
  
  log_('========================================');
}

function testFullFlow() {
  log_('========================================');
  log_('TEST FULL FLOW');
  log_('========================================');
  
  try {
    const result = getAllDataForEmail('');
    log_('');
    log_('RESULT:');
    log_(`  User: ${result.user.name} (${result.user.email})`);
    log_(`  HOD: ${result.user.hod}`);
    log_(`  Role: ${result.user.role}`);
    log_(`  Management rows: ${result.data.management.length}`);
    log_(`  Merchant rows: ${result.data.merchantWise.length}`);
    log_(`  Billed rows: ${result.data.billed.length}`);
    log_(`  Unbilled rows: ${result.data.unbilled.length}`);
    log_('');
    log_('========================================');
    log_('✓ FULL FLOW TEST PASSED');
    
  } catch (error) {
    log_('✗ FULL FLOW TEST FAILED');
    log_('Error: ' + error.message);
    log_('Stack: ' + error.stack);
  }
}

function runAllTests() {
  testConnection();
  log_('');
  testDataLoad();
  log_('');
  testFullFlow();
}
