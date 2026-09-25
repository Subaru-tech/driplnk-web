"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ADMIN_NAV_ITEMS, NAV_ITEMS, SELLER_NAV_ITEMS, titleForPath } from "@/components/dashboard/nav-items";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Wordmark } from "@/components/marketing/wordmark";
import { cn } from "@/lib/cn";

/* Spec §5 — persistent shell for every /dashboard/* route.
   - Sidebar 240px, collapsible to 64px icon-only, hidden below lg (where the
     bottom tab bar takes over).
   - Top bar 56px: page title left, credit chip + account menu right.
   - Content max-width 1120px, 32px padding (16px on mobile).
   - Mobile: bottom tab bar, 5 icons. */

export const SIDEBAR_COOKIE = "driplnk-sidebar";

export function DashboardShell({
  defaultCollapsed,
  creditChip,
  accountMenu,
  /* The seller area (/seller/*) and admin area (/admin/*) reuse this shell. */
  area = "creator",
  children,
}: {
  defaultCollapsed: boolean;
  creditChip: ReactNode;
  accountMenu: ReactNode;
  area?: "creator" | "seller" | "admin";
  children: ReactNode;
}) {
  const navItems =
    area === "admin" ? ADMIN_NAV_ITEMS : area === "seller" ? SELLER_NAV_ITEMS : NAV_ITEMS;
  const rootHref =
    area === "admin" ? "/admin/listings" : area === "seller" ? "/seller" : "/dashboard";

  const pathname = usePathname();

  /* The collapsed state is persisted in a cookie rather than localStorage so
     the server renders the correct width on the first paint — with
     localStorage the sidebar would flash open before an effect collapsed it. */
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"};path=/;max-age=31536000;samesite=lax`;
      return next;
    });
  }

  return (
    <div className="flex min-h-svh flex-1">
      {/* ------------------------------------------------------- Sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-line bg-canvas transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-line px-3",
            collapsed && "justify-center px-0",
          )}
        >
          <Link href="/" aria-label="DripLnk home">
            {collapsed ? (
              <span className="grid size-8 place-items-center">
                <Wordmark markOnly />
              </span>
            ) : (
              <Wordmark />
            )}
          </Link>
        </div>

        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== rootHref && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm transition-colors",
                  /* Active: accent left border + bg-tertiary (spec §5). */
                  active
                    ? "border-l-2 border-accent bg-raised pl-[10px] font-medium text-fg"
                    : "text-muted hover:bg-raised hover:text-fg",
                  collapsed && "justify-center gap-0 px-0",
                  collapsed && active && "pl-0",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-muted transition-colors hover:bg-raised hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className={cn(collapsed && "sr-only")}>Collapse</span>
          </button>
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>

      {/* -------------------------------------------------- Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas/90 px-4 backdrop-blur-md md:px-8">
          <h1 className="truncate font-display text-base font-medium text-fg">
            {titleForPath(pathname, navItems)}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {creditChip}
            {accountMenu}
          </div>
        </header>

        {/* pb-20 on mobile clears the fixed bottom tab bar. */}
        <main className="flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 lg:pb-8">
          <div className="mx-auto w-full max-w-dash">{children}</div>
        </main>
      </div>

      {/* --------------------------------------------- Mobile tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center overflow-x-auto border-t border-line bg-canvas/95 backdrop-blur-md lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== rootHref && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] min-w-[64px] flex-1 shrink-0 flex-col items-center justify-center gap-1 px-2 py-2 text-xs transition-colors",
                active ? "text-accent font-medium" : "text-muted hover:text-fg",
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              <span className="truncate text-[11px] leading-tight">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
