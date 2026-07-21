"use client";

import { useRef, useState, type DragEvent } from "react";

export const DATA_FILE_ACCEPT = ".csv,.tsv,.json,.ndjson,.parquet,.geoparquet,.geojson,.zip";
export type DataUploadMode = "conversation" | "manual";

export function filesFromDrop(event: DragEvent) {
  return Array.from(event.dataTransfer.files).slice(0, 20);
}

function AttachmentIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5 14.8 6.2a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.1-8.1" /></svg>;
}

export function DataUploadControl({
  disabled,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[], mode: DataUploadMode) => Promise<void> | void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);

  const importFiles = async (input: FileList | null, mode: DataUploadMode) => {
    const files = Array.from(input ?? []).slice(0, 20);
    if (!files.length) return;
    setBusy(true);
    try {
      await onFiles(files, mode);
      detailsRef.current?.removeAttribute("open");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details ref={detailsRef} className="data-upload-control" data-dismiss-on-outside>
      <summary aria-label="Upload data" title="Upload data" aria-disabled={disabled || busy}>
        <AttachmentIcon /><span>{busy ? "importing…" : "upload data"}</span>
      </summary>
      <div className="data-upload-menu">
        <header><i>up</i><span><b>bring your own data</b><small>local to this browser</small></span></header>
        <section>
          <AttachmentIcon />
          <strong>start with chartize ai</strong>
          <p>Choose files, inspect the raw rows together, and decide what should be cleaned before anything is changed.</p>
          <label className="data-upload-primary">
            choose files to profile
            <input name="chartize-ai-data-files" aria-label="Choose data files to profile with Chartize AI" type="file" multiple accept={DATA_FILE_ACCEPT} disabled={disabled || busy} onChange={(event) => { void importFiles(event.target.files, "conversation"); event.currentTarget.value = ""; }} />
          </label>
        </section>
        <footer>
          <label>
            import raw for manual cleaning
            <input name="chartize-manual-data-files" aria-label="Choose data files to import for manual cleaning" type="file" multiple accept={DATA_FILE_ACCEPT} disabled={disabled || busy} onChange={(event) => { void importFiles(event.target.files, "manual"); event.currentTarget.value = ""; }} />
          </label>
          <small>csv · parquet · geojson · shapefile zip</small>
        </footer>
      </div>
    </details>
  );
}

export { AttachmentIcon };
