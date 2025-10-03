import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/src/lib/auth";
import { isFortnightEditableWindow, writeMerchantCommentsByRowIndex } from "@/src/lib/googleSheets";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFortnightEditableWindow()) {
    return NextResponse.json({ error: "Edit window closed" }, { status: 403 });
  }
  const body = await req.json();
  const rowIndex = Number(body.rowIndex);
  if (!Number.isFinite(rowIndex) || rowIndex < 2) {
    return NextResponse.json({ error: "Invalid rowIndex" }, { status: 400 });
  }
  await writeMerchantCommentsByRowIndex(rowIndex, body.expectedDate ?? null, body.remarks ?? null);
  return NextResponse.json({ ok: true });
}
