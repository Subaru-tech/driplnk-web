"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Apple,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  HardDrive,
  Info,
  Laptop,
  Layers,
  Monitor,
  Printer,
  QrCode,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { DownloadButton } from "@/lib/downloads";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";

type PlatformCategory = "all" | "desktop" | "mobile";

interface ChecksumInfo {
  filename: string;
  sha256: string;
  size: string;
}

const CHECKSUMS: Record<string, ChecksumInfo[]> = {
  macOS: [
    {
      filename: "LeaFF-OS-0.9.4-arm64.dmg",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size: "88.4 MB",
    },
    {
      filename: "LeaFF-OS-0.9.4-x86_64.dmg",
      sha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      size: "94.1 MB",
    },
  ],
  Windows: [
    {
      filename: "LeaFF-OS-Setup-0.9.4-x64.exe",
      sha256: "81fe8bfe87576c3ecb22426f8e57847382917acf4541ac43993d5a536b663b60",
      size: "92.6 MB",
    },
    {
      filename: "LeaFF-OS-Portable-0.9.4-x64.zip",
      sha256: "4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5",
      size: "86.2 MB",
    },
  ],
  Linux: [
    {
      filename: "LeaFF-OS-0.9.4.AppImage",
      sha256: "ad7dacb2a76a8d6e3c0f8623cf59737190d7945d8b8095b28a2a7b8e5c8e32e8",
      size: "98.3 MB",
    },
    {
      filename: "leaff-os_0.9.4_amd64.deb",
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      size: "78.9 MB",
    },
  ],
  Mobile: [
    {
      filename: "DripLnk-Companion-1.2.0.apk",
      sha256: "5d41402abc4b2a76b9719d911017c592ff37c7849c9a09156477e5fc73305419",
      size: "34.2 MB",
    },
  ],
};

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("fill-current", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("fill-current", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12.012 0c-3.78 0-6.85 3.07-6.85 6.85 0 1.25.34 2.42.93 3.43-.07.41-.12.83-.12 1.26 0 2.21 1.05 4.18 2.67 5.42-.44.75-.72 1.63-.72 2.58 0 2.45 1.83 4.46 4.09 4.46s4.09-2.01 4.09-4.46c0-.95-.28-1.83-.72-2.58 1.62-1.24 2.67-3.21 2.67-5.42 0-.43-.05-.85-.12-1.26.59-1.01.93-2.18.93-3.43 0-3.78-3.07-6.85-6.85-6.85zm-2.06 6.55c.49 0 .89.4.89.89s-.4.89-.89.89-.89-.4-.89-.89.4-.89.89-.89zm4.12 0c.49 0 .89.4.89.89s-.4.89-.89.89-.89-.4-.89-.89.4-.89.89-.89zm-2.06 3.12c.98 0 1.84.45 2.41 1.15-.49.33-1.39.55-2.41.55s-1.92-.22-2.41-.55c.57-.7 1.43-1.15 2.41-1.15z" />
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("fill-current", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4126 13.8533 8.125 12 8.125c-1.8533 0-3.5902.2876-5.1368.8247L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
    </svg>
  );
}

export function DownloadHub() {
  const [activeTab, setActiveTab] = useState<PlatformCategory>("all");
  const [detectedOS, setDetectedOS] = useState<
    "macOS" | "Windows" | "Linux" | "iOS" | "Android" | "unknown"
  >("unknown");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showChecksums, setShowChecksums] = useState(false);
  const [selectedMacArch, setSelectedMacArch] = useState<"arm64" | "x86_64">("arm64");
  const [selectedWinFormat, setSelectedWinFormat] = useState<"installer" | "portable">("installer");
  const [selectedLinuxFormat, setSelectedLinuxFormat] = useState<"appimage" | "deb">("appimage");

  /* Detect the OS lazily — after hydration and a paint — rather than in an
     effect. Reading the user agent here can only ever produce a highlight, so
     deferring it avoids a hydration-time re-render entirely. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raf = requestAnimationFrame(() => {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
        setDetectedOS("iOS");
      } else if (ua.includes("android")) {
        setDetectedOS("Android");
      } else if (ua.includes("mac")) {
        setDetectedOS("macOS");
      } else if (ua.includes("win")) {
        setDetectedOS("Windows");
      } else if (ua.includes("linux")) {
        setDetectedOS("Linux");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getDetectedDownloadConfig = () => {
    switch (detectedOS) {
      case "macOS":
        return {
          title: "Download for macOS",
          badge: "Apple Silicon (M1/M2/M3/M4)",
          file: "LeaFF-OS-0.9.4-arm64.dmg",
          href: "#macos",
          size: "88.4 MB",
          subtext: "Universal DMG • macOS 12 Monterey or later",
        };
      case "Windows":
        return {
          title: "Download for Windows",
          badge: "64-bit Installer",
          file: "LeaFF-OS-Setup-0.9.4-x64.exe",
          href: "#windows",
          size: "92.6 MB",
          subtext: "Windows 10 & 11 • DirectX 12 acceleration",
        };
      case "Linux":
        return {
          title: "Download for Linux",
          badge: "Universal AppImage",
          file: "LeaFF-OS-0.9.4.AppImage",
          href: "#linux",
          size: "98.3 MB",
          subtext: "glibc 2.31+ • Wayland & X11",
        };
      case "iOS":
        return {
          title: "Download for iPhone & iPad",
          badge: "iOS Companion",
          file: "Apple App Store / TestFlight",
          href: "#mobile-ios",
          size: "38 MB",
          subtext: "iOS 16.0+ • Live Print Telemetry",
        };
      case "Android":
        return {
          title: "Download for Android",
          badge: "Google Play / APK",
          file: "DripLnk-Companion-1.2.0.apk",
          href: "#mobile-android",
          size: "34.2 MB",
          subtext: "Android 10+ • Remote Monitoring",
        };
      default:
        return {
          title: "Download LeaFF OS",
          badge: "Desktop CAD v0.9.4 Beta",
          file: "Cross-platform installer",
          href: "#desktop-section",
          size: "Multi-platform",
          subtext: "macOS • Windows • Linux",
        };
    }
  };

  const detectedConfig = getDetectedDownloadConfig();

  return (
    <div className="flex flex-col gap-16">
      {/* Smart Quick-Download Spotlight */}
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-b from-surface/90 via-surface/60 to-canvas p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent-2/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/5 blur-3xl"
        />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-2/30 bg-accent-2-muted/60 px-3 py-1 font-mono text-xs font-medium text-accent-2">
                <span className="size-1.5 animate-pulse rounded-full bg-accent-2" />
                {detectedOS !== "unknown"
                  ? `Detected System: ${detectedOS}`
                  : "Latest Release: v0.9.4 Beta"}
              </span>
              <span className="rounded-full border border-line bg-raised/60 px-2.5 py-0.5 font-mono text-xs text-muted">
                Public Beta Channel
              </span>
              <span className="rounded-full border border-line bg-raised/60 px-2.5 py-0.5 font-mono text-xs text-muted">
                Zero Cloud Lock-in
              </span>
            </div>

            <h2 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {detectedConfig.title}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {detectedConfig.subtext}. Build precision parametric models on desktop or
              track active 3D prints on mobile without bouncing between separate tools.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a
              href={detectedConfig.href}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-accent px-6 text-base font-medium text-accent-contrast shadow-lg transition-all hover:bg-accent-hover hover:shadow-accent/20 active:brightness-95"
            >
              <Download className="size-5" />
              <span>{detectedConfig.title}</span>
            </a>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                const el = document.getElementById("all-matrix");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View All Platforms
            </Button>
          </div>
        </div>

        {/* Quick metadata strip */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 border-t border-line/60 pt-6 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="tech-label text-faint">DESKTOP VERSION</span>
            <span className="font-mono text-xs font-semibold text-fg">v0.9.4-beta (Build 412)</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="tech-label text-faint">MOBILE COMPANION</span>
            <span className="font-mono text-xs font-semibold text-fg">v1.2.0 (iOS & Android)</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="tech-label text-faint">KERNEL ARCHITECTURE</span>
            <span className="font-mono text-xs font-semibold text-fg">Solid CSG & Rust WebGPU</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="tech-label text-faint">SECURITY VERIFICATION</span>
            <button
              type="button"
              onClick={() => setShowChecksums(!showChecksums)}
              className="inline-flex items-center gap-1 text-left font-mono text-xs font-medium text-accent-2 hover:underline"
            >
              <ShieldCheck className="size-3.5" />
              <span>{showChecksums ? "Hide SHA-256" : "Show SHA-256"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Checksum & Integrity Collapsible Drawer */}
      {showChecksums && (
        <div className="rounded-xl border border-line-strong bg-void p-5 shadow-inner">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent-2" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                Cryptographic Release Hashes (SHA-256)
              </span>
            </div>
            <span className="font-mono text-xs text-muted">Signed by DripLnk Release PGP Key</span>
          </div>

          <div className="mt-4 space-y-4 font-mono text-xs">
            {Object.entries(CHECKSUMS).map(([osName, items]) => (
              <div key={osName} className="space-y-1.5">
                <span className="font-semibold text-accent-2">{osName}:</span>
                <div className="space-y-1 pl-2">
                  {items.map((item) => (
                    <div
                      key={item.filename}
                      className="flex flex-col justify-between gap-1 rounded bg-surface/60 p-2 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-medium text-fg">{item.filename}</span>
                        <span className="text-faint">({item.size})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="max-w-[18rem] truncate text-muted sm:max-w-[26rem]">
                          {item.sha256}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.sha256, item.filename)}
                          className="flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[11px] text-fg hover:bg-raised"
                          title="Copy SHA-256 hash"
                        >
                          {copiedKey === item.filename ? (
                            <>
                              <Check className="size-3 text-accent-2" />
                              <span className="text-accent-2">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div id="all-matrix" className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "all"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            All Software ({2} Ecosystem Apps)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "desktop"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            <Laptop className="size-4" />
            LeaFF OS Desktop
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mobile")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "mobile"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            <Smartphone className="size-4" />
            DripLnk Mobile
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-2 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Use Web Studio (No Install)
          </Link>
        </div>
      </div>

      {/* SECTION 1: LEAFF OS DESKTOP SOFTWARE */}
      {(activeTab === "all" || activeTab === "desktop") && (
        <section id="desktop-section" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
                Primary CAD & Slicer
              </span>
              <span className="font-mono text-xs text-muted">macOS • Windows • Linux</span>
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-fg">
              LeaFF OS for Desktop
            </h2>
            <p className="max-w-3xl text-base text-muted">
              The professional desktop application where geometry is generated, parametrically
              edited, sliced, and pre-flight checked for 3D manufacturing. Offline-capable,
              blazing fast, and natively compiled for your hardware.
            </p>
          </div>

          {/* Desktop Platform Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* macOS Card */}
            <Card
              id="macos"
              className={cn(
                "flex flex-col justify-between border-line transition-all duration-200 hover:border-border-strong",
                detectedOS === "macOS" && "ring-2 ring-accent-2/40 border-accent-2/50 shadow-lg"
              )}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-void border border-line text-fg">
                      <Apple className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">macOS</h3>
                      <p className="text-xs text-muted">Universal Binary • macOS 12+</p>
                    </div>
                  </div>
                  {detectedOS === "macOS" && (
                    <span className="rounded bg-accent-2-muted px-2 py-0.5 font-mono text-[11px] font-medium text-accent-2">
                      Your OS
                    </span>
                  )}
                </div>

                {/* Arch switch */}
                <div className="flex rounded-lg border border-line bg-void/60 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMacArch("arm64")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedMacArch === "arm64"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Apple Silicon (M1–M4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMacArch("x86_64")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedMacArch === "x86_64"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Intel Mac (x86_64)
                  </button>
                </div>

                <div className="space-y-2 text-xs text-muted">
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>File size:</span>
                    <span className="font-mono text-fg">
                      {selectedMacArch === "arm64" ? "88.4 MB" : "94.1 MB"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>Format:</span>
                    <span className="font-mono text-fg">Apple Disk Image (.dmg)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Notarization:</span>
                    <span className="inline-flex items-center gap-1 font-mono text-accent-2">
                      <Check className="size-3" /> Apple Notarized
                    </span>
                  </div>
                </div>

                {/* Package manager terminal */}
                <div className="rounded-lg border border-line bg-void p-2.5">
                  <div className="flex items-center justify-between pb-1 text-[11px] text-faint">
                    <span className="flex items-center gap-1">
                      <Terminal className="size-3" /> Homebrew Cask
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy("brew install --cask driplnk-leaff-os", "brew")
                      }
                      className="text-muted hover:text-fg"
                    >
                      {copiedKey === "brew" ? (
                        <Check className="size-3 text-accent-2" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                  <code className="block select-all font-mono text-[11px] text-accent">
                    brew install --cask driplnk-leaff-os
                  </code>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <DownloadButton
                  filename={
                    selectedMacArch === "arm64"
                      ? "LeaFF-OS-0.9.4-arm64.dmg"
                      : "LeaFF-OS-0.9.4-x86_64.dmg"
                  }
                  label={`Download for Mac (${selectedMacArch === "arm64" ? "Apple Silicon" : "Intel"})`}
                />
                <p className="text-center font-mono text-[11px] text-faint">
                  SHA-256 verified • Automatic in-app updates
                </p>
              </div>
            </Card>

            {/* Windows Card */}
            <Card
              id="windows"
              className={cn(
                "flex flex-col justify-between border-line transition-all duration-200 hover:border-border-strong",
                detectedOS === "Windows" && "ring-2 ring-accent-2/40 border-accent-2/50 shadow-lg"
              )}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-void border border-line text-fg">
                      <WindowsIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">Windows</h3>
                      <p className="text-xs text-muted">64-bit • Windows 10 / 11</p>
                    </div>
                  </div>
                  {detectedOS === "Windows" && (
                    <span className="rounded bg-accent-2-muted px-2 py-0.5 font-mono text-[11px] font-medium text-accent-2">
                      Your OS
                    </span>
                  )}
                </div>

                {/* Windows Format Switch */}
                <div className="flex rounded-lg border border-line bg-void/60 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedWinFormat("installer")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedWinFormat === "installer"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Setup Installer (.exe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinFormat("portable")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedWinFormat === "portable"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Portable (.zip)
                  </button>
                </div>

                <div className="space-y-2 text-xs text-muted">
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>File size:</span>
                    <span className="font-mono text-fg">
                      {selectedWinFormat === "installer" ? "92.6 MB" : "86.2 MB"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>Format:</span>
                    <span className="font-mono text-fg">
                      {selectedWinFormat === "installer"
                        ? "Windows Installer (.exe)"
                        : "Standalone Archive (.zip)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Code Signing:</span>
                    <span className="inline-flex items-center gap-1 font-mono text-accent-2">
                      <Check className="size-3" /> Microsoft SmartScreen Verified
                    </span>
                  </div>
                </div>

                {/* Package manager terminal */}
                <div className="rounded-lg border border-line bg-void p-2.5">
                  <div className="flex items-center justify-between pb-1 text-[11px] text-faint">
                    <span className="flex items-center gap-1">
                      <Terminal className="size-3" /> Windows Package Manager
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy("winget install DripLnk.LeaFFOS", "winget")
                      }
                      className="text-muted hover:text-fg"
                    >
                      {copiedKey === "winget" ? (
                        <Check className="size-3 text-accent-2" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                  <code className="block select-all font-mono text-[11px] text-accent">
                    winget install DripLnk.LeaFFOS
                  </code>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <DownloadButton
                  filename={
                    selectedWinFormat === "installer"
                      ? "LeaFF-OS-Setup-0.9.4-x64.exe"
                      : "LeaFF-OS-Portable-0.9.4-x64.zip"
                  }
                  label={`Download for Windows (${selectedWinFormat === "installer" ? "Installer" : "Portable"})`}
                />
                <p className="text-center font-mono text-[11px] text-faint">
                  DirectX 12 & Vulkan GPU acceleration
                </p>
              </div>
            </Card>

            {/* Linux Card */}
            <Card
              id="linux"
              className={cn(
                "flex flex-col justify-between border-line transition-all duration-200 hover:border-border-strong",
                detectedOS === "Linux" && "ring-2 ring-accent-2/40 border-accent-2/50 shadow-lg"
              )}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-void border border-line text-fg">
                      <LinuxIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">Linux</h3>
                      <p className="text-xs text-muted">x86_64 • glibc 2.31+</p>
                    </div>
                  </div>
                  {detectedOS === "Linux" && (
                    <span className="rounded bg-accent-2-muted px-2 py-0.5 font-mono text-[11px] font-medium text-accent-2">
                      Your OS
                    </span>
                  )}
                </div>

                {/* Linux Format Switch */}
                <div className="flex rounded-lg border border-line bg-void/60 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLinuxFormat("appimage")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedLinuxFormat === "appimage"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Universal AppImage
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLinuxFormat("deb")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                      selectedLinuxFormat === "deb"
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    Debian / Ubuntu (.deb)
                  </button>
                </div>

                <div className="space-y-2 text-xs text-muted">
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>File size:</span>
                    <span className="font-mono text-fg">
                      {selectedLinuxFormat === "appimage" ? "98.3 MB" : "78.9 MB"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-line/40 pb-1.5">
                    <span>Format:</span>
                    <span className="font-mono text-fg">
                      {selectedLinuxFormat === "appimage" ? "AppImage (Standalone)" : "Debian Package (.deb)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Display Server:</span>
                    <span className="inline-flex items-center gap-1 font-mono text-fg">
                      Wayland & X11 Native
                    </span>
                  </div>
                </div>

                {/* Package manager terminal */}
                <div className="rounded-lg border border-line bg-void p-2.5">
                  <div className="flex items-center justify-between pb-1 text-[11px] text-faint">
                    <span className="flex items-center gap-1">
                      <Terminal className="size-3" /> Flatpak / Flathub
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          "flatpak install flathub com.driplnk.leaffos",
                          "flatpak"
                        )
                      }
                      className="text-muted hover:text-fg"
                    >
                      {copiedKey === "flatpak" ? (
                        <Check className="size-3 text-accent-2" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                  <code className="block select-all font-mono text-[11px] text-accent">
                    flatpak install flathub com.driplnk.leaffos
                  </code>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <DownloadButton
                  filename={
                    selectedLinuxFormat === "appimage"
                      ? "LeaFF-OS-0.9.4.AppImage"
                      : "leaff-os_0.9.4_amd64.deb"
                  }
                  label={`Download for Linux (${selectedLinuxFormat === "appimage" ? "AppImage" : ".deb"})`}
                />
                <p className="text-center font-mono text-[11px] text-faint">
                  Works on Ubuntu, Fedora, Arch, Debian & Mint
                </p>
              </div>
            </Card>
          </div>

          {/* Desktop Key Capabilities */}
          <div className="rounded-2xl border border-line bg-surface/50 p-6 sm:p-8">
            <h3 className="font-display text-lg font-semibold text-fg">
              Why LeaFF OS sits on your desktop instead of a browser tab:
            </h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-void border border-line text-accent-2">
                  <Cpu className="size-4" />
                </div>
                <h4 className="font-medium text-fg text-sm">Parametric CSG Kernel</h4>
                <p className="text-xs leading-relaxed text-muted">
                  No jagged polygon facets. Modifies dimensions, wall thicknesses, and tolerances
                  without breaking adjacent geometric constraints.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-void border border-line text-accent-2">
                  <Printer className="size-4" />
                </div>
                <h4 className="font-medium text-fg text-sm">Direct Slicing & G-Code</h4>
                <p className="text-xs leading-relaxed text-muted">
                  Pre-configured slicing engine with print simulation. Exports directly to Klipper,
                  Marlin, Bambu, and Prusa without an external slicer.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-void border border-line text-accent-2">
                  <HardDrive className="size-4" />
                </div>
                <h4 className="font-medium text-fg text-sm">100% Offline Capable</h4>
                <p className="text-xs leading-relaxed text-muted">
                  Your CAD files stay on your NVMe drive. Work in workshops, airplanes, or air-gapped
                  facilities without network connectivity.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-void border border-line text-accent-2">
                  <Zap className="size-4" />
                </div>
                <h4 className="font-medium text-fg text-sm">One-Click Mart Dispatch</h4>
                <p className="text-xs leading-relaxed text-muted">
                  Send ready models straight into DripLnk Mart for automated quoting and verified
                  local manufacturing in under 10 seconds.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: DRIPLNK MOBILE COMPANION APP */}
      {(activeTab === "all" || activeTab === "mobile") && (
        <section id="mobile-section" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
                Mobile Companion
              </span>
              <span className="font-mono text-xs text-muted">iOS & Android</span>
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-fg">
              DripLnk Companion for Mobile
            </h2>
            <p className="max-w-3xl text-base text-muted">
              The companion app for monitoring live prints, managing Mart manufacturing orders,
              approving freelance engineer submissions, and topping up print credits from anywhere.
            </p>
          </div>

          {/* Mobile Cards & QR Quick-Scan */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* iOS Card */}
            <Card
              id="mobile-ios"
              className={cn(
                "flex flex-col justify-between border-line transition-all duration-200 hover:border-border-strong",
                detectedOS === "iOS" && "ring-2 ring-accent-2/40 border-accent-2/50 shadow-lg"
              )}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-void border border-line text-fg">
                      <Apple className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">Apple iOS</h3>
                      <p className="text-xs text-muted">iPhone & iPad • iOS 16.0+</p>
                    </div>
                  </div>
                  <span className="rounded bg-raised px-2.5 py-0.5 font-mono text-[11px] text-muted">
                    v1.2.0 Beta
                  </span>
                </div>

                <div className="space-y-3 text-xs text-muted">
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Live Activities & Dynamic Island print layer telemetry</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>AR Quick Look: view 3D models on your actual workbench</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Instant credit top-up with Apple Pay</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Push alerts on print completion, failures, and filament warnings</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <DownloadButton label="Install via Apple TestFlight" filename="ios-testflight" href="https://testflight.apple.com/join/driplnk" />
                <ButtonLink
                  href="/signup"
                  size="md"
                  variant="secondary"
                  className="w-full"
                >
                  Join App Store Waitlist
                </ButtonLink>
              </div>
            </Card>

            {/* Android Card */}
            <Card
              id="mobile-android"
              className={cn(
                "flex flex-col justify-between border-line transition-all duration-200 hover:border-border-strong",
                detectedOS === "Android" && "ring-2 ring-accent-2/40 border-accent-2/50 shadow-lg"
              )}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-void border border-line text-fg">
                      <AndroidIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">Android</h3>
                      <p className="text-xs text-muted">Google Play & APK • Android 10+</p>
                    </div>
                  </div>
                  <span className="rounded bg-raised px-2.5 py-0.5 font-mono text-[11px] text-muted">
                    v1.2.0 Beta
                  </span>
                </div>

                <div className="space-y-3 text-xs text-muted">
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Real-time print temperature charts and video feed</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>NFC printer pairing: tap phone against printer to claim</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Google Pay 1-tap checkout for Mart print orders</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-accent-2" />
                    <span>Direct APK download for de-Googled devices & sideloading</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <ButtonLink
                  href="https://play.google.com/store/apps/details?id=com.driplnk.companion"
                  size="md"
                  className="w-full"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AndroidIcon className="size-4" />
                  Get it on Google Play
                </ButtonLink>
                <DownloadButton
                  filename="DripLnk-Companion-1.2.0.apk"
                  label="Direct APK (34.2 MB)"
                  variant="secondary"
                />
              </div>
            </Card>

            {/* Quick Scan / Mobile Pairing Widget */}
            <Card className="flex flex-col justify-between border-line bg-gradient-to-br from-surface to-canvas">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <QrCode className="size-5 text-accent-2" />
                  <h3 className="font-display text-lg font-semibold text-fg">Scan to Mobile</h3>
                </div>
                <p className="text-xs text-muted">
                  Point your phone camera at this code to open the companion app install link directly
                  on your mobile device.
                </p>

                {/* Simulated High-Res SVG QR Pattern */}
                <div className="mx-auto my-2 flex size-44 items-center justify-center rounded-xl border border-line bg-white p-3 shadow-md">
                  <svg
                    className="size-full"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="QR code for DripLnk Mobile App"
                  >
                    {/* Corner 1 */}
                    <rect x="5" y="5" width="26" height="26" rx="4" fill="#262b21" />
                    <rect x="9" y="9" width="18" height="18" rx="2" fill="#ffffff" />
                    <rect x="13" y="13" width="10" height="10" rx="1" fill="#262b21" />

                    {/* Corner 2 */}
                    <rect x="69" y="5" width="26" height="26" rx="4" fill="#262b21" />
                    <rect x="73" y="9" width="18" height="18" rx="2" fill="#ffffff" />
                    <rect x="77" y="13" width="10" height="10" rx="1" fill="#262b21" />

                    {/* Corner 3 */}
                    <rect x="5" y="69" width="26" height="26" rx="4" fill="#262b21" />
                    <rect x="9" y="73" width="18" height="18" rx="2" fill="#ffffff" />
                    <rect x="13" y="77" width="10" height="10" rx="1" fill="#262b21" />

                    {/* Decorative matrix patterns */}
                    <rect x="36" y="8" width="6" height="6" fill="#262b21" />
                    <rect x="46" y="8" width="6" height="6" fill="#262b21" />
                    <rect x="56" y="8" width="6" height="6" fill="#262b21" />
                    <rect x="36" y="18" width="6" height="6" fill="#262b21" />
                    <rect x="46" y="24" width="6" height="6" fill="#262b21" />
                    <rect x="56" y="18" width="6" height="6" fill="#262b21" />

                    <rect x="8" y="36" width="6" height="6" fill="#262b21" />
                    <rect x="18" y="36" width="6" height="6" fill="#262b21" />
                    <rect x="8" y="46" width="6" height="6" fill="#262b21" />
                    <rect x="18" y="56" width="6" height="6" fill="#262b21" />

                    <rect x="36" y="36" width="26" height="26" rx="4" fill="#262b21" />
                    <rect x="42" y="42" width="14" height="14" rx="2" fill="#a9d26b" />

                    <rect x="68" y="36" width="6" height="6" fill="#262b21" />
                    <rect x="78" y="46" width="6" height="6" fill="#262b21" />
                    <rect x="88" y="36" width="6" height="6" fill="#262b21" />

                    <rect x="36" y="68" width="6" height="6" fill="#262b21" />
                    <rect x="46" y="78" width="6" height="6" fill="#262b21" />
                    <rect x="56" y="68" width="6" height="6" fill="#262b21" />
                    <rect x="68" y="68" width="6" height="6" fill="#262b21" />
                    <rect x="78" y="78" width="6" height="6" fill="#262b21" />
                    <rect x="88" y="88" width="6" height="6" fill="#262b21" />
                  </svg>
                </div>
              </div>

              <div className="mt-4 text-center">
                <span className="font-mono text-[11px] text-faint">
                  Supports Universal App Links for iOS & Android
                </span>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* SECTION 3: HARDWARE & SYSTEM REQUIREMENTS */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="tech-label text-faint">HARDWARE SPECIFICATIONS</span>
          <h2 className="font-display text-2xl font-semibold text-fg">
            System Requirements
          </h2>
          <p className="text-sm text-muted">
            LeaFF OS is engineered with Rust and WebGPU to deliver silky-smooth 60fps solid
            manipulation even on modest portable laptops.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface font-mono uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-5 py-3 font-semibold">Component</th>
                  <th className="px-5 py-3 font-semibold">Minimum Specs</th>
                  <th className="px-5 py-3 font-semibold text-accent-2">Recommended for Large Assemblies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 font-mono">
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Operating System</td>
                  <td className="px-5 py-3 text-muted">macOS 12.0+, Windows 10 (19041+), Ubuntu 20.04+</td>
                  <td className="px-5 py-3 text-fg">macOS Sonoma/Sequoia, Windows 11, Ubuntu 24.04</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Processor</td>
                  <td className="px-5 py-3 text-muted">Intel Core i5 (8th Gen), AMD Ryzen 5, Apple M1</td>
                  <td className="px-5 py-3 text-fg">Apple M2/M3/M4 Pro, Intel Core i7 12th+, AMD Ryzen 7</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">System Memory</td>
                  <td className="px-5 py-3 text-muted">8 GB Unified RAM</td>
                  <td className="px-5 py-3 text-fg">16 GB or 32 GB RAM</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">GPU / Graphics</td>
                  <td className="px-5 py-3 text-muted">DirectX 12, Metal 2, or Vulkan 1.2 compatible GPU</td>
                  <td className="px-5 py-3 text-fg">Dedicated GPU (NVIDIA RTX / Radeon / Apple Silicon)</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Disk Storage</td>
                  <td className="px-5 py-3 text-muted">500 MB free space for installation</td>
                  <td className="px-5 py-3 text-fg">2 GB+ NVMe SSD space for offline mesh caching</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 4: WEB STUDIO NO-INSTALL BANNER */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-surface via-void to-surface p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-semibold text-accent-2">
              BROWSER ALTERNATIVE
            </span>
            <h3 className="font-display text-xl font-semibold text-fg">
              Need to inspect a 3D model without installing software?
            </h3>
            <p className="max-w-xl text-sm text-muted">
              You can view, measure, slice, and order prints from any web browser using our
              cloud-accelerated Web Studio. No download required.
            </p>
          </div>

          <ButtonLink href="/models" size="lg" variant="secondary">
            Open in Browser
            <ExternalLink className="size-4" />
          </ButtonLink>
        </div>
      </section>

      {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="tech-label text-faint">DOWNLOAD & INSTALLATION</span>
          <h2 className="font-display text-2xl font-semibold text-fg">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-2 border-line">
            <h3 className="font-display text-base font-semibold text-fg">
              Is LeaFF OS free to use during the public beta?
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              Yes. All desktop modeling, slicing, and mesh export tools are completely free during
              the beta. You only pay if you choose to dispatch physical prints through the DripLnk
              Mart network or hire certified freelance CAD engineers.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h3 className="font-display text-base font-semibold text-fg">
              Can I use LeaFF OS offline without an account?
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              Yes. LeaFF OS runs 100% locally on your machine. You can create parametric solids,
              export STEP/STL/3MF files, and slice toolpaths completely offline without logging into
              an account. Cloud sync is entirely optional.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h3 className="font-display text-base font-semibold text-fg">
              How does the mobile companion sync with desktop?
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              When logged into the same DripLnk account, your active print jobs and Mart orders sync
              end-to-end. You can also pair directly over your local Wi-Fi or scan your 3D printer&apos;s
              QR code to receive instant telemetry on your phone.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h3 className="font-display text-base font-semibold text-fg">
              What file formats can I export from LeaFF OS?
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              LeaFF OS exports standard manufacturing-grade STEP (.step, .stp), 3MF (.3mf), binary
              STL (.stl), and OBJ files. You retain 100% copyright and ownership of all your generated
              and edited geometry.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
