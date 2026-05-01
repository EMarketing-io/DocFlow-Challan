"use client";

import useSWR from "swr";
import Link from "next/link";
import { ChallanCard } from "@/components/ChallanCard";
import type { ChallanSummary } from "@/lib/types";
import { API_URL } from "@/lib/api";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-3xl font-semibold tabular-nums" style={{ color: color ?? "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: challans, error, isLoading, mutate } = useSWR<ChallanSummary[]>(
    `${API_URL}/api/challans`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="font-medium mb-1" style={{ color: "var(--danger)" }}>Could not connect to API</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{API_URL}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-xl border animate-pulse" style={{ background: "var(--surface)", borderColor: "var(--border)" }} />
          ))}
        </div>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-16 rounded-xl border animate-pulse" style={{ background: "var(--surface)", borderColor: "var(--border)", opacity: 1 - n * 0.15 }} />
        ))}
      </div>
    );
  }

  const total = challans?.length ?? 0;
  const done = challans?.filter((c) => c.status === "done").length ?? 0;
  const pending = total - done;
  const totalItems = challans?.reduce((s, c) => s + (c.total_items ?? 0), 0) ?? 0;
  const deliveredItems = challans?.reduce((s, c) => s + (c.delivered_items ?? 0), 0) ?? 0;

  if (!challans || total === 0) {
    return (
      <div className="rounded-xl border p-16 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--faint)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="font-semibold text-base mb-1" style={{ color: "var(--text)" }}>No challans yet</h2>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Upload your first delivery challan to get started.</p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 text-sm px-5 py-2 rounded-lg font-medium hover:opacity-85 transition-opacity"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          Upload Challan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Challans</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>All delivery challans</p>
        </div>
        <Link
          href="/upload"
          className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-85 transition-opacity hidden sm:block"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          + New
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={total} />
        <StatCard label="Pending" value={pending} color="var(--warn)" />
        <StatCard label="Delivered" value={done} color="var(--success)" />
        <div
          className="rounded-xl border p-4 sm:p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Items Done</p>
          <p className="text-3xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--success)" }}>{deliveredItems}</span>
            <span className="text-lg font-normal mx-1" style={{ color: "var(--faint)" }}>/</span>
            <span>{totalItems}</span>
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {challans.map((c) => (
          <ChallanCard key={c.id} challan={c} onDelete={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
