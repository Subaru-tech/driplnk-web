"use client";

import { useEffect, useRef } from "react";
import { INTRO, buildElapsedMs, introSeconds, setLogoAnchor } from "@/lib/intro";

/**
 * The hero visual: the DripLnk Core — a bed-slinger 3D printer drawn as a
 * dead-on front elevation, printing a companion robot that rotates 360° as it builds.
 *
 * Deliberate choices:
 *   · The MACHINE never rotates or tilts. A front elevation is the reading
 *     people recognise instantly, so the silhouette does the work.
 *   · Only the ROBOT rotates. All the motion in the frame belongs to the part.
 *   · The robot is stacked horizontal layer lines — exactly what a real print
 *     looks like head-on. As it spins, the 3D features orbit and
 *     each layer's width changes; that width change IS the rotation.
 *   · The control screen shows the animation's real build percentage, so the
 *     machine is never reporting a number that contradicts what you see.
 *
 * All generated. No screenshots, no stock renders, no 3D library.
 */

const LAYERS = 104;
const BUILD_SECONDS = 15;
const SPIN_SECONDS = 10;

/* --- machine, in model units (x right, y up, origin at floor centre) -----
   Proportions are held to the dimensions the drawing labels: the frame is
   380mm tall (frameTop + barH = 268 units) and 360mm wide, so the width has
   to be 268 × 360/380 = 254 units. The earlier 172 made it a third narrower
   than its own callout claimed.
   Scale: 268 units = 380mm, i.e. ~0.705 units per mm. */
const M = {
  baseW: 254,
  baseH: 48,
  postX: 108,
  postW: 14,
  frameTop: 252,
  barH: 16,
  bedY: 64,
  bedW: 186,
  /* 190mm at the scale above. Capped by the frame, not chosen freely: the
     gantry has to carry the whole hotend above the top layer, so the build
     height can only be (frameTop − bedY − NOZZLE_DROP − clearance). At 148 the
     head punched through the crossbar once the nozzle was aligned properly. */
  printH: 134,
  spool: { x: 166, y: 134, r: 34 },
};

/** Model units from the gantry beam's origin down to the nozzle tip. */
const NOZZLE_DROP = 42;

/* Assembly choreography.
   Groups are ordered strictly BOTTOM-TO-TOP by the height they occupy, and
   every part rises into place from below — the machine builds itself the same
   way the print on it does.

   MUST satisfy  STAGGER * (ORDERS - 1) + DUR <= INTRO.ASSEMBLE_END, or the
   last part is still moving when printing starts.
   Eight orders: 0.14 * 7 + 0.8 = 1.78s, inside the 1.8s budget. */
const ASSEMBLY_STAGGER = 0.14;
const ASSEMBLY_DUR = 0.8;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/**
 * Smooth ease-out, no overshoot.
 *
 * An easeOutBack here made parts snap past their resting place and bounce
 * back, which reads as jittery when eight of them overlap. A plain quartic
 * decelerates continuously and settles clean.
 */
const easeOutSmooth = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - (1 - p) ** 4;
};

/**
 * The DripLnk monogram, as canvas paths.
 *
 * Byte-identical to the `d` attributes in components/marketing/wordmark.tsx —
 * one shape, two renderers. Built lazily because Path2D doesn't exist during
 * server rendering.
 */
const MARK_D_PATH =
  "M5 0 H35.2 A25.4 25.4 0 0 1 35.2 50.8 H5 Z M21.8 16.7 H33.7 A8.8 8.8 0 0 1 33.7 34.3 H21.8 Z";
const MARK_L_PATH = "M0 6.8 L15.5 20.7 V50.8 H56 V68 H0 Z";

const BBOX = {
  left: -M.baseW / 2 - 4,
  right: M.spool.x + M.spool.r + 6,
  top: M.frameTop + 28,
  bottom: -12,
};

type Rgb = [number, number, number];

