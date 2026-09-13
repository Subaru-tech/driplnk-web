/**
 * Applies the saved theme before first paint so a light-mode user never sees a
 * dark flash. Dark is the default when nothing is stored — per spec §1.1,
 * light mode is a toggle, so we deliberately do NOT read prefers-color-scheme.
 *
 * Also stamps `data-js`, which is what gates the scroll-reveal system's hidden
 * starting state. If scripting is unavailable this attribute never lands, and
 * every revealed element renders visible instead of stranded at opacity 0.
 */
const script = `(function(){var r=document.documentElement;r.dataset.js="1";try{var t=localStorage.getItem("driplnk-theme");r.dataset.theme=t==="light"?"light":"dark"}catch(e){}})()`;

export function ThemeScript() {
  /*
   * suppressHydrationWarning is load-bearing here, not a papered-over bug.
   *
   * Script-blocking and popup-blocking browser extensions rewrite inline
   * <script> tags before React hydrates — replacing the inline body with a
   * `src` pointing at their own bundle. React then compares its server HTML
   * against that mutated DOM and reports a mismatch we neither caused nor can
   * prevent. It also can't be "patched up", because the script has already
   * either run or been neutralised by the time hydration happens.
   *
   * Suppressing is safe because this element is write-once and inert after
   * first paint: React never re-renders it, and nothing reads from it. If the
   * extension does neutralise the script, `data-js` simply never lands and the
   * reveal system falls back to showing all content immediately — which is
   * exactly what that flag is scoped to guarantee.
   *
   * Note this does NOT cascade: suppressHydrationWarning applies only to the
   * element it's set on, so the one on <html> in layout.tsx does not cover
   * this script.
   *
   * The `type` switch is the fix Next's "preventing flash before hydration"
   * guide prescribes: React warns in development whenever a render produces a
   * <script> tag, because a script inserted by a client render never executes.
   * That warning is correct in general and irrelevant here — this script has
   * already run during HTML parsing, long before React touches it. Marking the
   * client-side copy `text/plain` makes that explicit: on the server it is real
   * JavaScript the browser runs before first paint, and on the client it is
   * inert text React can render without warning. `suppressHydrationWarning`
   * covers the resulting type mismatch.
   */
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
