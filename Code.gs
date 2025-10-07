/**
 * RA Team Dashboard – SMART HEADER ROW + FUZZY HOD + USED RANGE
 * Fix for sheets where real headers are on row 2/3 (or below a title row).
 * IMPROVED DATA RETRIEVAL: More permissive HOD matching + better debugging
 */

const SHEET_ID        = '1bmJFhR-RbYtSf6g3LKi-nj2piSUV9csmm3fuuB0XQYU';
const WANT_MANAGEMENT = 'Management View';
const WANT_MERCHANT   = 'Merchant_wise_Final';
const WANT_BILLED     = 'Billed Detailed';
const WANT_UNBILLED   = 'Unbilled Detailed';
const WANT_USERS      = 'users';

/* -------------------- Web App -------------------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('RA Team Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* -------------------- Helpers -------------------- */
function getSS_() { return SpreadsheetApp.openById(SHEET_ID); }
function nrmName_(s){ return String(s||'').toLowerCase().replace(/[\s_\-\/]+/g,''); }
function norm(s){ return String(s||'').trim(); }
function normLower(s){ return norm(s).toLowerCase(); }
function normKey(s){ return normLower(s).replace(/[\s._\-\/()]+/g,''); }
function tokenKey(s){ return normLower(s).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }

function findSheetLoose_(want) {
  const ss = getSS_();
  const aim = nrmName_(want);
  const sheets = ss.getSheets();
  for (const sh of sheets) if (nrmName_(sh.getName()) === aim) return sh;
  for (const sh of sheets) {
    const nm = nrmName_(sh.getName());
    if (nm.includes(aim) || aim.includes(nm)) return sh;
  }
  return null;
}

function findHeaderInList_(headers, candidates) {
  if (!headers || !headers.length) return null;
  const wants = candidates.map(normKey);
  for (const h of headers) if (wants.includes(normKey(h))) return h; // exact
  for (const h of headers) {
    const hk = normKey(h);
    for (const w of wants) if (hk.includes(w) || w.includes(hk)) return h; // loose
  }
  return null;
}
function findHodHeader_(headers) {
  return findHeaderInList_(headers, [
    'hod','hod name','hodname','head of dept','head of department','owner hod','ra hod','hod_assigned','hod (owner)'
  ]) || headers.find(h => normKey(h).includes('hod')) || null;
}

/** Guess which row is the real header row (scan top 10 rows) */
function detectHeaderRow_(values) {
  const scan = Math.min(10, values.length);
  let bestIdx = 0, bestScore = -1;

  for (let i = 0; i < scan; i++) {
    const row = values[i] || [];
    const raw = row.map(x => String(x || '').trim());
    const nonEmpty = raw.filter(x => x !== '').length;

    // Build a score: prefer rows w/ many filled cells and HOD/merchant-ish labels
    const hodCandidate = findHodHeader_(raw) ? 12 : 0;
    const merchantish = findHeaderInList_(raw, ['merchant','merchant name','merchantname']) ? 4 : 0;
    const amountish   = findHeaderInList_(raw, ['amount','amt','value','revenue']) ? 2 : 0;
    const statusish   = findHeaderInList_(raw, ['status']) ? 1 : 0;

    const score = nonEmpty + hodCandidate + merchantish + amountish + statusish;

    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx; // 0-based index into values
}

/** Read used range; auto-detect header row; de-dup header names; return rows beneath it. */
function readSheetSmart_(sh) {
  if (!sh) return { name:'', headers:[], rows:[], hodHeader:null, headerRow:0, totalRows:0, filteredRows:0 };
  const name = sh.getName();
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (!lr || !lc) return { name, headers:[], rows:[], hodHeader:null, headerRow:0, totalRows:0, filteredRows:0 };

  const values = sh.getRange(1,1,lr,lc).getValues();
  if (!values || values.length === 0) return { name, headers:[], rows:[], hodHeader:null, headerRow:0, totalRows:0, filteredRows:0 };

  const headerRowIdx = detectHeaderRow_(values); // 0-based
  const rawHeaders = (values[headerRowIdx] || []).map(h => String(h || '').trim());

  // De-dupe headers (and fill blanks)
  const seen = {};
  const headers = rawHeaders.map((h, i) => {
    const base = h || `Column ${i+1}`;
    if (!seen[base]) { seen[base] = 1; return base; }
    seen[base] += 1; return `${base} (${seen[base]})`;
  });

  const rows = [];
  for (let r = headerRowIdx + 1; r < values.length; r++) {
    const row = { _rowIndex: r + 1 }; // keep 1-based row index
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = values[r][c];
    }
    rows.push(row);
  }

  return { 
    name, 
    headers, 
    rows, 
    hodHeader: findHodHeader_(headers), 
    headerRow: headerRowIdx + 1, // headerRow 1-based for humans
    totalRows: rows.length,
    filteredRows: 0 // will be set after filtering
  }; 
}

