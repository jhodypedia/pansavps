"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataTableRow = {
  id: string;
  cells: Record<string, React.ReactNode>;
  text?: string;
};

export type DataTableColumn = {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean;
};

export function DataTable({
  columns,
  rows,
  searchPlaceholder = "Cari…",
  pageSize = 10,
  emptyText = "Belum ada data.",
  toolbar,
  className,
  initialSort,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyText?: string;
  toolbar?: React.ReactNode;
  className?: string;
  initialSort?: { key: string; desc?: boolean };
}) {
  const [sorting, setSorting] = useState<SortingState>(
    initialSort ? [{ id: initialSort.key, desc: Boolean(initialSort.desc) }] : [],
  );
  const [globalFilter, setGlobalFilter] = useState("");

  const tableColumns = useMemo<ColumnDef<DataTableRow>[]>(
    () => [
      {
        id: "text",
        accessorFn: (row) => row.text ?? "",
        enableHiding: true,
        filterFn: "includesString",
      },
      ...columns.map<ColumnDef<DataTableRow>>((col) => ({
        id: col.key,
        accessorFn: (row) => {
          const value = row.cells[col.key];
          if (typeof value === "string" || typeof value === "number") return String(value);
          return row.text ?? "";
        },
        header: col.label,
        enableSorting: col.sortable ?? false,
        cell: ({ row }) => (
          <div className={cn("min-w-0", col.className)}>{row.original.cells[col.key]}</div>
        ),
      })),
    ],
    [columns],
  );

  // TanStack Table mengembalikan fungsi yang tidak bisa dimemoize React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility: { text: false } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white", className)}>
      <div className="flex flex-col gap-3 border-b border-[#E3E8E4] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A9A90]" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-[#D8E2DB] bg-[#FBFCFB] pl-9 text-sm"
            aria-label={searchPlaceholder}
          />
        </div>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#E3E8E4] bg-[#F7F8F7]">
                {headerGroup.headers.map((header) => {
                  const col = columns.find((c) => c.key === header.column.id);
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-[#5B6B60] whitespace-nowrap uppercase",
                        col?.className,
                      )}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-[#0B3D2E]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-[#5B6B60]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#EDF1EE] transition-colors last:border-0 hover:bg-[#FBFCFB]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle text-[#101613]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#E3E8E4] bg-[#FBFCFB] px-4 py-3 text-xs text-[#5B6B60] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Menampilkan{" "}
          <strong className="text-[#101613]">
            {table.getRowModel().rows.length
              ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1
              : 0}
            –
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize +
              table.getRowModel().rows.length}
          </strong>{" "}
          dari <strong className="text-[#101613]">{table.getFilteredRowModel().rows.length}</strong> data
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#D8E2DB] bg-white"
          >
            <ChevronLeft className="size-3.5" /> Sebelumnya
          </Button>
          <span className="px-1 font-medium text-[#101613]">
            {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#D8E2DB] bg-white"
          >
            Berikutnya <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
