"use client";

import useSWR from "swr";
import { API_URL, updateItemDelivered } from "@/lib/api";
import type { ChallanDetail, LineItem } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SIZES = ["2xl", "3xl", "4xl", "5xl", "6xl", "l", "m", "s", "xl"] as const;
const SIZE_LABELS = ["2XL", "3XL", "4XL", "5XL", "6XL", "L", "M", "S", "XL"];

const fmt = (n: number | string) =>
  n ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const isDelivered = (item: LineItem) =>
  item.delivered === true || item.delivered === "TRUE";

interface Props {
  challanId: string;
}

export function ChallanTable({ challanId }: Props) {
  const { data, isLoading, mutate } = useSWR<ChallanDetail>(
    `${API_URL}/api/challans/${challanId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="px-5 py-8 text-center text-sm animate-pulse" style={{ color: "var(--faint)" }}>
        Loading items…
      </div>
    );
  }

  const items = data?.line_items ?? [];

  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--faint)" }}>
        No line items extracted from this challan.
      </div>
    );
  }

  const totalAmount = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const deliveredCount = items.filter(isDelivered).length;

  const handleDelivered = async (item: LineItem, val: boolean) => {
    await updateItemDelivered(challanId, item.id, val);
    mutate();
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: "var(--bg)", borderBottom: `1px solid var(--border)` }}>
              <th className="px-4 py-2.5 text-left font-medium w-8" style={{ color: "var(--faint)" }}>#</th>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--muted)" }}>Item Code</th>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--muted)" }}>Tag</th>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--muted)" }}>Colour</th>
              {SIZE_LABELS.map((s) => (
                <th key={s} className="px-2 py-2.5 text-center font-medium w-9" style={{ color: "var(--muted)" }}>
                  {s}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center font-medium" style={{ color: "var(--muted)" }}>Qty</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Price</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Amount</th>
              <th className="px-4 py-2.5 text-center font-medium" style={{ color: "var(--muted)" }}>Done</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const done = isDelivered(item);
              return (
                <tr
                  key={item.id}
                  className="transition-colors"
                  style={{
                    background: done ? "var(--success-bg)" : idx % 2 === 0 ? "#FFFFFF" : "var(--bg)",
                    borderBottom: `1px solid var(--border)`,
                  }}
                >
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--faint)" }}>{item.sr}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>{item.item_code}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{item.tag || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{item.color || "—"}</td>
                  {SIZES.map((s) => {
                    const qty = (item as any)[`qty_${s}`];
                    return (
                      <td key={s} className="px-2 py-2.5 text-center tabular-nums" style={{ color: qty ? "var(--text)" : "var(--faint)" }}>
                        {qty || "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {item.total_qty || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                    {fmt(item.price)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {fmt(item.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => handleDelivered(item, e.target.checked)}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: "var(--success)" }}
                      title={done ? "Mark pending" : "Mark delivered"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: `1px solid var(--border)`, background: "var(--bg)" }}
      >
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {deliveredCount} of {items.length} delivered
        </span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>
          Total: {fmt(totalAmount)}
        </span>
      </div>
    </div>
  );
}