function asBool(v){ if (v===true||v===false) return v; const s=normLower(v); return s==='true'||s==='yes'||s==='1'||s==='active'; }
function isFortnightWindowOpen_(){ const d=parseInt(Utilities.formatDate(new Date(),'Asia/Kolkata','d'),10); return (d>=1&&d<=5)||(d>=16&&d<=20); }

/* -------------------- Users -------------------- */
function findUsersSheet_() {
  // try loose name first
  let sh = findSheetLoose_(WANT_USERS);
  if (sh) return sh;

  // else any sheet with Email + HOD headers (within top rows)
  const sheets = getSS_().getSheets();
  for (const s of sheets) {
    const lr = s.getLastRow(), lc = s.getLastColumn();
    if (!lr || !lc) continue;
    const vals = s.getRange(1,1,Math.min(lr,5), lc).getValues(); // peek top 5 rows
    const hdrIdx = detectHeaderRow_(vals);
    const hdrs = (vals[hdrIdx] || []).map(x => String(x||'').trim());
    const hasEmail = !!findHeaderInList_(hdrs, ['email','mail','e-mail']);
    const hasHod   = !!findHodHeader_(hdrs);
    if (hasEmail && hasHod) return s;
  }
  return null;
}

function getUsers_() {
  const sh = findUsersSheet_();
  if (!sh) throw new Error('Users sheet not found. Add a sheet with Email & HOD columns.');

  const r = readSheetSmart_(sh);
  const hEmail = findHeaderInList_(r.headers, ['email','mail','e-mail']);
  const hName  = findHeaderInList_(r.headers, ['name','username','full name','fullname']);
  const hHOD   = r.hodHeader;
  const hRole  = findHeaderInList_(r.headers, ['role','user role']);
  const hAct   = findHeaderInList_(r.headers, ['active','enabled','status']);

  return r.rows.map(row => ({
    email: norm(hEmail ? row[hEmail] : ''),
    name : norm(hName  ? row[hName]  : ''),
    hod  : norm(hHOD   ? row[hHOD]   : ''),
    role : norm(hRole  ? row[hRole]  : 'User'),
    active: hAct ? (row[hAct] === '' ? true : asBool(row[hAct])) : true
  })).filter(u => u.email);
}

function resolveActiveEmail_(explicitEmail) {
  const e = normLower(explicitEmail || '');
  if (e) return e;
  const s = (Session.getActiveUser && Session.getActiveUser().getEmail) ? normLower(Session.getActiveUser().getEmail()) : '';
  if (s) return s;
  const first = getUsers_().find(u => u.active);
  if (first) return normLower(first.email);
  throw new Error('No active users and Session email is empty.');
}

/* -------------------- HOD matching - IMPROVED FOR PERMISSIVE FILTERING -------------------- */
function makeHodMatcher_(user, hodHeader) {
  const isAdmin = normLower(user.role) === 'admin';
  const tok = tokenKey(user.hod);
  const allowAll = isAdmin || tok === '' || tok === 'all';
  
  return function(row) {
    // Admins and users with empty/ALL HOD see everything
    if (allowAll) return true;
    
    // If sheet has no HOD column, only admins see data (restrictive for security)
    if (!hodHeader) return false;
    
    // IMPROVED: If row's HOD is empty/null, allow it (treat as unassigned/public data)
    const rowHodValue = row[hodHeader];
    if (rowHodValue === null || rowHodValue === undefined || String(rowHodValue).trim() === '') {
      return true; // PERMISSIVE: empty HOD rows are visible to all
    }
    
    const rTok = tokenKey(rowHodValue);
    if (!rTok) return true; // PERMISSIVE: if tokenization results in empty, show it
    
    // Check if HOD matches (exact, contains, or is contained)
    return rTok === tok || rTok.includes(tok) || tok.includes(rTok);
  };
}

