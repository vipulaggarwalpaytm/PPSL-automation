# ⚡ QUICK START - Get Your Dashboard Working in 5 Minutes

## 📋 Pre-Flight Checklist

Before you start, make sure you have:

- [ ] Access to your Google Sheets spreadsheet
- [ ] Access to Apps Script (Extensions → Apps Script)
- [ ] Your Google account email address

---

## 🚀 Step-by-Step Instructions

### STEP 1: Update Apps Script Code (2 minutes)

1. **Open Apps Script**
   - Open your Google Sheet
   - Click **Extensions** → **Apps Script**

2. **Delete old files** (if they exist)
   - Click the three dots ⋮ next to old files
   - Select "Remove"

3. **Create new Code.gs file**
   - Click **+** button next to "Files"
   - Select **Script**
   - Name it: `Code`
   - Copy contents from `Code.gs` (in this package)
   - Paste into the editor
   - Click **Save** (Ctrl+S)

4. **Verify SHEET_ID** (Line 8)
   ```javascript
   const SHEET_ID = '1bmJFhR-RbYtSf6g3LKi-nj2piSUV9csmm3fuuB0XQYU';
   ```
   
   To get your Sheet ID:
   - Look at your Google Sheet URL
   - It's the long string between `/d/` and `/edit`
   - Example: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Update line 8 with your ID

5. **Check sheet names** (Lines 10-14)
   ```javascript
   const SHEET_NAMES = {
     users: 'users',                    // Your users sheet name
     management: 'Management View',     // Your management sheet name
     merchant: 'Merchant_wise_Final',   // Your merchant sheet name
     billed: 'Billed Detailed',         // Your billed sheet name
     unbilled: 'Unbilled Detailed'      // Your unbilled sheet name
   };
   ```
   
   - Go to your Google Sheet
   - Check the tab names at the bottom
   - Update the names if they're different
   - Click **Save**

### STEP 2: Update HTML File (1 minute)

1. **Create or update index.html**
   - In Apps Script editor, find `index.html` file
   - If it doesn't exist, click **+** → **HTML** → name it `index`
   - Copy contents from `index_UPDATED.html` (in this package)
   - Paste into the editor
   - Click **Save**

### STEP 3: Run Tests (1 minute)

1. **Select test function**
   - In Apps Script editor
   - Click the function dropdown (top, middle)
   - Select `runAllTests`

2. **Run the function**
   - Click **Run** button (▶)
   - If prompted, click **Review permissions**
   - Click your Google account
   - Click **Advanced** → **Go to [Project Name] (unsafe)**
   - Click **Allow**

3. **Check the logs**
   - Click **View** → **Execution log** (or **Logs**)
   - Scroll through and look for:
     - `✓ FULL FLOW TEST PASSED` ← Good!
     - `Management rows: [number]` ← Should be > 0
     - Any `ERROR` messages ← Need to fix these

4. **If you see errors**, check:
   - Is your email in the Users sheet?
   - Do the sheet names match exactly?
   - Do the sheets have data?

### STEP 4: Deploy Web App (1 minute)

1. **Create deployment**
   - Click **Deploy** → **New deployment**
   - Click the gear icon ⚙ next to "Select type"
   - Choose **Web app**

2. **Configure deployment**
   - Description: `RA Dashboard v1`
   - Execute as: **Me (your email)**
   - Who has access: **Anyone with Google account**
     (or "Anyone in [your organization]")
   - Click **Deploy**

3. **Copy the URL**
   - Copy the "Web app URL" shown
   - Click **Done**

4. **Test the dashboard**
   - Paste the URL in your browser
   - Dashboard should load with data

---

## 🎯 Expected Results

### ✅ Success Looks Like:
- Tests pass with "FULL FLOW TEST PASSED"
- Logs show: `Management rows: 25` (or any number > 0)
- Dashboard loads in browser
- You see your name and email at the top
- At least one tab shows data in a table

### ❌ Failure Looks Like:
- Tests fail with "ERROR" messages
- Logs show: `Management rows: 0` (all zeros)
- Dashboard shows "No data available" in all tabs
- Dashboard shows error page

---

## 🔧 Common Issues & Quick Fixes

### Issue 1: "User not found"

**Fix:**
1. Open your Google Sheet
2. Go to the "users" or "Users" tab
3. Add a row with your information:
   | Email | Name | HOD | Role | Active |
   |-------|------|-----|------|--------|
   | your.email@company.com | Your Name | Manager Name | User | TRUE |
4. Run `runAllTests()` again

