"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "./DropZone";
import { uploadChallan } from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--bg)",
  color: "var(--text)",
  borderColor: "var(--border)",
};

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [doerName, setDoerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [track, setTrack] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please select a PDF file."); return; }
    if (!doerName.trim()) { setError("Please enter the doer's name."); return; }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("doer_name", doerName);
    fd.append("entry_date", date);
    fd.append("track", track);

    try {
      await uploadChallan(fd);
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-6 space-y-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
    >
      <DropZone onFile={setFile} file={file} />

      <div className="border-t pt-5 space-y-4" style={{ borderColor: "var(--border)" }}>
        <Field label="Doer's Name">
          <input
            type="text"
            value={doerName}
            onChange={(e) => setDoerName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-offset-0"
            style={INPUT_STYLE}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg px-3.5 py-2.5 text-sm border outline-none focus:ring-2"
              style={INPUT_STYLE}
            />
          </Field>
          <Field label="Track">
            <input
              type="text"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              placeholder="e.g. Jaipur, Batch-3"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm border outline-none focus:ring-2"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm border"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger-border)" }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading & Extracting…
          </span>
        ) : "Upload Challan"}
      </button>
    </form>
  );
}