/* -------------------- API (always returns a payload) -------------------- */
function getAllDataForEmail(email) {
  try {
    const users = getUsers_();
    const activeEmail = resolveActiveEmail_(email);
    const user = users.find(u => normLower(u.email) === activeEmail);
    if (!user) throw new Error('User not in Users sheet: ' + activeEmail);
    if (!user.active) throw new Error('User is inactive: ' + activeEmail);

    // Read all four tabs (smart header detection)
    const shMgmt  = findSheetLoose_(WANT_MANAGEMENT);
    const shMerch = findSheetLoose_(WANT_MERCHANT);
    const shBill  = findSheetLoose_(WANT_BILLED);
    const shUnb   = findSheetLoose_(WANT_UNBILLED);

    const mgmt     = readSheetSmart_(shMgmt);
    const merchRaw = readSheetSmart_(shMerch);
    const billed   = readSheetSmart_(shBill);
    const unbilled = readSheetSmart_(shUnb);

    const matchMgmt     = makeHodMatcher_(user, mgmt.hodHeader);
    const matchMerch    = makeHodMatcher_(user, merchRaw.hodHeader);
    const matchBilled   = makeHodMatcher_(user, billed.hodHeader);
    const matchUnbilled = makeHodMatcher_(user, unbilled.hodHeader);

    // Merchant editable V/W (or named) detection
    let expectedKey = findHeaderInList_(merchRaw.headers, ['expected date','expected_date','expecteddate','v']);
    let remarksKey  = findHeaderInList_(merchRaw.headers, ['remarks','remark','comments','w']);
    if (!expectedKey && merchRaw.headers.length > 21) expectedKey = merchRaw.headers[21]; // V (0-based 21)
    if (!remarksKey  && merchRaw.headers.length > 22) remarksKey  = merchRaw.headers[22]; // W (0-based 22)

    const management = mgmt.rows.filter(matchMgmt).map(r => ({ id: r._rowIndex, ...r }));
    const merchantWise = merchRaw.rows.filter(matchMerch).map(r => {
      const o = { id: r._rowIndex, ...r };
      o.expectedDate = expectedKey ? r[expectedKey] : '';
      o.remarks      = remarksKey  ? r[remarksKey]  : '';
      return o;
    });
    const billedRows   = billed.rows.filter(matchBilled).map(r => ({ id: r._rowIndex, ...r }));
    const unbilledRows = unbilled.rows.filter(matchUnbilled).map(r => ({ id: r._rowIndex, ...r }));

    // Update filtered counts for debugging
    mgmt.filteredRows = management.length;
    merchRaw.filteredRows = merchantWise.length;
    billed.filteredRows = billedRows.length;
    unbilled.filteredRows = unbilledRows.length;

    return {
      error: false,
      user,
      data: { management, merchantWise, billed: billedRows, unbilled: unbilledRows },
      meta: {
        managementHeaders: mgmt.headers,
        merchantHeaders: merchRaw.headers,
        billedHeaders: billed.headers,
        unbilledHeaders: unbilled.headers,
        merchantExpectedKey: expectedKey || '',
        merchantRemarksKey : remarksKey  || '',
        hodHeaders: {
          management: mgmt.hodHeader || '',
          merchant  : merchRaw.hodHeader || '',
          billed    : billed.hodHeader || '',
          unbilled  : unbilled.hodHeader || ''
        },
        sheetsFound: {
          [WANT_MANAGEMENT]: shMgmt ? shMgmt.getName() : 'NOT FOUND',
          [WANT_MERCHANT]  : shMerch ? shMerch.getName() : 'NOT FOUND',
          [WANT_BILLED]    : shBill ? shBill.getName() : 'NOT FOUND',
          [WANT_UNBILLED]  : shUnb ? shUnb.getName() : 'NOT FOUND'
        },
        headerRow: {
          management: mgmt.headerRow,
          merchant  : merchRaw.headerRow,
          billed    : billed.headerRow,
          unbilled  : unbilled.headerRow
        },
        // DEBUG INFO
        debug: {
          management: { total: mgmt.totalRows, filtered: mgmt.filteredRows },
          merchant:   { total: merchRaw.totalRows, filtered: merchRaw.filteredRows },
          billed:     { total: billed.totalRows, filtered: billed.filteredRows },
          unbilled:   { total: unbilled.totalRows, filtered: unbilled.filteredRows },
          userHod: user.hod,
          userRole: user.role
        }
      },
      editingEnabled: isFortnightWindowOpen_(),
      lastUpdate: new Date().toLocaleString('en-IN',{ timeZone:'Asia/Kolkata' })
    };
  } catch (e) {
    return {
      error: true,
      message: String(e && e.message ? e.message : e),
      user: { email:'', name:'', hod:'', role:'', active:false },
      data: { management:[], merchantWise:[], billed:[], unbilled:[] },
      meta: { managementHeaders:[], merchantHeaders:[], billedHeaders:[], unbilledHeaders:[], merchantExpectedKey:'', merchantRemarksKey:'', hodHeaders:{}, sheetsFound:{}, headerRow:{}, debug:{} },
      editingEnabled: false,
      lastUpdate: new Date().toLocaleString('en-IN',{ timeZone:'Asia/Kolkata' })
    };
  }
}

