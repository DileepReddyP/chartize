"use client";

import type { TablePreview } from "@chartize/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

export interface GridSelection {
  columns: string[];
  rows: string[][];
  summary: string;
}

interface DataGridProps {
  data: TablePreview;
  loading?: boolean;
  selectedColumns?: Set<string>;
  sort?: { column: string; direction: "asc" | "desc" } | null;
  onSort?: (column: string) => void;
  onAddColumn?: (column: string) => void;
  onLoadMore?: () => void;
  onSelection?: (selection: GridSelection | null) => void;
  streamKey?: string;
}

interface Cell { row: number; column: number }

const GEOMETRY_COLUMN = /(?:^|_)(?:geometry|geom|wkb|geojson)$/i;
const MAX_CELL_CHARACTERS = 180;

export function displayGridCell(column: string, value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  if (GEOMETRY_COLUMN.test(column)) return "geometry";
  return text.length > MAX_CELL_CHARACTERS
    ? `${text.slice(0, MAX_CELL_CHARACTERS - 1)}…`
    : text;
}

export function DataGrid({ data, loading, selectedColumns, sort, onSort, onAddColumn, onLoadMore, onSelection, streamKey }: DataGridProps) {
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell | null>(null);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const range = useMemo(() => {
    if (!anchor || !focus) return null;
    return {
      rowStart: Math.min(anchor.row, focus.row),
      rowEnd: Math.max(anchor.row, focus.row),
      columnStart: Math.min(anchor.column, focus.column),
      columnEnd: Math.max(anchor.column, focus.column),
    };
  }, [anchor, focus]);

  useEffect(() => {
    const finish = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (!range) return;
      const columns = data.columns.slice(range.columnStart, range.columnEnd + 1);
      const rows = data.rows.slice(range.rowStart, range.rowEnd + 1).map((row) => row.slice(range.columnStart, range.columnEnd + 1));
      onSelection?.({ columns, rows, summary: `${rows.length} row${rows.length === 1 ? "" : "s"} × ${columns.length} field${columns.length === 1 ? "" : "s"}` });
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, [data.columns, data.rows, onSelection, range]);

  const selected = (row: number, column: number) => Boolean(range
    && row >= range.rowStart && row <= range.rowEnd
    && column >= range.columnStart && column <= range.columnEnd);
  const hasNext = data.rows.length < data.totalRows;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    dragging.current = false;
    setAnchor(null);
    setFocus(null);
    onSelection?.(null);
  }, [streamKey]);

  useEffect(() => {
    if (!onLoadMore || !hasNext || loading || !sentinelRef.current || !scrollRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    }, { root: scrollRef.current, rootMargin: "260px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [data.rows.length, hasNext, loading, onLoadMore]);

  return (
    <div className="result-table-shell">
      <div className="result-table-scroll" ref={scrollRef}>
        {data.columns.length ? (
          <table className="result-table">
            <thead>
              <tr>{data.columns.map((column) => (
                <th key={column} className={selectedColumns?.has(column) ? "query-column" : ""}>
                  {onAddColumn
                    ? <button className="column-add" type="button" title="Add this field to the SQL SELECT" onClick={() => onAddColumn(column)}>{column}</button>
                    : <span>{column}</span>}
                  {onSort && <button className={`column-sort ${sort?.column === column ? "active" : ""}`} type="button" title={`Sort by ${column}`} onClick={() => onSort(column)}>{sort?.column === column ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</button>}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr key={`${data.offset}-${rowIndex}`}>
                  {data.columns.map((column, columnIndex) => (
                    <td
                      key={`${column}-${columnIndex}`}
                      className={`${selectedColumns?.has(column) ? "query-column" : ""} ${selected(rowIndex, columnIndex) ? "range-selected" : ""}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        dragging.current = true;
                        setAnchor({ row: rowIndex, column: columnIndex });
                        setFocus({ row: rowIndex, column: columnIndex });
                        onSelection?.(null);
                      }}
                      onPointerEnter={() => dragging.current && setFocus({ row: rowIndex, column: columnIndex })}
                    >{displayGridCell(column, row[columnIndex])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="pane-empty"><strong>no rows yet</strong><span>Run a valid query to inspect its data.</span></div>}
        {onLoadMore && <div className="table-stream-sentinel" ref={sentinelRef} aria-hidden="true" />}
      </div>
      {onLoadMore && (
        <footer className="table-stream-status">
          <span>{data.rows.length.toLocaleString()} of {data.totalRows.toLocaleString()} rows</span>
          <span className="table-stream-progress">{loading && <i className="spinner" aria-hidden="true" />}{loading ? "loading the next 100…" : hasNext ? "scroll to load more" : "all rows loaded"}</span>
        </footer>
      )}
      {loading && !data.rows.length && <div className="pane-loading-mask" role="status"><div className="spinner" /><span>loading data…</span></div>}
    </div>
  );
}
