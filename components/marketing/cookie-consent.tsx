"use client";

import { useCallback, useEffect, useState } from "react";
import { setCookieConsentAction } from "@/app/consent-actions";

/**
 * Cookie consent banner.
 *
 * Contract enforced here and in the consent library:
 *  - essential/functional cookies (auth session) are always allowed;
 *  - analytics/marketing cookies are BLOCKED until the user explicitly
 *    accepts — there is no "implied consent" and no pre-ticked box;
 *  - consent is stored per-category, logged server-side with a timestamp,
 *    and can be changed later via the footer "Cookie settings" button.
 *
 * Until an analytics provider is actually integrated, "blocking" means the
 * gate in lib/consent.ts returns false — no measurement script is ever
 * injected. Any future provider must check hasConsent("analytics") before
 * loading. That invariant is what makes the DoD screenshot honest: before
 * acceptance, no non-essential storage/script exists to appear in DevTools.
 */

const CONSENT_KEY = "driplnk-cookie-consent";

export type CookieConsent = {
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of when consent was given. */
  decidedAt: string;
  version: number;
};

export const CONSENT_VERSION = 1;

export function readStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Gate for non-essential cookie/script loading. Check before ANY injection. */
export function hasConsent(category: "analytics" | "marketing"): boolean {
  return readStoredConsent()?.[category] === true;
}

/** Fired by the footer "Cookie settings" button to re-open the banner. */
export const OPEN_COOKIE_SETTINGS_EVENT = "driplnk:open-cookie-settings";

export function CookieConsentBanner() {
  const [state, setState] = useState<{
    visible: boolean;
    analytics: boolean;
    marketing: boolean;
    showChoices: boolean;
  }>({ visible: false, analytics: false, marketing: false, showChoices: false });

  useEffect(() => {
    // Read localStorage after mount so the banner never flashes during
    // hydration. Deferred with requestAnimationFrame so the setState is not
    // synchronous-with-effect (react-compiler rule), and no non-essential
    // cookie/script can run before this since nothing else reads consent.
    const raf = requestAnimationFrame(() => {
      const consent = readStoredConsent();
      if (!consent) {
        setState((s) => ({ ...s, visible: true }));
      }
    });

    const reopen = () => {
      const current = readStoredConsent();
      setState({
        visible: true,
        analytics: current?.analytics ?? false,
        marketing: current?.marketing ?? false,
        showChoices: true,
      });
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    };
  }, []);

  const visible = state.visible;
  const analytics = state.analytics;
  const marketing = state.marketing;
  const showChoices = state.showChoices;

  const persist = useCallback(async (next: { analytics: boolean; marketing: boolean }) => {
    const consent: CookieConsent = {
      ...next,
      decidedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setState((s) => ({ ...s, visible: false, showChoices: false }));
    // Best-effort server-side consent record; failure is non-blocking.
    try {
      await setCookieConsentAction({ ...next });
    } catch {
      /* consent logging is best-effort; local gate is the source of truth */
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-canvas/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-content flex-col gap-4 px-6 py-5 lg:px-12 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl text-sm text-muted">
          <p className="font-medium text-fg">Cookies on DripLnk</p>
          <p className="mt-1">
            Essential cookies keep you signed in — those are always on. Analytics and marketing
            cookies stay blocked until you accept them.{" "}
            <a href="/cookies" className="text-accent hover:underline">
              Cookie Policy
            </a>
            .
          </p>
        </div>

        {showChoices ? (
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setState((s) => ({ ...s, analytics: e.target.checked }))}
                className="size-4 accent-[var(--accent)]"
              />
              Analytics cookies
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setState((s) => ({ ...s, marketing: e.target.checked }))}
                className="size-4 accent-[var(--accent)]"
              />
              Marketing cookies
            </label>
            <button
              type="button"
              onClick={() => persist({ analytics, marketing })}
              className="self-start rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
            >
              Save choices
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, showChoices: true }))}
              className="rounded-[var(--radius-control)] border border-line-control px-4 py-2 text-sm text-fg hover:bg-raised"
            >
              Customise
            </button>
            <button
              type="button"
              onClick={() => persist({ analytics: false, marketing: false })}
              className="rounded-[var(--radius-control)] border border-line-control px-4 py-2 text-sm text-fg hover:bg-raised"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => persist({ analytics: true, marketing: true })}
              className="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
            >
              Accept all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
