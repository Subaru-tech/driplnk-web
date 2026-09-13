/**
 * Intro sequence clock.
 *
 * The opening animation spans two rendering worlds — the printer assembles on
 * a <canvas>, then the logo flies out of it and lands as a DOM element in the
 * nav. Both need the same clock, and the canvas reads it every frame, so this
 * is a plain module singleton rather than React state: routing 60fps progress
 * through a re-render would be pointless work.
 */

/**
 * Sequence timing.
 *
 * Total is 3.1s, down from 4.4s. Long intros read as amateur — the visitor is
 * held at the door while nothing they came for is on screen — and past about
 * three seconds a flourish becomes an obstacle. Every beat here is doing work.
 *
 * The phases deliberately OVERLAP rather than running end to end. MARK_IN
 * starts while the last parts are still settling, so the badge is already
 * arriving as the machine finishes. Strictly serial phases are the tell of
 * animation assembled from a list rather than choreographed.
 */
export const INTRO = {
  /** Parts rise bottom-to-top and lock together. */
  ASSEMBLE_END: 1.35,
  /** Monogram starts arriving BEFORE assembly finishes — overlap on purpose. */
  MARK_IN_START: 1.05,
  MARK_IN_END: 1.75,
  /** "DripLnk" wipes on beside it. */
  WORD_IN_END: 2.15,
  /** Brief beat to let the badged machine read. */
  HOLD_END: 2.25,
  /** Logo travels from the crossbar up to the nav. */
  FLY_END: 2.85,
  /** Nav wordmark settles. Sequence over. */
  DONE: 3.1,
} as const;

/** Coarse stage, mirrored onto <html data-intro-stage> for CSS to hook. */
export type IntroStage = "assembling" | "branding" | "handoff" | "done";

export function introStage(t: number): IntroStage {
  if (!Number.isFinite(t)) return "done";
  if (t < INTRO.ASSEMBLE_END) return "assembling";
  if (t < INTRO.HOLD_END) return "branding";
  if (t < INTRO.DONE) return "handoff";
  return "done";
}

/** Where the canvas is currently drawing the crossbar badge, in viewport px. */
export type LogoAnchor = { x: number; y: number; height: number };

type State = {
  /** performance.now() at sequence start, or null when not playing. */
  startedAt: number | null;
  anchor: LogoAnchor | null;
  /**
   * Whether the sequence has run to COMPLETION for this page load.
   *
   * It must mean "finished", not "started". React Strict Mode double-invokes
   * effects in development: the first run starts the sequence, the cleanup
   * cancels its frame loop, and the second run then sees the flag. If the flag
   * meant "started", that second run skips to the end and kills the clock —
   * which is exactly how this animation silently never played.
   *
   * Deliberately module state, not sessionStorage: module state dies with the
   * document, so a refresh replays the intro (what "opening the site" means)
   * while a client-side route change back to home does not.
   */
  completed: boolean;
};

const state: State = { startedAt: null, anchor: null, completed: false };

export function startIntro(now: number) {
  state.startedAt = now;
}

/** True once the sequence has actually finished (or been skipped). */
export function introCompleted(): boolean {
  return state.completed;
}

/** True while a clock is already running — a remount should resume, not restart. */
export function introRunning(): boolean {
  return state.startedAt !== null;
}

/** Seconds into the sequence. Infinity when it never ran or was skipped. */
export function introSeconds(now: number): number {
  return state.startedAt === null ? Number.POSITIVE_INFINITY : (now - state.startedAt) / 1000;
}

/** Jump to the end — used for reduced motion, remounts after completion, and skips. */
export function endIntro() {
  state.startedAt = null;
  state.anchor = null;
  state.completed = true;
}

export function setLogoAnchor(anchor: LogoAnchor | null) {
  state.anchor = anchor;
}

export function getLogoAnchor(): LogoAnchor | null {
  return state.anchor;
}

/** The build only starts once the machine exists. */
export function buildElapsedMs(now: number, fallbackElapsed: number): number {
  if (state.startedAt === null) return fallbackElapsed;
  return Math.max(0, now - state.startedAt - INTRO.ASSEMBLE_END * 1000);
}
