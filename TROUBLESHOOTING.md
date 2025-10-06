# RA Team Dashboard - Troubleshooting "No Data Available" Issue

## Issue Summary
The dashboard is showing "No data available for your HOD" in all 4 tabs.

## Key Fixes Applied

### 1. Fixed `makeGetterForHeader_` Function
**Problem:** The function was trying to extract headers from `rows[0]`, which would fail if the rows array was empty or when called before rows were processed.

**Fix:** Changed the function to accept headers array directly instead of deriving it from rows.

```javascript
// OLD (buggy):
function makeGetterForHeader_(rows, candidates) {
  const sample = rows && rows.length ? rows[0] : {};
  const keys = Object.keys(sample || {});
  const header = findHeaderName_(keys, candidates);
  // ...
}

// NEW (fixed):
function makeGetterForHeader_(headers, candidates) {
  const header = findHeaderName_(headers, candidates);
  // ...
}
```

### 2. Added Debug Logging
The updated code now logs:
- Active user email
- User HOD and role
- Number of rows loaded from each sheet
- Headers found in each sheet
- HOD column detection results
- HOD matching results (first few rows)
- Final filtered row counts

### 3. Added Debug Info to Frontend
The UI now shows:
- Total rows in the sheet
- Filtered rows matching your HOD
- Link to Apps Script execution logs

## How to Debug

### Step 1: Check Apps Script Logs
1. Open your Google Apps Script editor (Extensions → Apps Script)
2. Run the `testUserData()` function manually
3. Check View → Execution log (or Logs)

### Step 2: Look for These Key Issues

#### Issue A: HOD Column Not Found
**Log message:** `Warning: Header not found for candidates: hod, hodname, ...`

**Solution:** 
- Check that your sheets have a column named "HOD", "HOD Name", "Head of Department", or similar
- The column detection is case-insensitive and ignores spaces/dots/underscores

#### Issue B: HOD Value Mismatch
**Log message:** `HOD mismatch - Row HOD: "John Doe" vs User HOD: "Jane Smith"`

**Solutions:**
- Verify the HOD value in the Users sheet matches EXACTLY (after normalization) with the HOD values in the data sheets
- The comparison ignores:
  - Case (uppercase/lowercase)
  - Spaces
  - Dots (.)
  - Underscores (_)
  - Hyphens (-)

**Example matches:**
- "Kiran Jain" = "kiran jain" = "KIRAN_JAIN" = "Kiran.Jain"

#### Issue C: User Not Found
**Error message:** `User not found or inactive: email@domain.com`

**Solutions:**
- Check that the user exists in the "users" or "Users" sheet
- Verify the email matches exactly
- Check that the "Active" column is set to TRUE/Yes/1

#### Issue D: Empty Sheets
**Log message:** `Loaded sheets - Mgmt: 0, Merch: 0, ...`

**Solution:** The sheets are empty or have only headers. Add data rows.

### Step 3: Test Specific Functions

Run these functions individually from Apps Script editor:

```javascript
// Test 1: Check if sheets are accessible
function testSheetAccess() {
  Logger.log('Management rows: ' + sheetToObjects_(getSheet_(SHEET_MANAGEMENT)).length);
  Logger.log('Merchant rows: ' + sheetToObjects_(getSheet_(SHEET_MERCHANT)).length);
  Logger.log('Billed rows: ' + sheetToObjects_(getSheet_(SHEET_BILLED)).length);
  Logger.log('Unbilled rows: ' + sheetToObjects_(getSheet_(SHEET_UNBILLED)).length);
}

// Test 2: Check user data
function testUsers() {
  const users = getUsers();
  Logger.log('Total users: ' + users.length);
  Logger.log('Users: ' + JSON.stringify(users, null, 2));
}

// Test 3: Check headers
function testHeaders() {
  debugHeaders();
}

// Test 4: Full test with your email
function testUserData() {
  try {
    const result = getAllDataForEmail('your.email@paytmpayments.com');
    Logger.log('SUCCESS: ' + JSON.stringify(result, null, 2));
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
  }
}
```

### Step 4: Common Issues and Solutions

#### If all sheets show 0 rows loaded:
- Check SHEET_ID is correct
- Check sheet names match exactly (case-sensitive)
- Verify you have read access to the spreadsheet

#### If sheets load but filtering returns 0 rows:
1. **For regular users:** The HOD value in Users sheet must match HOD values in data sheets
2. **For admins:** Set role to "Admin" (case-insensitive) in Users sheet to bypass HOD filtering

#### If header detection fails:
- Make sure row 1 contains headers (not data)
- Headers should be descriptive (e.g., "HOD Name", "Merchant", "Amount")
- Avoid completely non-standard header names

### Step 5: Make User an Admin (Temporary Test)

To test if the issue is HOD matching:

1. Open the Users sheet
2. Change the user's Role to "Admin"
3. Refresh the dashboard
4. If data now appears, the issue is HOD value mismatch

## Quick Checklist

- [ ] User exists in Users sheet with correct email
- [ ] User is marked as Active
- [ ] HOD value in Users sheet is filled in correctly
- [ ] Data sheets have a HOD/HOD Name column
- [ ] HOD values in data sheets match the user's HOD (after normalization)
- [ ] Data sheets have data rows (not just headers)
- [ ] Apps Script deployment is set to "Execute as: Me" and "Who has access: Anyone in your domain"

## Still Not Working?

1. Run `testUserData()` function in Apps Script
2. Copy the full execution log
3. Check for any ERROR messages
4. Look at the filtered row counts in the debug output
5. Verify the HOD normalization values match

## Example Expected Log Output

```
Active email: dimple.kanojia@paytmpayments.com
User found: Dimple, HOD: Kiran Jain, Role: User
Loaded sheets - Mgmt: 150, Merch: 200, Billed: 300, Unbilled: 100
Headers - Mgmt: HOD Name | Merchant Name | Status | Revenue | Date
Found header "HOD Name" for candidates: hod, hodname, ...
Is Admin: false
Filtered results - Mgmt: 25, Merch: 30, Billed: 40, Unbilled: 15
```

If your logs show `Filtered results - Mgmt: 0, Merch: 0, ...`, focus on the HOD matching logic.
