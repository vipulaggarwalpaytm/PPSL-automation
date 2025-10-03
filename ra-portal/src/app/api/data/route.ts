import { NextRequest, NextResponse } from "next/server";
import { readSheetAsObjects } from "@/src/lib/googleSheets";
import { getServerSession } from "next-auth";
import { authConfig } from "@/src/lib/auth";

const allowedSheets = new Set([
  "Management View",
  "Merchant_wise_Final",
  "Billed Detailed",
  "Unbilled Detailed",
]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get("sheet");
  if (!sheet || !allowedSheets.has(sheet)) {
    return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });
  }

  const session = await getServerSession(authConfig);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hod = (session as any).hod as string | null;

  const rows = await readSheetAsObjects(sheet);
  const filtered = hod ? rows.filter((r) => (r["HOD"] || r["hod"]) === hod) : rows;
  return NextResponse.json({ rows: filtered });
}
