import DataTable from "@/src/components/DataTable";

export default function Page() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Management View</h1>
        <div className="flex gap-2">
          <a className="btn-primary rounded-md px-3 py-2 text-sm" href="/api/download">Download</a>
          <button className="rounded-md px-3 py-2 text-sm border" onClick={() => location.reload()}>Refresh</button>
        </div>
      </div>
      <DataTable sheet="Management View" />
    </div>
  );
}
