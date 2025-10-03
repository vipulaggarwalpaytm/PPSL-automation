import DataTable from "@/src/components/DataTable";
import { isFortnightEditableWindow } from "@/src/lib/googleSheets";

export default function Page() {
  const canEdit = isFortnightEditableWindow();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Merchant wise Final</h1>
        <div className="flex gap-2">
          <a className="btn-primary rounded-md px-3 py-2 text-sm" href="/api/download">Download</a>
          <button className="rounded-md px-3 py-2 text-sm border" onClick={() => location.reload()}>Refresh</button>
        </div>
      </div>
      {!canEdit && (
        <div className="text-xs text-gray-500">Editing disabled outside 1-5 and 16-20 days windows.</div>
      )}
      <DataTable sheet="Merchant_wise_Final" editable={canEdit} />
    </div>
  );
}
