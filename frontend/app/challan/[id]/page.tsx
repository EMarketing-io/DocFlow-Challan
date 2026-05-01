"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { API_URL, updateChallanStatus, batchUpdateItemsDelivered, reprocessImages } from "@/lib/api";
import type { ChallanDetail, LineItem } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fmt = (n: number | string) =>
  n ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const SIZES = ["2xl", "3xl", "4xl", "5xl", "6xl", "l", "m", "s", "xl"] as const;
const SIZE_LABELS = ["2XL", "3XL", "4XL", "5XL", "6XL", "L", "M", "S", "XL"];

function MetaField({ label, value }: { label: string; value?: string }) {
  const clean = value?.trim();
  if (!clean) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{clean}</p>
    </div>
  );
}

function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/api/")) return `${API_URL}${url}`;
  return url;
}

function ItemImage({ url, itemCode }: { url?: string; itemCode: string }) {
  const src = resolveImageUrl(url);
  if (!src) {
    return (
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center text-xs shrink-0"
        style={{ background: "var(--surface-2)", color: "var(--faint)", border: "1px solid var(--border)" }}
      >
        —
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" title={`View image for ${itemCode}`}>
      <img
        src={src}
        alt={itemCode}
        width={40}
        height={40}
        className="w-10 h-10 rounded-md object-cover shrink-0 transition-opacity hover:opacity-80"
        style={{ border: "1px solid var(--border)" }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </a>
  );
}

const isDelivered = (item: LineItem) =>
  item.delivered === true || item.delivered === "TRUE";

export default function ChallanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, error, mutate } = useSWR<ChallanDetail>(
    `${API_URL}/api/challans/${id}`,
    fetcher,
    { refreshInterval: 12000 }
  );

  const [status, setStatus] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryDone, setRetryDone] = useState(false);
  const [localDelivered, setLocalDelivered] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const autoTriggered = useRef(false);
  const initializedRef = useRef(false);

  // Initialize localDelivered from fetched data (once)
  useEffect(() => {
    if (!data || initializedRef.current) return;
    const map: Record<string, boolean> = {};
    for (const item of data.line_items ?? []) {
      map[item.id] = isDelivered(item);
    }
    setLocalDelivered(map);
    initializedRef.current = true;
  }, [data]);

  const handleRetryImages = async () => {
    setRetrying(true);
    try {
      await reprocessImages(id);
      setRetryDone(true);
    } catch {
      // ignore
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!data || autoTriggered.current) return;
    const items = data.line_items ?? [];
    const hasImgs = items.some((i) => i.image_url);
    if (items.length > 0 && !hasImgs) {
      autoTriggered.current = true;
      handleRetryImages();
    }
  }, [data]);

  const effectiveStatus = status ?? data?.status ?? "pending";
  const isDone = effectiveStatus === "done";

  const handleStatusToggle = async () => {
    const next = isDone ? "pending" : "done";
    setStatus(next);
    await updateChallanStatus(id, next);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const updates = Object.entries(localDelivered).map(([item_id, delivered]) => ({
        item_id,
        delivered,
      }));
      await batchUpdateItemsDelivered(id, updates);
      router.push("/");
    } catch {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium" style={{ color: "var(--danger)" }}>Failed to load challan</p>
        <Link href="/" className="text-sm mt-3 inline-block" style={{ color: "var(--muted)" }}>← Back to Dashboard</Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: "var(--surface)" }} />
        <div className="h-32 rounded-xl" style={{ background: "var(--surface)" }} />
        <div className="h-96 rounded-xl" style={{ background: "var(--surface)" }} />
      </div>
    );
  }

  const items = data.line_items ?? [];
  const localDeliveredCount = Object.values(localDelivered).filter(Boolean).length;
  const totalAmount = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const hasImages = items.some((i) => i.image_url);

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {data.challan_no || "Challan Detail"}
          </h1>
          <button
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
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {data.pdf_url && (
            <a
              href={data.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium border transition-opacity hover:opacity-80"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow)",
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View PDF
            </a>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
                Save & Back
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metadata card */}
      <div
        className="rounded-xl border p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
      >
        <MetaField label="Client" value={data.client_name} />
        <MetaField label="Challan No." value={data.challan_no} />
        <MetaField label="Issue Date" value={data.issue_date} />
        <MetaField label="Order No." value={data.order_no} />
        <MetaField label="Order Date" value={data.order_date} />
        <MetaField label="GST No." value={data.gst_no} />
        <MetaField label="Phone" value={data.phone} />
        <MetaField label="City" value={data.city} />
        <MetaField label="Agency" value={data.agency} />
        <MetaField label="Track" value={data.track} />
        <MetaField label="Entered By" value={data.doer_name} />
        <MetaField label="Entry Date" value={data.entry_date} />
      </div>

      {/* Line items table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Line Items
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                {items.length} items
              </span>
            </span>
            {items.length > 0 && !hasImages && (
              retryDone ? (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                  style={{
                    background: "var(--success-bg)",
                    color: "var(--success)",
                    borderColor: "var(--success-border)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "var(--success)" }} />
                  Processing… auto-refreshing
                </span>
              ) : (
                <button
                  onClick={handleRetryImages}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: "var(--warn-bg)",
                    color: "var(--warn)",
                    borderColor: "var(--warn-border)",
                  }}
                >
                  {retrying ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Starting…
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "var(--warn)" }} />
                      Images missing — click to retry
                    </>
                  )}
                </button>
              )
            )}
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {localDeliveredCount} of {items.length} ticked
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--faint)" }}>
            No line items extracted from this challan.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-clip">
              <table className="w-full text-xs border-collapse" style={{ minWidth: hasImages ? "1000px" : "900px" }}>
                <thead className="sticky top-14 z-20">
                  <tr style={{ borderBottom: `1px solid var(--border)`, background: "var(--surface-2)" }}>
                    {/* Sticky: # */}
                    <th
                      className="px-3 py-3 text-left font-medium w-10 sticky left-0 z-30"
                      style={{ color: "var(--faint)", background: "var(--surface-2)" }}
                    >
                      #
                    </th>
                    {/* Sticky: Image (only when images exist) */}
                    {hasImages && (
                      <th
                        className="px-2 py-3 text-left font-medium w-14 sticky left-10 z-30"
                        style={{ color: "var(--muted)", background: "var(--surface-2)" }}
                      >
                        Img
                      </th>
                    )}
                    {/* Sticky: Item Code */}
                    <th
                      className={`px-4 py-3 text-left font-medium sticky z-30 ${hasImages ? "left-[96px]" : "left-10"}`}
                      style={{ color: "var(--muted)", background: "var(--surface-2)" }}
                    >
                      Item Code
                    </th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>Tag</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>Colour</th>
                    {SIZE_LABELS.map((s) => (
                      <th key={s} className="px-2 py-3 text-center font-medium w-10" style={{ color: "var(--muted)" }}>{s}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium" style={{ color: "var(--muted)" }}>Qty</th>
                    <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--muted)" }}>Price</th>
                    <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--muted)" }}>Amount</th>
                    <th className="px-4 py-3 text-center font-medium w-14" style={{ color: "var(--muted)" }}>Done</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const done = localDelivered[item.id] ?? false;
                    const rowBg = done
                      ? "var(--success-bg)"
                      : idx % 2 === 0
                      ? "var(--surface)"
                      : "var(--surface-2)";

                    return (
                      <tr
                        key={item.id}
                        style={{ background: rowBg, borderBottom: `1px solid var(--border)` }}
                      >
                        {/* # — sticky */}
                        <td
                          className="px-3 py-2 tabular-nums sticky left-0 z-10"
                          style={{ color: "var(--faint)", background: rowBg }}
                        >
                          {item.sr}
                        </td>

                        {/* Image — sticky (only when hasImages) */}
                        {hasImages && (
                          <td
                            className="px-2 py-2 sticky left-10 z-10"
                            style={{ background: rowBg }}
                          >
                            <ItemImage url={item.image_url} itemCode={item.item_code} />
                          </td>
                        )}

                        {/* Item Code — sticky */}
                        <td
                          className={`px-4 py-2 font-medium sticky z-10 ${hasImages ? "left-[96px]" : "left-10"}`}
                          style={{ color: "var(--text)", background: rowBg }}
                        >
                          {item.item_code}
                        </td>

                        <td className="px-4 py-2" style={{ color: "var(--muted)" }}>{item.tag || "—"}</td>
                        <td className="px-4 py-2" style={{ color: "var(--muted)" }}>{item.color || "—"}</td>

                        {SIZES.map((s) => {
                          const qty = (item as any)[`qty_${s}`];
                          return (
                            <td key={s} className="px-2 py-2 text-center tabular-nums" style={{ color: qty ? "var(--text)" : "var(--faint)" }}>
                              {qty || "—"}
                            </td>
                          );
                        })}

                        <td className="px-4 py-2 text-center font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                          {item.total_qty || "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                          {fmt(item.price)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                          {fmt(item.amount)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) =>
                              setLocalDelivered((prev) => ({ ...prev, [item.id]: e.target.checked }))
                            }
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: "var(--success)" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {localDeliveredCount} of {items.length} ticked
                </span>
                <div className="hidden sm:block h-3 w-px" style={{ background: "var(--border)" }} />
                <div
                  className="hidden sm:block h-1.5 rounded-full overflow-hidden"
                  style={{ width: "80px", background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${items.length ? Math.round((localDeliveredCount / items.length) * 100) : 0}%`,
                      background: "var(--success)",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  Total: {fmt(totalAmount)}
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving || items.length === 0}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  {saving ? "Saving…" : "Save & Back"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
