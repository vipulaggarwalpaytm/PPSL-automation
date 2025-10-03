"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type Props = {
  sheet: "Management View" | "Merchant_wise_Final" | "Billed Detailed" | "Unbilled Detailed";
  editable?: boolean;
};

export default function DataTable({ sheet, editable }: Props) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data?sheet=${encodeURIComponent(sheet)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const r = data.rows as Record<string, any>[];
      setRows(r);
      const hdr = Array.from(new Set(r.flatMap((row) => Object.keys(row))));
      setHeaders(hdr);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  const canEdit = editable === true;

  const handleEdit = async (rowIndex: number, key: string, value: string) => {
    // Only columns V and W allowed
    if (!canEdit || (key !== "V" && key !== "W" && key !== "Expected Date" && key !== "Remarks")) return;
    try {
      // rowIndex here is 0-based in our list, but sheet data header is row 1, so +2
      const payload: any = {
        rowIndex: rowIndex + 2,
        expectedDate: key === "V" || key === "Expected Date" ? value : undefined,
        remarks: key === "W" || key === "Remarks" ? value : undefined,
      };
      const res = await fetch("/api/merchant/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      // noop UI-only
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (rows.length === 0) return <div>No data</div>;

  // Prefer known labels for V/W if present, else fallback
  const headerList = useMemo(() => headers, [headers]);

  return (
    <div className="overflow-auto border border-[var(--color-border)] rounded-md">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--color-muted)] sticky top-0">
          <tr>
            {headerList.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--color-navy)] whitespace-nowrap border-b border-[var(--color-border)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={clsx(i % 2 === 1 && "bg-[var(--color-muted)]/50")}> 
              {headerList.map((h) => {
                const value = row[h] ?? "";
                const allowCellEdit = canEdit && (h === "V" || h === "W" || h === "Expected Date" || h === "Remarks");
                return (
                  <td key={h} className="px-3 py-2 align-top border-b border-[var(--color-border)]">
                    {allowCellEdit ? (
                      <input
                        className="w-56 max-w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm"
                        defaultValue={String(value)}
                        onBlur={(e) => handleEdit(i, h, e.target.value)}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{String(value)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
