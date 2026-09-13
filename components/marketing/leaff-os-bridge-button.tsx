"use client";

import { ArrowUpRight, Cpu, Download, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LeaffOsBridgeButton({
  modelId,
  modelTitle,
}: {
  modelId: string;
  modelTitle: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  function handleLaunch() {
    // Attempt to invoke the custom protocol handler
    window.location.href = `leaffos://open?model=${encodeURIComponent(modelId)}`;
    // Open the helper modal in case the desktop app is not installed
    setModalOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handleLaunch}
        className="w-full justify-center gap-2 border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent text-accent font-semibold transition-all group"
      >
        <Cpu className="size-4 text-accent transition-transform group-hover:scale-110" aria-hidden="true" />
        <span>Open in LeaFF OS</span>
        <ArrowUpRight className="size-3.5 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:text-fg hover:bg-raised"
            >
              <X className="size-5" />
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-fg">
                    Launching in LeaFF OS
                  </h3>
                  <p className="text-xs text-muted">DripLnk Desktop CAD & Slicing Suite</p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-raised/50 p-3.5 text-xs text-muted leading-relaxed">
                We signaled your browser to launch <span className="font-medium text-fg">{modelTitle}</span> inside LeaFF OS via <code className="font-mono text-[11px] text-accent">leaffos://open</code>.
              </div>

              {/* The DripLnk Loop Story */}
              <div className="flex flex-col gap-2 rounded-xl border border-line/60 bg-surface/80 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  The DripLnk Loop
                </span>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1.5 text-fg font-medium">
                    <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-contrast font-bold">1</span>
                    Acquire
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1.5 text-fg font-medium">
                    <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-contrast font-bold">2</span>
                    Edit in LeaFF
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1.5 text-fg font-medium">
                    <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-contrast font-bold">3</span>
                    Print at Mart
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <p className="text-xs text-muted text-center">
                  Don&apos;t have LeaFF OS installed yet on your computer?
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/leaff-os"
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-contrast hover:bg-accent/90 transition-colors"
                  >
                    <Download className="size-4" />
                    <span>Download LeaFF OS</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-muted hover:bg-raised hover:text-fg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