/* -------------------- Save back to Merchant_wise_Final -------------------- */
function saveMerchantWiseUpdates(email, updates) {
  try {
    const users = getUsers_();
    const me = users.find(u => normLower(u.email) === resolveActiveEmail_(email) && u.active);
    if (!me) throw new Error('User not found or inactive.');
    if (!isFortnightWindowOpen_()) throw new Error('Editing window is closed.');

    const sh = findSheetLoose_(WANT_MERCHANT);
    if (!sh) throw new Error('Merchant sheet not found.');

    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (!lr || !lc) throw new Error('Merchant sheet is empty.');
    const vals = sh.getRange(1,1,lr,lc).getValues();

    // detect header row & headers on the fly for accurate indexing
    const hdrIdx = detectHeaderRow_(vals);
    const rawHeaders = (vals[hdrIdx] || []).map(h => String(h || '').trim());
    const seen = {};
    const headers = rawHeaders.map((h, i) => {
      const base = h || `Column ${i+1}`;
      if (!seen[base]) { seen[base] = 1; return base; }
      seen[base] += 1; return `${base} (${seen[base]})`;
    });

    const hodHeader  = findHodHeader_(headers);
    let colExpected  = headers.findIndex(h => ['expecteddate','expected_date','expected date','v'].includes(normKey(h)));
    let colRemarks   = headers.findIndex(h => ['remarks','remark','comments','w'].includes(normKey(h)));
    if (colExpected < 0 && headers.length > 21) colExpected = 21;
    if (colRemarks  < 0 && headers.length > 22) colRemarks  = 22;
    if (colExpected < 0 || colRemarks < 0) throw new Error('Expected/Remarks columns not found (V/W).');

    const isAdmin = normLower(me.role) === 'admin';
    const meTok   = tokenKey(me.hod);
    const allowAll = isAdmin || meTok === '' || meTok === 'all';

    let updated = 0;
    for (const k in updates) {
      const sheetRowIndex = parseInt(k, 10); // 1-based row index in original sheet
      if (!sheetRowIndex || sheetRowIndex <= hdrIdx + 1 || sheetRowIndex > lr) continue; // must be below header row

      // IMPROVED: Check HOD permissions (more permissive)
      if (!allowAll && hodHeader) {
        const hodColIdx = headers.indexOf(hodHeader);
        const rowHodValue = vals[sheetRowIndex - 1][hodColIdx];
        
        // Allow editing if row HOD is empty (unassigned)
        if (rowHodValue !== null && rowHodValue !== undefined && String(rowHodValue).trim() !== '') {
          const rowTok = tokenKey(rowHodValue);
          if (rowTok && !(rowTok === meTok || rowTok.includes(meTok) || meTok.includes(rowTok))) {
            continue; // Skip this row - user doesn't have permission
          }
        }
      }

      const u = updates[k];
      if (u.expectedDate !== undefined) vals[sheetRowIndex - 1][colExpected] = u.expectedDate;
      if (u.remarks      !== undefined) vals[sheetRowIndex - 1][colRemarks]  = u.remarks;

      sh.getRange(sheetRowIndex, 1, 1, headers.length).setValues([vals[sheetRowIndex - 1]]);
      updated++;
    }

    return { error:false, updated, at: new Date().toLocaleString('en-IN',{ timeZone:'Asia/Kolkata' }) };
  } catch (e) {
    return { error:true, message:String(e && e.message ? e.message : e) };
  }
}

/* -------------------- Ping -------------------- */
function refreshNow() {
  return { lastUpdate: new Date().toLocaleString('en-IN',{ timeZone:'Asia/Kolkata' }) };
}