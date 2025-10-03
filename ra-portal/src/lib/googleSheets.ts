import { google } from "googleapis";

const sheetsId = process.env.GOOGLE_SHEETS_ID as string;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string;
const serviceAccountPrivateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

function getAuthClient() {
  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error("Missing Google service account credentials");
  }
  const jwt = new google.auth.JWT({
    email: serviceAccountEmail,
    key: serviceAccountPrivateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return jwt;
}

export async function getSheetsClient() {
  const auth = getAuthClient();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export type SheetRow = Record<string, string | number | null>;

async function getSheetHeaderAndValues(sheets: any, range: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range,
  });
  const values: (string | number)[][] = (response.data.values || []) as any;
  const [header = [], ...rows] = values;
  return { header: header as string[], rows: rows as (string | number)[][] };
}

export async function readSheetAsObjects(sheetName: string): Promise<SheetRow[]> {
  const sheets = await getSheetsClient();
  const { header, rows } = await getSheetHeaderAndValues(sheets, `${sheetName}!A:ZZ`);
  return rows.map((r) => {
    const obj: SheetRow = {};
    header.forEach((h, i) => {
      obj[h] = r[i] ?? null;
    });
    return obj;
  });
}

export async function readSheetRaw(sheetName: string) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `${sheetName}!A:ZZ`,
  });
  return (res.data.values || []) as (string | number)[][];
}

export async function writeMerchantCommentsByRowIndex(
  rowIndex1Based: number,
  expectedDate: string | null,
  remarks: string | null,
) {
  const sheets = await getSheetsClient();
  // Column V (22) and W (23); header is in row 1
  const rangeV = `Merchant_wise_Final!V${rowIndex1Based}:V${rowIndex1Based}`;
  const rangeW = `Merchant_wise_Final!W${rowIndex1Based}:W${rowIndex1Based}`;
  const data = [
    {
      range: rangeV,
      values: [[expectedDate ?? ""]],
    },
    {
      range: rangeW,
      values: [[remarks ?? ""]],
    },
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetsId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

export async function getUserHodByEmail(email: string): Promise<string | null> {
  const rows = await readSheetAsObjects("Users");
  const user = rows.find(
    (r) => (String(r["Email"]).toLowerCase() || "") === email.toLowerCase(),
  );
  return (user?.["HOD"] as string) || null;
}

export function isFortnightEditableWindow(now = new Date()): boolean {
  const day = now.getDate();
  return (day >= 1 && day <= 5) || (day >= 16 && day <= 20);
}
