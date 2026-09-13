import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Availability state for the Download page.
 *
 * A build "exists" when the matching file has been added under
 * `public/downloads/<file>` and `public/downloads/manifest.json` lists it.
 * Adding the file + manifest entry later turns every "coming soon" state into
 * a real download with no further code changes.
 */

export const DOWNLOAD_MANIFEST: Record<string, string> = {
  "LeaFF-OS-0.9.4-arm64.dmg": "88.4 MB",
  "LeaFF-OS-0.9.4-x86_64.dmg": "94.1 MB",
  "LeaFF-OS-Setup-0.9.4-x64.exe": "92.6 MB",
  "LeaFF-OS-Portable-0.9.4-x64.zip": "86.2 MB",
  "LeaFF-OS-0.9.4.AppImage": "98.3 MB",
  "leaff-os_0.9.4_amd64.deb": "78.9 MB",
  "DripLnk-Companion-1.2.0.apk": "34.2 MB",
};

export function isDownloadAvailable(filename: string): boolean {
  return Boolean(DOWNLOAD_MANIFEST[filename]);
}

/**
 * Download button that renders as a clear "build not published yet" state when
 * the file isn't in the manifest — never a dead 404 link. If an href is given
 * explicitly (external store, CDN, GitHub Releases) the file check is skipped.
 */
export function DownloadButton({
  filename,
  label,
  href,
  variant = "primary",
}: {
  filename: string;
  label: string;
  /** Explicit destination that bypasses the availability check. */
  href?: string;
  variant?: "primary" | "secondary";
}) {
  if (href) {
    return (
      <ButtonLink href={href} size="md" variant={variant} className="w-full">
        <Download className="size-4" aria-hidden="true" />
        {label}
      </ButtonLink>
    );
  }

  if (!isDownloadAvailable(filename)) {
    return (
      <div
        className="flex w-full flex-col gap-1.5"
        aria-label={`${label} — coming soon`}
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-raised px-4 text-sm font-medium text-faint opacity-80"
        >
          <Download className="size-4" aria-hidden="true" />
          {label}
        </button>
        <p className="text-center font-mono text-[11px] text-faint">
          Coming soon — build not published yet
        </p>
      </div>
    );
  }

  return (
    <ButtonLink href={`/downloads/${filename}`} size="md" variant={variant} className="w-full">
      <Download className="size-4" aria-hidden="true" />
      {label}
    </ButtonLink>
  );
}

/** Small inline badge for cards whose distribution is an external store. */
export function StorePendingBadge({ children }: { children: string }) {
  return (
    <p className={cn("text-center font-mono text-[11px] text-faint")}>{children}</p>
  );
}