function readRgb(styles: CSSStyleDeclaration, name: string, fallback: Rgb): Rgb {
  const raw = styles.getPropertyValue(name).trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  if (hex.length !== 6) return fallback;
  const v = Number.parseInt(hex, 16);
  return Number.isNaN(v) ? fallback : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/* --- the 3D robot companion ---------------------------------------------- */
type PartMaterial =
  | "armor"
  | "dark"
  | "visor"
  | "eye-cyan"
  | "eye-amber"
  | "gold"
  | "cyan"
  | "raft";

type Slice = {
  cx: number;
  cz: number;
  r: number;
  rx_r?: number;
  rz_r?: number;
  mat: PartMaterial;
};

/**
 * 3D parametric sliced geometry of the robot companion.
 * All features satisfy 0 <= t <= 0.94 and stay strictly within the print volume.
 */
function crossSections(t: number): Slice[] {
  const out: Slice[] = [];

  // 1. Bed Raft / Brim (t < 0.02)
  if (t < 0.02) {
    out.push({ cx: 0, cz: 0.01, r: 0.22, mat: "raft" });
  }

  // 2. Feet & Soles (t: 0.012 to 0.085)
  if (t >= 0.012 && t < 0.085) {
    const isSole = t < 0.032;
    const mat: PartMaterial = isSole ? "dark" : "armor";
    const footScale = 1 - (t - 0.012) * 2.2;
    const fw = 0.046 * (0.85 + 0.15 * footScale);
    const fl = 0.070 * (0.85 + 0.15 * footScale);
    for (const s of [-1, 1]) {
      out.push({
        cx: s * 0.085,
        cz: 0.015,
        r: fw,
        rx_r: fw,
        rz_r: fl,
        mat,
      });
      if (isSole) {
        out.push({
          cx: s * 0.085,
          cz: -0.025,
          r: fw * 0.75,
          rx_r: fw * 0.75,
          rz_r: fl * 0.35,
          mat: "dark",
        });
      }
    }
  }

  // 3. Ankles & Shins (t: 0.085 to 0.21)
  if (t >= 0.085 && t < 0.21) {
    const isAnkle = t < 0.115;
    for (const s of [-1, 1]) {
      if (isAnkle) {
        out.push({ cx: s * 0.082, cz: 0.005, r: 0.028, mat: "dark" });
      } else {
        const k = (t - 0.115) / (0.21 - 0.115);
        const calfFlare = 1 + Math.sin(k * Math.PI) * 0.25;
        const sw = 0.034 * calfFlare;
        const sl = 0.038 * calfFlare;
        out.push({
          cx: s * 0.080,
          cz: 0.005,
          r: sw,
          rx_r: sw,
          rz_r: sl,
          mat: "armor",
        });
        out.push({
          cx: s * 0.080,
          cz: -0.022 * calfFlare,
          r: 0.016,
          mat: "dark",
        });
      }
    }
  }

  // 4. Knee Joints (t: 0.21 to 0.25)
  if (t >= 0.21 && t < 0.25) {
    for (const s of [-1, 1]) {
      out.push({ cx: s * 0.078, cz: 0.008, r: 0.030, mat: "dark" });
      out.push({ cx: s * 0.078, cz: 0.028, r: 0.022, mat: "armor" });
    }
  }

  // 5. Thighs (t: 0.25 to 0.34)
  if (t >= 0.25 && t < 0.34) {
    const k = (t - 0.25) / (0.34 - 0.25);
    const legX = 0.076 - k * 0.012;
    for (const s of [-1, 1]) {
      out.push({
        cx: s * legX,
        cz: 0.005,
        r: 0.036,
        rx_r: 0.035,
        rz_r: 0.038,
        mat: "armor",
      });
      out.push({
        cx: s * (legX - 0.015),
        cz: 0.002,
        r: 0.018,
        mat: "dark",
      });
    }
  }

  // 6. Hands (t: 0.26 to 0.33)
  if (t >= 0.26 && t < 0.33) {
    for (const s of [-1, 1]) {
      out.push({
        cx: s * 0.162,
        cz: 0.012,
        r: 0.025,
        rx_r: 0.024,
        rz_r: 0.028,
        mat: "armor",
      });
      out.push({
        cx: s * 0.156,
        cz: 0.010,
        r: 0.014,
        mat: "dark",
      });
    }
  }

  // 7. Forearms & Wrists (t: 0.33 to 0.42)
  if (t >= 0.33 && t < 0.42) {
    const isWrist = t < 0.35;
    for (const s of [-1, 1]) {
      if (isWrist) {
        out.push({ cx: s * 0.160, cz: 0.008, r: 0.022, mat: "dark" });
      } else {
        const k = (t - 0.35) / (0.42 - 0.35);
        const faW = 0.028 + k * 0.006;
        out.push({
          cx: s * 0.160,
          cz: 0.005,
          r: faW,
          rx_r: faW,
          rz_r: faW * 1.1,
          mat: "armor",
        });
      }
    }
  }

  // 8. Pelvis & Lower Abdomen (t: 0.33 to 0.43)
  if (t >= 0.33 && t < 0.43) {
    const k = (t - 0.33) / (0.43 - 0.33);
    const pW = 0.065 + k * 0.025;
    out.push({
      cx: 0,
      cz: 0,
      r: pW,
      rx_r: pW,
      rz_r: 0.048,
      mat: "dark",
    });
    if (t < 0.39) {
      out.push({
        cx: 0,
        cz: 0.028,
        r: 0.028,
        mat: "armor",
      });
    }
  }

  // 9. Midriff / Waist (t: 0.43 to 0.47)
  if (t >= 0.43 && t < 0.47) {
    out.push({
      cx: 0,
      cz: 0,
      r: 0.082,
      rx_r: 0.085,
      rz_r: 0.052,
      mat: "dark",
    });
  }

  // 10. Torso & Upper Chest (t: 0.47 to 0.57)
  if (t >= 0.47 && t < 0.57) {
    const k = (t - 0.47) / (0.57 - 0.47);
    const cW = 0.092 + Math.sin(k * Math.PI) * 0.026;
    const cL = 0.068 + Math.sin(k * Math.PI) * 0.018;

    out.push({
      cx: 0,
      cz: 0.005,
      r: cW,
      rx_r: cW,
      rz_r: cL,
      mat: "armor",
    });

    out.push({
      cx: 0,
      cz: 0,
      r: cW * 0.88,
      rx_r: cW * 0.88,
      rz_r: cL * 0.85,
      mat: "dark",
    });

    if (t >= 0.49 && t < 0.54) {
      out.push({
        cx: 0,
        cz: 0.076,
        r: 0.022,
        mat: "gold",
      });
      out.push({
        cx: 0,
        cz: 0.078,
        r: 0.012,
        mat: "eye-amber",
      });
    }

    out.push({
      cx: 0,
      cz: -0.075,
      r: 0.045,
      rx_r: 0.058,
      rz_r: 0.030,
      mat: "dark",
    });
    for (const s of [-1, 1]) {
      out.push({
        cx: s * 0.035,
        cz: -0.095,
        r: 0.012,
        mat: "cyan",
      });
    }
  }

  // 11. Elbows, Biceps & Shoulders (t: 0.42 to 0.56)
  if (t >= 0.42 && t < 0.56) {
    for (const s of [-1, 1]) {
      if (t < 0.46) {
        out.push({ cx: s * 0.160, cz: 0, r: 0.022, mat: "dark" });
      } else if (t < 0.49) {
        out.push({ cx: s * 0.158, cz: 0.002, r: 0.025, mat: "armor" });
      } else {
        const sk = (t - 0.49) / (0.56 - 0.49);
        const sr = 0.036 * Math.sin(sk * Math.PI);
        if (sr > 0.008) {
          out.push({ cx: s * 0.155, cz: 0.005, r: sr, mat: "armor" });
          out.push({ cx: s * 0.138, cz: 0.002, r: sr * 0.6, mat: "dark" });
        }
      }
    }
  }

  // 12. Neck (t: 0.57 to 0.61)
  if (t >= 0.57 && t < 0.61) {
    out.push({ cx: 0, cz: 0.005, r: 0.038, mat: "dark" });
    out.push({ cx: 0, cz: 0.005, r: 0.046, mat: "armor" });
  }

  // 13. Head & Helmet (t: 0.61 to 0.91)
  if (t >= 0.61 && t < 0.91) {
    const headCenterY = 0.755;
    const headRadiusY = 0.145;
    const dy = (t - headCenterY) / headRadiusY;
    if (Math.abs(dy) < 1) {
      const headProfile = Math.sqrt(1 - dy * dy);
      const headW = 0.182 * headProfile;
      const headL = 0.175 * headProfile;

      out.push({
        cx: 0,
        cz: 0.005,
        r: headW,
        rx_r: headW,
        rz_r: headL,
        mat: "armor",
      });

      if (t >= 0.65 && t < 0.85) {
        const vDy = (t - 0.745) / 0.095;
        if (Math.abs(vDy) < 1) {
          const vProfile = Math.sqrt(1 - vDy * vDy);
          const vW = 0.142 * vProfile;
          const vL = 0.078 * vProfile;

          out.push({
            cx: 0,
            cz: 0.088,
            r: vW,
            rx_r: vW,
            rz_r: vL,
            mat: "visor",
          });

          if (t >= 0.69 && t < 0.79) {
            const eDy = (t - 0.740) / 0.045;
            if (Math.abs(eDy) < 1) {
              const eRadius = 0.034 * Math.sqrt(1 - eDy * eDy);
              out.push({
                cx: -0.058,
                cz: 0.145,
                r: eRadius,
                mat: "eye-cyan",
              });
              out.push({
                cx: 0.058,
                cz: 0.145,
                r: eRadius,
                mat: "eye-amber",
              });
            }
          }
        }
      }

      if (t >= 0.70 && t < 0.81) {
        const earDy = (t - 0.755) / 0.052;
        if (Math.abs(earDy) < 1) {
          const earR = 0.038 * Math.sqrt(1 - earDy * earDy);
          for (const s of [-1, 1]) {
            out.push({
              cx: s * (headW + 0.012),
              cz: 0.008,
              r: earR,
              mat: "armor",
            });
            out.push({
              cx: s * (headW + 0.016),
              cz: 0.008,
              r: earR * 0.75,
              mat: "cyan",
            });
            out.push({
              cx: s * (headW + 0.018),
              cz: 0.008,
              r: earR * 0.40,
              mat: "gold",
            });
          }
        }
      }
    }
  }

  // 14. Top Crest (t: 0.90 to 0.94)
  if (t >= 0.90 && t < 0.94) {
    const crestDy = (t - 0.915) / 0.022;
    if (Math.abs(crestDy) < 1) {
      const cW = 0.032 * Math.sqrt(1 - crestDy * crestDy);
      out.push({
        cx: 0,
        cz: 0.025,
        r: cW,
        rx_r: cW,
        rz_r: 0.018,
        mat: "cyan",
      });
    }
  }

  return out;
}

export function PrintCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;
    const HEAD_START = BUILD_SECONDS * 1000 * 0.55;
    let startedAt = performance.now() - HEAD_START;

    const rootStyles = getComputedStyle(document.documentElement);
    let cream = readRgb(rootStyles, "--accent", [255, 255, 255]);
    let foliage = readRgb(rootStyles, "--accent-2", [0, 194, 255]);
    let machine = readRgb(rootStyles, "--machine", [143, 160, 181]);
    let bark = readRgb(rootStyles, "--bark", [255, 120, 46]);
    let brass = readRgb(rootStyles, "--brass", [245, 158, 11]);
    let logoPaper = readRgb(rootStyles, "--logo-paper", [255, 255, 255]);
    let logoInk = readRgb(rootStyles, "--logo-ink", [255, 120, 46]);

    /* Path2D is browser-only, so build inside the effect. */
    const MARK_D = new Path2D(MARK_D_PATH);
    const MARK_L = new Path2D(MARK_L_PATH);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      /* Layout may not have resolved on the first synchronous pass. Writing a
         zero-size backing store here would blank the canvas permanently if the
         frame loop is also throttled, so hold the previous size and let a
         later draw pick it up. */
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /**
     * Re-sync if the element's box has drifted from the backing store.
     *
     * ResizeObserver notifications are delivered with the rendering steps, so
     * anything that stalls those (a backgrounded tab, a throttled frame loop)
     * can leave the backing store sized for a previous viewport — and the
     * scene then draws at the wrong scale and position. Checking here makes
     * the canvas self-healing instead of dependent on observer timing.
     */
    const syncSize = () => {
      if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
    };

    /* Straight orthographic front view — no yaw, no pitch, ever. */
    let unit = 1;
    let originX = 0;
    let originY = 0;
    const sx = (x: number) => originX + x * unit;
    const sy = (y: number) => originY - y * unit;
    const lw = (w: number) => Math.max(0.75, w * unit * 0.55);

    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: Rgb,
      stroke: number,
      fill: number,
      radius = 0,
      strokeW = 1.5,
    ) => {
      ctx.beginPath();
      const px = sx(x);
      const py = sy(y + h);
      const pw = w * unit;
      const ph = h * unit;
      if (radius > 0 && "roundRect" in ctx) ctx.roundRect(px, py, pw, ph, radius * unit);
      else ctx.rect(px, py, pw, ph);
      if (fill > 0) {
        ctx.fillStyle = rgba(color, fill);
        ctx.fill();
      }
      if (stroke > 0) {
        ctx.strokeStyle = rgba(color, stroke);
        ctx.lineWidth = lw(strokeW);
        ctx.stroke();
      }
    };

    const circle = (
      cx: number,
      cy: number,
      r: number,
      color: Rgb,
      stroke: number,
      fill = 0,
      strokeW = 1.4,
    ) => {
      ctx.beginPath();
      ctx.arc(sx(cx), sy(cy), r * unit, 0, Math.PI * 2);
      if (fill > 0) {
        ctx.fillStyle = rgba(color, fill);
        ctx.fill();
      }
      if (stroke > 0) {
        ctx.strokeStyle = rgba(color, stroke);
        ctx.lineWidth = lw(strokeW);
        ctx.stroke();
      }
    };

    const seg = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: Rgb,
      alpha: number,
      w = 1,
    ) => {
      ctx.beginPath();
      ctx.moveTo(sx(x1), sy(y1));
      ctx.lineTo(sx(x2), sy(y2));
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = lw(w);
      ctx.stroke();
    };

    const label = (
      text: string,
      x: number,
      y: number,
      size: number,
      color: Rgb,
      alpha: number,
      align: CanvasTextAlign = "left",
    ) => {
      const px = size * unit;
      if (px < 5) return; // below this it's mud, not detail
      ctx.font = `${px}px ui-monospace, "SFMono-Regular", monospace`;
      ctx.fillStyle = rgba(color, alpha);
      ctx.textBaseline = "middle";
      ctx.textAlign = align;
      ctx.fillText(text, sx(x), sy(y));
      ctx.textAlign = "left";
    };

    const draw = (now: number) => {
      syncSize();
      /* Nothing to draw into yet — keep the loop alive and try next frame. */
      if (width === 0 || height === 0) {
        if (running && !reduceMotion) frame = requestAnimationFrame(draw);
        return;
      }
      /* Intro sequence: the machine assembles from scattered parts before any
         printing starts. `introT` is Infinity whenever the intro isn't playing
         (reduced motion, repeat visit, skipped), which makes every assembly
         progress resolve to 1 and costs nothing in the steady state. */
      const introT = reduceMotion ? Number.POSITIVE_INFINITY : introSeconds(now);
      const assembling = introT < INTRO.ASSEMBLE_END;

      const elapsed = reduceMotion
        ? BUILD_SECONDS * 1000
        : buildElapsedMs(now, now - startedAt);
      const cycle = BUILD_SECONDS + 3;
      const build = reduceMotion ? 1 : Math.min(1, ((elapsed / 1000) % cycle) / BUILD_SECONDS);
      const spin = reduceMotion
        ? 0.9
        : ((elapsed / 1000) % SPIN_SECONDS) * ((Math.PI * 2) / SPIN_SECONDS);

      ctx.clearRect(0, 0, width, height);

      /* Breakpoints come from the VIEWPORT, not the canvas box. The canvas is
         inset by the scrollbar, so canvas-width breakpoints disagree with the
         CSS `lg:`/`md:` ones by a few pixels — which silently flips the
         machine into the wrong layout right at 1024. */
      const vw = window.innerWidth;
      const wide = vw >= 1024;
      const medium = !wide && vw >= 768;

      /* Wide layouts draw dimension callouts, which sit outside the machine —
         reserve that space in the fit box so they can't clip. */
      /* One fit box for every layout now that the dimension callouts are gone
         — nothing extends past the machine, so no extra margin to reserve.
         The machine gains that reclaimed space. */
      const bbox = BBOX;
      const modelH = bbox.top - bbox.bottom;
      const modelW = bbox.right - bbox.left;
      /* Narrow screens can't fit a full machine AND the whole copy block, so
         the machine shrinks and sits hard against the bottom edge — sized so
         the ROBOT specifically clears the CTA row, since the robot is the part
         worth seeing. */
      /* The tablet band only started being reached once breakpoints moved to
         viewport width (the canvas box is ~15px narrower, so 768 used to fall
         through to the narrow branch). Its numbers are tuned here for the
         first time: 0.44 put the helmet 11px into the CTA row. */
      const bboxCx = (bbox.left + bbox.right) / 2;

      if (wide) {
        const topSafe = 68; // comfortably below 64px navbar
        const bottomSafe = 100; // room for the Get a Print Quote button directly below the printer
        const rightSafe = 24;
        const availH = Math.max(160, height - topSafe - bottomSafe);

        // Safe left boundary to prevent overlapping the hero copy block
        const textRightBound = Math.min(width * 0.46, 600);
        const availW = Math.max(160, width - textRightBound - rightSafe);

        // Scale printer to fit inside available height with bottomSafe clearance
        unit = Math.min(availH / modelH, availW / modelW, 2.35);

        const machineW = modelW * unit;
        const machineH = modelH * unit;

        // Position horizontally: right-aligned inside safe area without overlapping copy
        const rightEdge = width - rightSafe;
        const machineLeft = Math.max(textRightBound, rightEdge - machineW);
        originX = machineLeft - bbox.left * unit;

        // Position vertically: align near topSafe so machine ends cleanly above bottomSafe
        const topEdge = topSafe + 8;
        originY = topEdge + bbox.top * unit;
      } else {
        const heightFrac = medium ? 0.35 : 0.25;
        const widthFrac = 0.88;
        unit = Math.min((height * heightFrac) / modelH, (width * widthFrac) / modelW);
        originX = width * 0.5 - bboxCx * unit;
        originY = height * 0.80;
      }

      /* ---- assembly ------------------------------------------------------
         Each subassembly flies in from its own direction, tumbling as it goes,
         and locks into place. Staggered so the machine builds bottom-up: base,
         then the uprights, the crossbar, the bed, and finally the moving parts.
         When a group's progress hits 1 the transform is skipped entirely, so
         the finished machine draws exactly as it did before. */
      const gp = (order: number) => {
        if (!Number.isFinite(introT)) return 1;
        const start = order * ASSEMBLY_STAGGER;
        return clamp01((introT - start) / ASSEMBLY_DUR);
      };

      const group = (
        order: number,
        pivotX: number,
        pivotY: number,
        dx: number,
        dy: number,
        rot: number,
        body: () => void,
      ) => {
        const raw = gp(order);
        /* Shortcut on RAW progress: once a part has landed it draws with no
           transform at all, so the finished machine costs nothing. */
        if (raw >= 1) {
          body();
          return;
        }
        if (raw <= 0) return;
        const p = easeOutSmooth(raw);
        ctx.save();
        /* Fade in over the first third of the rise, then hold solid — a part
           that is still translucent as it lands looks like a ghost. */
        ctx.globalAlpha = clamp01(raw * 3);
        const px = sx(pivotX);
        const py = sy(pivotY);
        ctx.translate(px + dx * (1 - p) * unit, py + dy * (1 - p) * unit);
        ctx.rotate(rot * (1 - p));
        ctx.translate(-px, -py);
        body();
        ctx.restore();
      };

      const built = Math.floor(build * LAYERS);
      const printed = (built / LAYERS) * M.printH;

      /* ---- what the head is actually printing right now -------------------
         The nozzle has to know the CURRENT layer's real extent before it can
         move, otherwise it just sweeps a fixed arc and spends half its time
         extruding over thin air. Compute the live layer's silhouette here so
         both the head and the bead can be driven from it. */
      const cosS = Math.cos(spin);
      const sinS = Math.sin(spin);
      const ROBOT_SCALE = M.printH * 0.98;

      const liveT = LAYERS > 1 ? Math.min(1, built / (LAYERS - 1)) : 0;
      const liveSpans: { a: number; b: number }[] = [];
      for (const s of crossSections(liveT)) {
        const rx = (s.cx * cosS - s.cz * sinS) * ROBOT_SCALE;
        const rx_r = s.rx_r ?? s.r;
        const rz_r = s.rz_r ?? s.r;
        const hw = Math.sqrt((rx_r * cosS) ** 2 + (rz_r * sinS) ** 2) * ROBOT_SCALE;
        liveSpans.push({ a: rx - hw, b: rx + hw });
      }
      const layerMin = liveSpans.length ? Math.min(...liveSpans.map((s) => s.a)) : 0;
      const layerMax = liveSpans.length ? Math.max(...liveSpans.map((s) => s.b)) : 0;
      const detail = unit > 1.1; // only draw fine detail when it will read

      /* ==================================================== BASE + SCREEN */
      group(0, 0, M.baseH / 2, 0, 90, 0, () => {
      rect(-M.baseW / 2, 0, M.baseW, M.baseH, machine, 0.8, 0.18, 3);
      /* upper lip */
      seg(-M.baseW / 2 + 3, M.baseH - 5, M.baseW / 2 - 3, M.baseH - 5, machine, 0.4);

      /* Control screen */
      const scrX = -M.baseW / 2 + 22;
      const scrY = 10;
      const scrW = 104;
      const scrH = 28;
      rect(scrX, scrY, scrW, scrH, machine, 0.75, 0.28, 2);
      if (detail) {
        label("Robo Companion", scrX + 4, scrY + scrH - 5, 5.4, cream, 0.85);
        label("Printing...", scrX + 4, scrY + scrH - 13, 5, foliage, 0.9);
        /* progress bar reflecting the real build state */
        rect(scrX + 4, scrY + 6, scrW - 30, 4, machine, 0.55, 0.12, 1, 1);
        rect(scrX + 4, scrY + 6, (scrW - 30) * build, 4, foliage, 0, 0.9, 1);
        label(`${Math.round(build * 100)}%`, scrX + scrW - 22, scrY + 8, 5.4, cream, 0.9);
      }
      /* [17] Rotary control knob, [18] USB port, feet */
      circle(scrX + scrW + 16, scrY + scrH / 2, 9, foliage, 0.9, 0.16, 1.8);
      circle(scrX + scrW + 16, scrY + scrH / 2, 4, foliage, 0.55, 0);
      seg(scrX + scrW + 16, scrY + scrH / 2 + 4, scrX + scrW + 16, scrY + scrH / 2 + 8.5, foliage, 0.9, 1.4);
      rect(scrX + scrW + 34, scrY + 8, 10, 5, machine, 0.6, 0.14, 1);
      for (const s of [-1, 1]) rect(s * (M.baseW / 2 - 18) - 6, -9, 12, 9, machine, 0.65, 0.2, 1.5);

      if (detail) {
        /* [19] Mainboard and [20] power supply live INSIDE the base — a front
           elevation genuinely cannot see them. Rather than float them somewhere
           they don't belong, both are drawn at low alpha behind their access
           panel and vent, which is how you'd actually glimpse them. */
        rect(46, 7, 30, 22, machine, 0.35, 0.08, 1); // access panel
        rect(50, 11, 22, 14, foliage, 0.45, 0.1, 0.8); // PCB
        for (const [cx, cy, w, h] of [
          [53, 19, 5, 4],
          [61, 20, 4, 3],
          [53, 13, 3, 2],
          [66, 13, 4, 5],
        ] as const) {
          rect(cx, cy, w, h, machine, 0.5, 0.25, 0.4);
        }

        /* [20] Power supply — vent louvres, with its cooling fan behind them */
        rect(M.baseW / 2 - 50, 5, 44, 28, machine, 0.4, 0, 1.5);
        circle(M.baseW / 2 - 28, 19, 8, machine, 0.4, 0.1);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          seg(
            M.baseW / 2 - 28 + Math.cos(a) * 2,
            19 + Math.sin(a) * 2,
            M.baseW / 2 - 28 + Math.cos(a) * 7,
            19 + Math.sin(a) * 7,
            machine,
            0.35,
            0.8,
          );
        }
        for (let i = 0; i < 8; i++) {
          const vx = M.baseW / 2 - 47 + i * 5;
          seg(vx, 8, vx, 30, machine, 0.45);
        }

        /* [14] Y-axis stepper, mounted on the base front-left. */
        rect(-M.baseW / 2 + 4, 6, 16, 18, machine, 0.7, 0.2, 1.5);
        circle(-M.baseW / 2 + 12, 15, 4, machine, 0.6, 0.15);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.7;
          circle(-M.baseW / 2 + 12 + Math.cos(a) * 5.8, 15 + Math.sin(a) * 5.8, 1.1, machine, 0.5);
        }
      }

      /* [15] Corner brackets tying the uprights into the base frame. */
      if (detail) {
        for (const s of [-1, 1]) {
          const bx = s * M.postX;
          seg(bx - s * 12, M.baseH + 1, bx + s * 8, M.baseH + 1, machine, 0.55, 1.4);
          seg(bx - s * 12, M.baseH + 1, bx - s * 12, M.baseH + 11, machine, 0.55, 1.4);
          circle(bx - s * 8, M.baseH + 6, 1.6, machine, 0.45);
        }
      }

      });

      /* ========================================================= UPRIGHTS */
      /* Left and right swing in from their own sides. */
      for (const s of [-1, 1]) {
        group(2, s * M.postX, (M.baseH + M.frameTop) / 2, 0, 120, 0, () => {
          const x = s * M.postX - M.postW / 2;
          rect(x, M.baseH, M.postW, M.frameTop - M.baseH, machine, 0.85, 0.16, 2);
          if (detail) {
            /* aluminium extrusion channels */
            seg(x + M.postW * 0.32, M.baseH + 4, x + M.postW * 0.32, M.frameTop - 4, machine, 0.3);
            seg(x + M.postW * 0.68, M.baseH + 4, x + M.postW * 0.68, M.frameTop - 4, machine, 0.3);
            /* corner bolts */
            circle(s * M.postX, M.baseH + 8, 2.2, machine, 0.5);
            circle(s * M.postX, M.frameTop - 8, 2.2, machine, 0.5);
          }
        });
      }

      /* [10] Z-axis lead screw — brass, threaded, on the right upright, with
         its coupler and stepper at the foot. The left upright carries a plain
         smooth rod, which is how a single-Z bed-slinger is actually built. */
      const zx = M.postX;
      group(3, zx, (M.baseH + M.frameTop) / 2, 0, 100, 0, () => {
      seg(zx, M.baseH + 10, zx, M.frameTop - 8, brass, 0.55, 2.6);
      if (detail) {
        /* thread — short diagonals up the rod */
        for (let y = M.baseH + 12; y < M.frameTop - 10; y += 5) {
          seg(zx - 2.6, y, zx + 2.6, y + 2.6, brass, 0.45, 1);
        }
        /* brass nut riding at the gantry height */
        rect(zx - 5, M.bedY + 6 + printed + 30, 10, 9, brass, 0.8, 0.3, 1);
        /* coupler + [Other] Z stepper motor */
        rect(zx - 4, M.baseH + 2, 8, 9, brass, 0.7, 0.25, 1);
        rect(zx - 10, M.baseH - 16, 20, 18, machine, 0.75, 0.22, 1.5);
        circle(zx, M.baseH - 7, 4, machine, 0.6, 0.15);
      }
      });
      /* smooth Z rod on the left */
      group(3, -M.postX, (M.baseH + M.frameTop) / 2, 0, 100, 0, () => {
        seg(-M.postX, M.baseH + 8, -M.postX, M.frameTop - 8, cream, 0.2, 1.6);
      });

      if (detail) {
        /* [Other] Limit switches. Z homes at the bottom of its travel and X at
           the left end, so each sits on the frame — not on the moving part. */
        rect(M.postX + 8, M.baseH + 12, 7, 5, machine, 0.6, 0.18, 0.8);
        rect(-M.postX - 15, M.frameTop - 30, 7, 5, machine, 0.6, 0.18, 0.8);
      }

      /* ========================================================= CROSSBAR */
      group(7, 0, M.frameTop + M.barH / 2, 0, 130, 0, () => {
        rect(-M.postX - M.postW / 2, M.frameTop, M.postX * 2 + M.postW, M.barH, machine, 0.85, 0.2, 2);
      });

      /* ============================================================== BED */
      const plateY = M.bedY;
      group(1, 0, plateY, 0, 90, 0, () => {
      rect(-M.bedW / 2, plateY, M.bedW, 6, machine, 0.9, 0.3, 1);
      /* build surface grid — the only grid in the design, under the print */
      for (let i = 1; i < 12; i++) {
        const gx = -M.bedW / 2 + (i / 12) * M.bedW;
        seg(gx, plateY + 5.5, gx, plateY + 1, machine, 0.32);
      }
      /* [14] Y carriage under the plate */
      rect(-M.bedW / 2 + 10, plateY - 7, M.bedW - 20, 7, machine, 0.6, 0.16, 1);

      if (detail) {
        /* [13] Bed springs + [12] levelling knobs at each corner */
        for (const s of [-1, 1]) {
          const kx = s * (M.bedW / 2 - 18);
          /* compression spring drawn as a zigzag */
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const yy = plateY - 1 - i * 1.1;
            const xx = kx + (i % 2 === 0 ? -2.4 : 2.4);
            if (i === 0) ctx.moveTo(sx(xx), sy(yy));
            else ctx.lineTo(sx(xx), sy(yy));
          }
          ctx.strokeStyle = rgba(machine, 0.6);
          ctx.lineWidth = lw(1.1);
          ctx.stroke();
          circle(kx, plateY - 11, 3.4, machine, 0.7, 0.2);
        }

        /* [14] Y-axis rail and timing belt beneath the carriage */
        seg(-M.bedW / 2 + 4, plateY - 10, M.bedW / 2 - 4, plateY - 10, machine, 0.4, 1.4);
        for (let i = 0; i < 22; i++) {
          const bx = -M.bedW / 2 + 8 + (i / 22) * (M.bedW - 16);
          seg(bx, plateY - 13, bx + 1.3, plateY - 13, cream, 0.22, 1);
        }
        /* [Other] Y limit switch at the end of travel */
        rect(M.bedW / 2 - 8, plateY - 16, 7, 5, machine, 0.6, 0.18, 0.8);
        /* [14] Y idler pulley at the far end of the belt loop */
        circle(-M.bedW / 2 + 6, plateY - 11, 3.4, brass, 0.65, 0.2);
      }

      });

      /* ============================================== X GANTRY + RAILS */
      /* Derived from the layer being deposited, not a standalone offset.
         The two were computed independently before, which left the nozzle a
         constant 24 units BELOW the top of the print — buried inside the model
         instead of riding on it. Anchoring the gantry to the top layer plus
         the nozzle drop makes the tip land exactly on the layer it's laying. */
      const topLayerY = M.bedY + 6 + printed;
      const gantryY = topLayerY + NOZZLE_DROP;
      group(5, 0, gantryY, 0, 100, 0, () => {
      rect(-M.postX, gantryY, M.postX * 2, 10, machine, 0.9, 0.24, 1.5);
      if (detail) {
        /* twin linear rails and the belt run */
        seg(-M.postX + 3, gantryY + 8, M.postX - 3, gantryY + 8, machine, 0.45);
        seg(-M.postX + 3, gantryY + 2, M.postX - 3, gantryY + 2, machine, 0.45);
        for (let i = 0; i < 26; i++) {
          const bx = -M.postX + 5 + (i / 26) * (M.postX * 2 - 10);
          seg(bx, gantryY + 5.2, bx + 1.4, gantryY + 5.2, cream, 0.28, 1);
        }
        /* [Other] X stepper motor, left end — body, shaft, mount bolts */
        rect(-M.postX - 4, gantryY - 4, 16, 18, machine, 0.75, 0.22, 1.5);
        circle(-M.postX + 4, gantryY + 5, 3.4, machine, 0.65, 0.18);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.7;
          circle(-M.postX + 4 + Math.cos(a) * 5.6, gantryY + 5 + Math.sin(a) * 5.6, 1, machine, 0.5);
        }
        /* [8] Idler pulley + belt tensioner, right end */
        circle(M.postX - 5, gantryY + 5, 5, brass, 0.7, 0.18);
        circle(M.postX - 5, gantryY + 5, 1.8, machine, 0.6, 0.3);
        seg(M.postX + 1, gantryY + 5, M.postX + 8, gantryY + 5, machine, 0.55, 1.4);
        circle(M.postX + 9, gantryY + 5, 2, machine, 0.6, 0.2);
      }

      });

      /* ======================================================= PRINT HEAD */
      /* The head traverses the CURRENT layer rather than a fixed arc, so it
         stays over the part: a tight wiggle across the trunk, a wide sweep
         across the canopy. A small floor keeps it visibly working even on the
         narrowest layers. */
      const layerMid = (layerMin + layerMax) / 2;
      const layerAmp = Math.max((layerMax - layerMin) / 2, M.bedW * 0.05);
      const sweep = reduceMotion ? -0.45 : Math.sin((elapsed / 1000) * 2.4);
      const headX = layerMid + sweep * layerAmp;

      /* Extruding only counts when the nozzle is over material — off the part
         it's a travel move, and the bead should go cold. */
      const overMaterial = liveSpans.some((s) => headX >= s.a - 1 && headX <= s.b + 1);
      group(6, headX, gantryY - 14, 0, 110, 0, () => {
      /* carriage backplate */
      rect(headX - 17, gantryY - 30, 34, 32, machine, 0.9, 0.26, 2);
      /* fan shroud + radial grille */
      rect(headX - 13, gantryY - 26, 26, 22, machine, 0.85, 0.3, 2);
      circle(headX, gantryY - 15, 8.5, machine, 0.85, 0.12);
      if (detail) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          seg(
            headX + Math.cos(a) * 3,
            gantryY - 15 + Math.sin(a) * 3,
            headX + Math.cos(a) * 8,
            gantryY - 15 + Math.sin(a) * 8,
            machine,
            0.5,
            0.8,
          );
        }
        circle(headX, gantryY - 15, 2.4, machine, 0.7, 0.3);
        /* [9] V-wheel rollers riding the X rail */
        for (const o of [-11, 0, 11]) {
          circle(headX + o, gantryY + 5, 2.6, machine, 0.65, 0.2);
        }
        /* [7] Heatsink fins between the cold end and the heat block */
        for (let i = 0; i < 5; i++) {
          seg(headX - 8, gantryY - 30 + i * 1.9, headX + 8, gantryY - 30 + i * 1.9, machine, 0.45);
        }
        /* [Other] Toolhead cooling duct, angled down at the part */
        ctx.beginPath();
        ctx.moveTo(sx(headX - 13), sy(gantryY - 24));
        ctx.lineTo(sx(headX - 17), sy(gantryY - 33));
        ctx.lineTo(sx(headX - 10), sy(gantryY - 35));
        ctx.lineTo(sx(headX - 7), sy(gantryY - 27));
        ctx.closePath();
        ctx.fillStyle = rgba(machine, 0.22);
        ctx.fill();
        ctx.strokeStyle = rgba(machine, 0.7);
        ctx.lineWidth = lw(1.2);
        ctx.stroke();
        /* warning label */
        rect(headX + 7, gantryY - 25, 5, 5, foliage, 0.6, 0.2, 0.5);
      }
      /* [7] Heat block */
      rect(headX - 5, gantryY - 34, 10, 8, machine, 0.85, 0.35, 1);

      if (detail) {
        /* [6] Direct-drive extruder: stepper body bolted to the carriage,
           with its drive gear at the filament path. Direct drive means the
           motor rides ON the head — that's what makes it visible at all. */
        rect(headX + 13, gantryY - 24, 16, 17, machine, 0.8, 0.24, 1.5);
        circle(headX + 21, gantryY - 15.5, 4, brass, 0.7, 0.25);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.7;
          circle(headX + 21 + Math.cos(a) * 6, gantryY - 15.5 + Math.sin(a) * 6, 1, machine, 0.45);
        }
        /* [21] Hotend cooling fan — separate from the part-cooling fan,
           blowing across the heatsink to stop heat creep. */
        circle(headX - 16, gantryY - 11, 4.5, machine, 0.75, 0.16);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          seg(
            headX - 16 + Math.cos(a) * 1.6,
            gantryY - 11 + Math.sin(a) * 1.6,
            headX - 16 + Math.cos(a) * 4.2,
            gantryY - 11 + Math.sin(a) * 4.2,
            machine,
            0.5,
            0.8,
          );
        }
      }
      ctx.beginPath();
      ctx.moveTo(sx(headX - 5), sy(gantryY - 34));
      ctx.lineTo(sx(headX + 5), sy(gantryY - 34));
      ctx.lineTo(sx(headX), sy(gantryY - 42));
      ctx.closePath();
      ctx.fillStyle = rgba(cream, 0.9);
      ctx.fill();

      });

      /* ================================================== CABLE CHAIN */
      if (detail) {
        const links = 16;
        for (let i = 0; i <= links; i++) {
          const k = i / links;
          const cxp = headX + (M.postX * 0.15 - headX) * k;
          const cyp =
            gantryY + 8 + Math.sin(k * Math.PI) * 26 + (M.frameTop - gantryY - 8) * k * k;
          rect(cxp - 2, cyp - 1.6, 4, 3.2, machine, 0.55, 0.18, 0.6, 1);
        }
      }

      /* =========================================================== ROBOT */
      const robotBase = plateY + 6;
      const beadWidth = Math.max(1.8, (M.printH / LAYERS) * unit * 1.45);

      /* Nothing prints until the machine exists. */
      const robotLayers = assembling ? 0 : built;
      for (let i = 0; i < robotLayers; i++) {
        const t = i / (LAYERS - 1);
        const y = robotBase + t * M.printH;
        const heat = Math.max(0, 1 - (built - i) / 7);
        const isLive = i === built - 1;

        const slices = crossSections(t)
          .map((s) => {
            const rx_r = s.rx_r ?? s.r;
            const rz_r = s.rz_r ?? s.r;
            const hw = Math.sqrt((rx_r * cosS) ** 2 + (rz_r * sinS) ** 2) * ROBOT_SCALE;
            return {
              ...s,
              rx: s.cx * cosS - s.cz * sinS,
              rz: s.cx * sinS + s.cz * cosS,
              hw,
            };
          })
          .sort((a, b) => a.rz - b.rz);

        for (const s of slices) {
          let base: Rgb;
          let glow = false;
          switch (s.mat) {
            case "armor":
              base = [244, 246, 252]; // solid clean white ceramic armor
              break;
            case "dark":
              base = [34, 40, 52]; // dark graphite titanium chassis
              break;
            case "visor":
              base = [12, 14, 20]; // deep glossy black face visor
              break;
            case "eye-cyan":
              base = [0, 235, 255]; // electric laser cyan glowing eye
              glow = true;
              break;
            case "eye-amber":
              base = [255, 170, 42]; // warm solar amber glowing eye
              glow = true;
              break;
            case "gold":
              base = brass; // golden brass/amber chest emblem ring & ear hub
              break;
            case "cyan":
              base = foliage; // laser cyan accent ring & head crest
              glow = true;
              break;
            case "raft":
              base = [75, 88, 108]; // print bed brim raft
              break;
            default:
              base = cream;
          }

          const color = mix(base, cream, heat * heat);
          const depth = glow ? 1.0 : (0.75 + 0.25 * Math.max(0, (s.rz + 0.25) / 0.5));
          const alpha = glow
            ? 1.0
            : Math.min(1, (0.88 + 0.12 * heat) * Math.max(0.65, depth));
          const cx = s.rx * ROBOT_SCALE;
          const halfW = s.hw;

          if (glow) {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = rgba(base, 0.9);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(sx(cx - halfW), sy(y));
            ctx.lineTo(sx(cx + halfW), sy(y));
            ctx.strokeStyle = rgba(color, 1.0);
            ctx.lineWidth = beadWidth * 1.15;
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(sx(cx - halfW), sy(y));
            ctx.lineTo(sx(cx + halfW), sy(y));
            ctx.strokeStyle = rgba(color, alpha);
            ctx.lineWidth = beadWidth;
            ctx.stroke();
          }

          /* The bead the nozzle is laying right now: a short hot segment of
             the live layer directly under the tip. This is what visually ties
             the head to the print — without it the layer just appears whole. */
          if (isLive && overMaterial) {
            const w = Math.max(3, ROBOT_SCALE * 0.045);
            const a = Math.max(cx - halfW, headX - w);
            const b = Math.min(cx + halfW, headX + w);
            if (b > a) {
              ctx.beginPath();
              ctx.moveTo(sx(a), sy(y));
              ctx.lineTo(sx(b), sy(y));
              ctx.strokeStyle = rgba(cream, 0.98);
              ctx.lineWidth = beadWidth * 1.15;
              ctx.stroke();
            }
          }
        }
      }
      ctx.lineCap = "butt";

      /* Molten bead at the nozzle. Hot and blooming while extruding; dim and
         unlit on a travel move, which is the tell that the head is repositioning
         rather than laying material. */
      ctx.save();
      ctx.shadowBlur = overMaterial ? 18 : 0;
      ctx.shadowColor = rgba(cream, 1);
      ctx.fillStyle = rgba(cream, overMaterial ? 1 : 0.4);
      ctx.beginPath();
      ctx.arc(
        sx(headX),
        sy(gantryY - 43),
        Math.max(1.8, 2.4 * unit * 0.6) * (overMaterial ? 1 : 0.7),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();

      /* ================================================ SPOOL (side arm) */
      group(4, M.spool.x, M.spool.y, 0, 90, 0, () => {
      /* mounting arm off the right upright */
      rect(M.postX, M.spool.y - 4, M.spool.x - M.postX - 8, 8, machine, 0.7, 0.2, 1);
      circle(M.spool.x, M.spool.y, M.spool.r, machine, 0.85, 0.1, 1.8);
      circle(M.spool.x, M.spool.y, M.spool.r * 0.32, machine, 0.7, 0.22);
      circle(M.spool.x, M.spool.y, M.spool.r * 0.12, machine, 0.8, 0.4);
      if (detail) {
        /* filament windings */
        for (let i = 0; i < 5; i++) {
          circle(M.spool.x, M.spool.y, M.spool.r * (0.42 + i * 0.11), foliage, 0.3, 0, 0.8);
        }
      }
      /* filament run: spool → top of frame → down to the head */
      ctx.beginPath();
      ctx.moveTo(sx(M.spool.x - M.spool.r * 0.7), sy(M.spool.y + M.spool.r * 0.7));
      ctx.quadraticCurveTo(
        sx(M.postX + 14),
        sy(M.frameTop + 26),
        sx(headX + 6),
        sy(gantryY + 4),
      );
      ctx.strokeStyle = rgba(foliage, 0.5);
      ctx.lineWidth = lw(1.4);
      ctx.stroke();
      });

      if (running && !reduceMotion) frame = requestAnimationFrame(draw);
    };

    /* Paint frame zero synchronously — rAF never fires in a background tab. */
    resize();
    draw(performance.now());
    if (!reduceMotion) frame = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(canvas);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running && !reduceMotion) {
          running = true;
          startedAt = performance.now() - HEAD_START;
          frame = requestAnimationFrame(draw);
        } else if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    visibility.observe(canvas);

    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!reduceMotion) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const themeObserver = new MutationObserver(() => {
      const next = getComputedStyle(document.documentElement);
      cream = readRgb(next, "--accent", cream);
      foliage = readRgb(next, "--accent-2", foliage);
      machine = readRgb(next, "--machine", machine);
      bark = readRgb(next, "--bark", bark);
      brass = readRgb(next, "--brass", brass);
      logoPaper = readRgb(next, "--logo-paper", logoPaper);
      logoInk = readRgb(next, "--logo-ink", logoInk);
      draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
