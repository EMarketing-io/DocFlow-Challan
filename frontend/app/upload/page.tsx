import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-opacity hover:opacity-60"
          style={{ color: "var(--muted)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>New Challan</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Upload a PDF to extract and store its data automatically.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
