"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onFile: (file: File) => void;
  file?: File | null;
}

export function DropZone({ onFile, file }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all select-none"
      style={{
        borderColor: isDragActive
          ? "var(--accent)"
          : file
          ? "var(--success-border)"
          : "var(--border)",
        background: isDragActive
          ? "#F0F0EE"
          : file
          ? "var(--success-bg)"
          : "var(--bg)",
        transform: isDragActive ? "scale(1.005)" : "none",
      }}
    >
      <input {...getInputProps()} />

      {file ? (
        <div className="space-y-1.5">
          <div
            className="w-9 h-9 rounded-lg mx-auto flex items-center justify-center"
            style={{ background: "var(--success-bg)", border: `1px solid var(--success-border)` }}
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--success)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium truncate px-4" style={{ color: "var(--success)" }}>{file.name}</p>
          <p className="text-xs" style={{ color: "var(--faint)" }}>Click or drop to replace</p>
        </div>
      ) : isDragActive ? (
        <div className="space-y-1.5">
          <div
            className="w-9 h-9 rounded-lg mx-auto flex items-center justify-center"
            style={{ background: "#E8E7E4" }}
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Release to upload</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div
            className="w-9 h-9 rounded-lg mx-auto flex items-center justify-center"
            style={{ background: "#EDECEA" }}
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Drop PDF here</p>
          <p className="text-xs" style={{ color: "var(--faint)" }}>or click to browse — PDF only</p>
        </div>
      )}
    </div>
  );
}
