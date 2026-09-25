"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/marketing/cookie-consent";

/** Footer "Cookie settings" button — re-opens the consent banner. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
      className="text-left text-sm text-muted transition-colors hover:text-fg"
    >
      Cookie settings
    </button>
  );
}
