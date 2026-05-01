"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar() {
  const path = usePathname();
  const isActive = (href: string) => path === href;

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold select-none"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            DC
          </span>
          <span className="font-semibold text-sm tracking-tight hidden sm:block" style={{ color: "var(--text)" }}>
            DocFlow
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded hidden sm:inline"
            style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            Challan
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1.5">
          <Link
            href="/"
            className="text-sm px-3 py-1.5 rounded-md transition-colors"
            style={{
              color: isActive("/") ? "var(--text)" : "var(--muted)",
              fontWeight: isActive("/") ? 500 : 400,
              background: isActive("/") ? "var(--surface-2)" : "transparent",
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/upload"
            className="text-sm px-4 py-1.5 rounded-md font-medium transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <span className="hidden sm:inline">+ New Challan</span>
            <span className="sm:hidden">+ New</span>
          </Link>
          <ThemeToggle />
        </nav>

      </div>
    </header>
  );
}
