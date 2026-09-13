"use client";

import { useEffect, useRef } from "react";
import { DripLnkMark } from "@/components/marketing/wordmark";
import {
  INTRO,
  endIntro,
  getLogoAnchor,
  introCompleted,
  introRunning,
  introSeconds,
  startIntro,
} from "@/lib/intro";

/**
 * Opening sequence orchestrator.
 *
 * Runs the DOM half of the intro and owns whether it plays at all. The canvas
 * half — parts scattering in, the badge landing on the crossbar — reads the
 * same clock from lib/intro.
 *
 * The last beat crosses rendering worlds: the canvas stops painting the badge
 * and this component picks it up as a real DOM element at the exact same
 * screen position, flies it to the nav logo's slot, then hands over to the
 * real nav logo. DOM rather than canvas because the flyer has to travel
 * outside the canvas box and land pixel-accurately on an element it measures.
 *
 * It plays on every page OPEN — a fresh visit or a refresh — but not when you
 * navigate back to the home page client-side, which would turn a flourish into
 * a toll booth. The gate is module state in lib/intro, which dies with the
 * document, so "page open" is exactly what it tracks. Any pointer, key or
 * wheel event skips to the end.
 *
 * No React state: the flyer's transform is written straight to the node each
 * frame. Routing 60fps through setState would re-render the tree for nothing,
 * and the lint rule against setState-in-effect exists for exactly this reason.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

export function IntroSequence() {
  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const flyer = flyerRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      endIntro();
      root.dataset.intro = "done";
      if (flyer) flyer.style.opacity = "0";
    };

    /* Reduced motion, or the sequence already FINISHED this page load (a
       client-side nav back to home): nothing animates, everything is final. */
    if (reduce || introCompleted()) {
      finish();
      return;
    }

    root.dataset.intro = "running";
    /* Only start a clock if one isn't already running. React Strict Mode
       double-invokes this effect in development — the second pass must resume
       the sequence in progress, not restart it and not skip it. */
    if (!introRunning()) startIntro(performance.now());

    let raf = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      finish();
    };

    window.addEventListener("pointerdown", stop, { once: true });
    window.addEventListener("keydown", stop, { once: true });
    window.addEventListener("wheel", stop, { once: true, passive: true });

    /* Safety net on a wall clock, not the frame loop. While the sequence is
       "running" the page holds content back, so anything that stalls rAF —
       a backgrounded tab, a throttled or crashed frame loop — could otherwise
       leave the page permanently mid-intro. setTimeout still fires in those
       conditions, so the sequence always terminates. */
    const safety = window.setTimeout(stop, (INTRO.DONE + 2) * 1000);

    const tick = () => {
      const t = introSeconds(performance.now());

      if (t >= INTRO.DONE) {
        stop();
        return;
      }

      /* Flight leg: from wherever the canvas last drew the badge, to the nav
         logo's real measured box. */
      if (t >= INTRO.HOLD_END && flyer) {
        const from = getLogoAnchor();
        const target = document.querySelector<HTMLElement>("[data-logo-target]");
        if (from && target) {
          const to = target.getBoundingClientRect();
          const p = easeInOut(
            Math.min(1, (t - INTRO.HOLD_END) / (INTRO.FLY_END - INTRO.HOLD_END)),
          );
          const h = lerp(from.height, to.height || from.height, p);
          flyer.style.height = `${h}px`;
          flyer.style.transform = `translate3d(${lerp(from.x, to.left, p)}px, ${lerp(
            from.y - from.height / 2,
            to.top,
            p,
          )}px, 0)`;
          flyer.style.opacity = "1";
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("wheel", stop);
    };
  }, []);

  return (
    <div
      ref={flyerRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[60] opacity-0 will-change-transform"
    >
      <DripLnkMark className="h-full w-auto" />
    </div>
  );
}
