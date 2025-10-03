import { NextRequest } from "next/server";
import XLSX from "xlsx";
import { readSheetAsObjects } from "@/src/lib/googleSheets";
import { getServerSession } from "next-auth";
import { authConfig } from "@/src/lib/auth";

const SHEETS = [
  "Management View",
  "Merchant_wise_Final",
  "Billed Detailed",
  "Unbilled Detailed",
];

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const hod = (session as any).hod as string | null;

  const wb = XLSX.utils.book_new();
  for (const sheet of SHEETS) {
    const rows = await readSheetAsObjects(sheet);
    const filtered = hod ? rows.filter((r) => (r["HOD"] || r["hod"]) === hod) : rows;
    const ws = XLSX.utils.json_to_sheet(filtered);
    XLSX.utils.book_append_sheet(wb, ws, sheet.substring(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=ra-data.xlsx",
    },
  });
}
