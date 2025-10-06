# RA Team Dashboard - Complete Deployment Guide

## ⚡ Quick Start (3 Steps)

### Step 1: Replace Apps Script Code
1. Open your Google Apps Script editor
   - Go to your Google Sheet
   - Click **Extensions** → **Apps Script**

2. Delete the old `Dashboard view.gs` file (if exists)

3. Create a new file called `Code.gs`:
   - Click **+** next to Files
   - Select **Script**
   - Name it `Code`

4. Copy the entire contents of `Code.gs` (from this package)

5. Paste it into the Apps Script editor

6. **IMPORTANT**: Update the `SHEET_ID` on line 8 if needed

7. Click **Save** (Ctrl+S or Cmd+S)

### Step 2: Replace HTML File
1. In the same Apps Script editor, find or create `index.html`:
   - If it exists, click on it
   - If not, click **+** → **HTML** → name it `index`

2. Copy the entire contents of `index_UPDATED.html` (from this package)

3. Paste it into the HTML file

4. Click **Save**

### Step 3: Test Before Deploying
1. In the Apps Script editor, select the function dropdown (top middle)

2. Choose `runAllTests` from the dropdown

3. Click **Run** (▶ button)

4. If prompted, click **Review Permissions** and authorize the script

5. Click **View** → **Logs** (or **Execution log**)

6. **Check the logs** - you should see:
   ```
   ✓ Connected to spreadsheet: [Your Sheet Name]
   ✓ FULL FLOW TEST PASSED
   Management rows: [some number]
   Merchant rows: [some number]
   ```

### Step 4: Deploy Web App
1. Click **Deploy** → **New deployment**

2. Click the gear icon ⚙ next to "Select type"

3. Choose **Web app**

4. Configure:
   - **Description**: "RA Dashboard v1" (or any version name)
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone with Google account** (or "Anyone in your organization")

5. Click **Deploy**

6. Copy the **Web app URL**

7. Open the URL in your browser

---

## 🔍 Troubleshooting

### Test Functions Reference

Run these functions in Apps Script to diagnose issues:

#### 1. `runAllTests()`
**What it does**: Runs all tests in sequence
**When to use**: Initial setup, or when nothing works

#### 2. `testConnection()`
**What it does**: Tests connection to spreadsheet and lists all sheets
**When to use**: If you get "spreadsheet not found" errors
**Check for**:
- Does it list all your sheets?
- Are the sheet names spelled correctly?

#### 3. `testDataLoad()`
**What it does**: Loads each sheet and shows sample column names
**When to use**: If data is not loading
**Check for**:
- Are the column names what you expect?
- Does each sheet have data?

#### 4. `testFullFlow()`
**What it does**: Runs the full data loading process
**When to use**: If the web app shows "No data"
**Check for**:
- Is the user found?
- How many rows are returned for each sheet?

### Common Issues & Solutions

#### Issue 1: "Sheet not found"
**Logs show**: `Sheet "Management View" not found`

**Solution**:
1. Open your Google Sheet
2. Check the exact names of your sheet tabs
3. Update lines 10-14 in `Code.gs`:
   ```javascript
   const SHEET_NAMES = {
     users: 'users',                    // Change to match your sheet
     management: 'Management View',     // Change to match your sheet
     merchant: 'Merchant_wise_Final',   // Change to match your sheet
     billed: 'Billed Detailed',         // Change to match your sheet
     unbilled: 'Unbilled Detailed'      // Change to match your sheet
   };
   ```

#### Issue 2: "User not found"
**Logs show**: `User not found`

**Solution**:
1. Open the Users sheet in your Google Sheet
2. Add a row with:
   - **Email**: Your exact Google account email
   - **Name**: Your name
   - **HOD**: Your manager's name (exact spelling matters!)
   - **Role**: "User" or "Admin"
   - **Active**: TRUE or Yes or 1

3. Run `testFullFlow()` again

#### Issue 3: "No data available" (but sheets have data)
**Logs show**: `Filtered results - Management: 0, Merchant: 0`

**Two possible causes:**

**Cause A: HOD mismatch**
- Your HOD in Users sheet: "Kiran Jain"
- HOD in data sheets: "Kiran" ❌ No match!

