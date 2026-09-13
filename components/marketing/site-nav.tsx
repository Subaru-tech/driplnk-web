"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/marketing/wordmark";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/cn";

const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/* Spec §3.1.1 — sticky nav, bg-primary at 90% + blur once scrolled.
   Logo left, links centre, Log In / Sign Up right.
   Mobile: hamburger → full-screen overlay menu. */

const links = [
  { href: "/leaff-os", label: "LeaFF OS" },
  { href: "/models", label: "Models" },
  { href: "/mart", label: "Get a Quote" },
  { href: "/freelance", label: "Freelance" },
  { href: "/download", label: "Download" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supabaseAuthed, setSupabaseAuthed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isClerkEnabled) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseAuthed(Boolean(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseAuthed(Boolean(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-200",
        scrolled ? "border-b border-line bg-canvas/90 backdrop-blur-md" : "bg-transparent",
      )}
    >
      {/* Print-progress rail: fills left-to-right with document scroll. Driven
          entirely by a CSS scroll timeline — no scroll listener. */}
      <div
        aria-hidden="true"
        className="scroll-rail absolute inset-x-0 bottom-0 h-px bg-accent"
      />
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-content items-center justify-between gap-6 px-6 lg:px-12"
      >
        <Link href="/" className="shrink-0" aria-label="DripLnk home">
          <Wordmark introTarget />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-sm transition-colors",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {isClerkEnabled ? (
            <>
              <Show when="signed-out">
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Log In
                </ButtonLink>
                <ButtonLink href="/sign-up" variant="primary" size="sm">
                  Sign Up
                </ButtonLink>
              </Show>
              <Show when="signed-in">
                <ButtonLink href="/dashboard" variant="secondary" size="sm">
                  Dashboard
                </ButtonLink>
                <UserButton />
              </Show>
            </>
          ) : supabaseAuthed ? (
            <ButtonLink href="/dashboard" variant="secondary" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log In
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="primary" size="sm">
                Sign Up
              </ButtonLink>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          {isClerkEnabled ? (
            <Show when="signed-in">
              <ButtonLink href="/dashboard" variant="secondary" size="sm" className="h-8 px-2.5 text-xs">
                Dashboard
              </ButtonLink>
              <UserButton />
            </Show>
          ) : supabaseAuthed ? (
            <ButtonLink href="/dashboard" variant="secondary" size="sm" className="h-8 px-2.5 text-xs">
              Dashboard
            </ButtonLink>
          ) : null}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-[var(--radius-control)] text-fg hover:bg-raised"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {/* Full-screen overlay menu — spec §3.1.1 */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 animate-fade-in bg-canvas md:hidden">
          <div className="flex h-16 items-center justify-between px-6">
            <Wordmark />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="grid size-10 place-items-center rounded-[var(--radius-control)] text-fg hover:bg-raised"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Each link closes the overlay itself — navigating to the page
              you're already on wouldn't fire a pathname change. */}
          <ul className="flex flex-col gap-2 px-6 pt-6">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={closeMenu}
                  className="block py-3 font-display text-xl text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 px-6">
            {isClerkEnabled ? (
              <>
                <Show when="signed-out">
                  <ButtonLink
                    href="/login"
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={closeMenu}
                  >
                    Log In
                  </ButtonLink>
                  <ButtonLink
                    href="/sign-up"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={closeMenu}
                  >
                    Sign Up
                  </ButtonLink>
                </Show>
                <Show when="signed-in">
                  <ButtonLink
                    href="/dashboard"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={closeMenu}
                  >
                    Go to Dashboard
                  </ButtonLink>
                  <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface p-3">
                    <span className="text-sm font-medium text-fg">Account</span>
                    <UserButton />
                  </div>
                </Show>
              </>
            ) : supabaseAuthed ? (
              <ButtonLink
                href="/dashboard"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={closeMenu}
              >
                Go to Dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink
                  href="/login"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={closeMenu}
                >
                  Log In
                </ButtonLink>
                <ButtonLink
                  href="/sign-up"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={closeMenu}
                >
                  Sign Up
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