### Issue 2: "Sheet not found"

**Fix:**
1. Check your Google Sheet tab names
2. Update lines 10-14 in `Code.gs` to match exactly
3. Example: If your tab is called "Users" (with capital U), use:
   ```javascript
   users: 'Users',
   ```
4. Click **Save** and run tests again

### Issue 3: Tests pass but dashboard shows "No data"

**Fix:**
1. Run `testFullFlow()` function
2. Check the logs for:
   ```
   Filtered results - Management: 0, Merchant: 0
   ```
3. This means HOD doesn't match
4. Check that:
   - Your HOD in Users sheet: "Kiran Jain"
   - HOD in data sheets: "Kiran Jain" (must be the same)
5. Fix the HOD values to match exactly

**Quick workaround:**
- Make yourself an Admin:
  - In Users sheet, change your Role to "Admin"
  - Admins see ALL data regardless of HOD

### Issue 4: "Cannot read property..."

**Fix:**
1. This usually means a sheet is empty
2. Run `testDataLoad()` to see which sheet is empty
3. Add at least one row of data to each sheet
4. Make sure row 1 has headers

---

## 📊 Understanding the Dashboard

### Tabs:
- **Management View**: Overview data (read-only)
- **Merchant Wise**: Can edit Expected Date and Remarks (during editing window)
- **Billed Details**: Billed transactions (read-only)
- **Unbilled Details**: Unbilled transactions (read-only)

### Editing Window:
- Can only edit during **days 1-5** or **16-20** of each month
- Outside these dates, editing is disabled

### Roles:
- **User**: Sees only their HOD's data
- **Admin**: Sees ALL data, can edit everything

---

## 🆘 Still Not Working?

### Debug Process:

1. **Run tests in order:**
   ```
   testConnection()    → Verify spreadsheet access
   testDataLoad()      → Verify data loads
   testFullFlow()      → Verify filtering works
   ```

2. **For each test:**
   - Click function dropdown
   - Select the test
   - Click Run
   - Check logs (View → Logs)
   - Look for ERROR or WARNING messages

3. **Common log patterns:**

   **Good log:**
   ```
   ✓ Connected to spreadsheet: Your Sheet
   Loading sheet: Management View
     - Found 150 data rows (plus header)
   Filtered result: 25 rows match
   ✓ FULL FLOW TEST PASSED
   ```

   **Bad log (no data):**
   ```
   Loading sheet: Management View
     - Found 0 data rows (plus header)  ← Sheet is empty!
   ```

   **Bad log (HOD mismatch):**
   ```
   Filtered result: 0 rows match
   Sample row HOD: "Kiran" (normalized: "kiran")
   User HOD: "Kiran Jain" (normalized: "kiranjain")  ← Don't match!
   ```

4. **Fix the specific issue shown in logs**

5. **Re-run tests until they pass**

---

## 🎓 Pro Tips

### Tip 1: Always check logs
Even if it "works", check logs for warnings. They indicate configuration issues.

### Tip 2: Start with one sheet
Get "Management View" working first, then worry about other sheets.

### Tip 3: Use simple HOD names
Instead of "Kiran Jain", use "Kiran" consistently across ALL sheets.

### Tip 4: Make yourself Admin for testing
Temporarily set your Role to "Admin" to see if data loads at all. If it does, the issue is HOD filtering.

### Tip 5: Browser console
Open browser console (F12) to see any JavaScript errors. Look for red error messages.

---

## ✅ Final Checklist

Before marking this as "done":

- [ ] Tests pass (`runAllTests()` shows success)
- [ ] Dashboard loads in browser
- [ ] Your name shows at top of dashboard
- [ ] At least one tab shows data (not "No data available")
- [ ] You can see the debug info panel when there's no data
- [ ] Logs show no ERROR messages

If all checked, you're done! 🎉

---

## 📞 Need More Help?

If you've followed all steps and it still doesn't work:

1. Run `runAllTests()`
2. Copy the FULL execution log
3. Look for the FIRST error message
4. Check the troubleshooting section in `DEPLOYMENT_GUIDE.md`
5. The error message will tell you exactly what to fix

**The logs are your friend!** They contain all the information needed to diagnose any issue.

---

## 🚀 You're Ready!

Once you see data in the dashboard, you're all set. The dashboard will:
- Show data for your HOD (or all data if you're admin)
- Allow editing Expected Date and Remarks during the editing window
- Refresh data with the "Refresh Data" button
- Download Excel reports with the "Download Excel" button

Enjoy your dashboard! 📊