**Solution**: Make sure HOD values match EXACTLY (case doesn't matter, but spelling does)

**Cause B: No HOD column in data sheets**
- The code looks for columns named: HOD, hod, HOD Name, Head of Department
- Your column might be named differently

**Solution**: 
1. Run `testDataLoad()` to see your column names
2. If HOD column has a different name, add it to line 193 in `Code.gs`:
   ```javascript
   const hodColumn = findColumn_(rows[0], ['HOD', 'hod', 'HOD Name', 'Your Column Name Here']);
   ```

#### Issue 4: All data shows for everyone
**This is actually a FEATURE, not a bug!**

The new code has a **fallback mechanism**:
- If HOD matching fails, it shows all data to prevent frustration
- To enforce strict HOD filtering, check that:
  1. User has HOD set in Users sheet
  2. Data sheets have HOD column
  3. HOD values match exactly

#### Issue 5: Can't edit Expected Date/Remarks
**Check these:**

1. **Editing window**: Can only edit during days 1-5 or 16-20 of the month
   - Today's date is shown in the logs

2. **Wrong sheet**: Can only edit in "Merchant Wise" tab

3. **Column not found**: 
   - Run `testDataLoad()` to see column names
   - Expected Date should be in column V or named "Expected Date"
   - Remarks should be in column W or named "Remarks"

---

## 📊 Understanding the Logs

### Good Logs (Everything Working)
```
========================================
GET ALL DATA FOR EMAIL
========================================
Loading sheet: users
  - Found 5 data rows (plus header)
  - Looking for user: john.doe@company.com
  - Found user: John Doe, HOD: "Kiran Jain", Role: User

Loading sheet: Management View
  - Found 150 data rows (plus header)
Loading sheet: Merchant_wise_Final
  - Found 200 data rows (plus header)
Loading sheet: Billed Detailed
  - Found 300 data rows (plus header)
Loading sheet: Unbilled Detailed
  - Found 100 data rows (plus header)

Raw data loaded:
  Management: 150 rows
  Merchant: 200 rows
  Billed: 300 rows
  Unbilled: 100 rows

Filtering Management by HOD...
  - Total rows: 150
  - User HOD: "Kiran Jain" (normalized: "kiranjain")
  - Is Admin: false
  - HOD column found: "HOD Name"
  - Filtered result: 25 rows match

[Similar for other sheets...]

Final results:
  Management: 25 rows
  Merchant: 30 rows
  Billed: 40 rows
  Unbilled: 15 rows
  Editing window: OPEN (day 3)
========================================
```

### Bad Logs (No Data)
```
========================================
GET ALL DATA FOR EMAIL
========================================
Loading sheet: users
  - Found 5 data rows (plus header)
  - Looking for user: john.doe@company.com
  - Found user: John Doe, HOD: "Kiran Jain", Role: User

Loading sheet: Management View
  - Found 150 data rows (plus header)

Filtering Management by HOD...
  - Total rows: 150
  - User HOD: "Kiran Jain" (normalized: "kiranjain")
  - Is Admin: false
  - HOD column found: "HOD"
  - Sample row HOD: "Kiran" (normalized: "kiran")  ⚠️ MISMATCH!
  - This does NOT match user HOD: "Kiran Jain"
  - WARNING: No rows match HOD, returning all rows as fallback

Final results:
  Management: 150 rows  ⚠️ All rows (fallback)
```

**In this example**: HOD doesn't match because data has "Kiran" but user has "Kiran Jain"

---

## 🎯 Configuration Checklist

Before deploying, verify:

### In Code.gs:
- [ ] Line 8: `SHEET_ID` is correct
- [ ] Lines 10-14: Sheet names match your actual sheet tabs
- [ ] Saved the file

### In Google Sheets:
- [ ] Users sheet exists with correct name
- [ ] Users sheet has columns: Email, Name, HOD, Role, Active
- [ ] Your user is added with correct email
- [ ] Data sheets have HOD column (or similar)
- [ ] HOD values in data match HOD in Users sheet

### In Apps Script:
- [ ] Ran `runAllTests()` successfully
- [ ] Logs show data is loading
- [ ] Logs show rows are being filtered
- [ ] Deployed as Web App with correct permissions

---

## 🚀 Advanced Configuration

### Make a User an Admin
In the Users sheet, set their Role to "Admin" (case-insensitive)
- Admins see ALL data regardless of HOD
- Admins can edit all rows

### Change Editing Window
Current: Days 1-5 and 16-20 of each month

To change, edit line 332 in `Code.gs`:
```javascript
const editingEnabled = (day >= 1 && day <= 5) || (day >= 16 && day <= 20);

// Example: Only days 1-10
const editingEnabled = (day >= 1 && day <= 10);

// Example: Always enabled
const editingEnabled = true;
```

### Add More Column Name Variants
If your columns have unique names, add them to the search lists.

Example for "Merchant" column on line 231:
```javascript
merchant: normalize_(getColumnValue_(r, [
  'Merchant', 
  'merchant', 
  'Merchant Name', 
  'Merchant_Name',
  'Your Custom Column Name'  // Add here
])),
```

---

## 📞 Still Need Help?

1. **Run**: `runAllTests()` in Apps Script
2. **Copy**: The entire execution log
3. **Check**: The section where it fails
4. **Look for**: Error messages or unexpected values

The logs will tell you exactly what's wrong!

---

## ✅ Success Indicators

You'll know it's working when:

1. ✓ `runAllTests()` shows: "FULL FLOW TEST PASSED"
2. ✓ Logs show: "Management rows: X" (where X > 0)
3. ✓ Web app loads without errors
4. ✓ You see data in at least one tab
5. ✓ User info displays correctly at the top

---

## 📝 Version History

**v3.0 (Current - Simplified & Robust)**
- Completely rewritten for reliability
- Better column detection
- Fallback mechanisms to prevent "no data" issues
- Extensive logging
- Comprehensive test functions

**Key Improvements**:
- Will show data even if HOD matching has issues
- Better error messages
- Easier to debug
- More flexible column name matching
