"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteChallan, updateChallanStatus } from "@/lib/api";
import type { ChallanSummary } from "@/lib/types";

interface Props {
  challan: ChallanSummary;
  onDelete: () => void;
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="flex items-baseline gap-1 text-xs">
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span style={{ color: "var(--muted)" }}>{value}</span>
    </span>
  );
}

function DeleteModal({
  challanNo,
  onConfirm,
  onCancel,
  deleting,
}: {
  challanNo: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (!deleting) { e.stopPropagation(); onCancel(); } }}
    >
      <div
        className="rounded-xl border p-6 w-full max-w-sm shadow-xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--danger-bg, #FEF2F2)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Delete {challanNo || "challan"}?
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Removes from sheet and Drive. Cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-60"
            style={{ background: "#ef4444", color: "#fff", border: "none" }}
          >
            {deleting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChallanCard({ challan, onDelete }: Props) {
  const [status, setStatus] = useState(challan.status);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setDeleting(true);
    await deleteChallan(challan.id);
    setShowConfirm(false);
    setDeleting(false);
    onDelete();
  };

  const handleCancel = () => setShowConfirm(false);

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = status === "done" ? "pending" : "done";
    setStatus(next);
    await updateChallanStatus(challan.id, next);
  };

  const isDone = status === "done";

  return (
    <>
      {showConfirm && (
        <DeleteModal
          challanNo={challan.challan_no}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          deleting={deleting}
        />
      )}

      <Link
        href={`/challan/${challan.id}`}
        className="block rounded-xl border transition-shadow hover:shadow-md group"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">

            {/* Left: main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  {challan.challan_no || "No Challan No."}
                </span>
                {challan.client_name && (
                  <>
                    <span style={{ color: "var(--border)" }}>·</span>
                    <span className="text-sm truncate max-w-xs" style={{ color: "var(--muted)" }}>
                      {challan.client_name}
                    </span>
                  </>
                )}
                {challan.city && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {challan.city}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Meta label="Order" value={challan.order_no} />
                <Meta label="Issued" value={challan.issue_date} />
                <Meta label="Track" value={challan.track} />
                <Meta label="By" value={challan.doer_name} />
                <Meta label="GST" value={challan.gst_no} />
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleStatusToggle}
                className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                style={
                  isDone
                    ? { background: "var(--success-bg)", color: "var(--success)", borderColor: "var(--success-border)" }
                    : { background: "var(--warn-bg)", color: "var(--warn)", borderColor: "var(--warn-border)" }
                }
              >
                {isDone ? "Delivered" : "Pending"}
              </button>

              <button
                type="button"
                onClick={handleDeleteClick}
                title="Delete challan"
                className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 disabled:opacity-30"
                style={{ color: "var(--faint)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <svg
                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ color: "var(--faint)" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}
