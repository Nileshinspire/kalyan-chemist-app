import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* ═══════════════════════════════════════════════════════════════════
   PROPORTIONAL VIEWPORT SCALING

   The desktop composition is the master design. Instead of reflowing it on
   small screens (columns collapsing, sections stacking, navigation being
   rebuilt), the whole 1280px desktop canvas is rendered once and scaled as a
   single unit with `transform: scale()` from the top-left corner.

   Everything inside — type, cards, images, gaps, icons, 3D scenes, smoke,
   animations — keeps its exact desktop geometry and its exact relationships;
   only the overall scale factor changes, so a phone shows the same page
   rather than a different one.

   · DESKTOP CANVAS = 1280px (Tailwind `max-w-7xl`, the width the desktop
     design is already built around). At >= 1280px no transform is applied at
     all, so desktop/laptop rendering is byte-for-byte what it always was.
   · Below 1280px: scale = viewportWidth / 1280, and the surrounding element's
     height is set to (canvasHeight x scale) so the document still scrolls
     exactly to the end of the page.
   · Viewport-height utilities (min-h-screen / h-screen) are re-pointed at
     `--kc-vh` (= 100vh / scale) by the rules in index.css, otherwise a
     full-height section would come out `scale` times too short and leave the
     page unpainted.
   ═══════════════════════════════════════════════════════════════════ */

/** Canonical desktop design width. */
export const DESIGN_WIDTH = 1280;

type ScaleState = { scaled: boolean; scale: number };

const ViewportScaleContext = createContext<ScaleState>({ scaled: false, scale: 1 });

/** Read-only access to the active scale (1 on desktop). */
export function useViewportScale(): ScaleState {
  return useContext(ViewportScaleContext);
}

function readScale(): number {
  if (typeof window === "undefined") return 1;
  // clientWidth excludes the vertical scrollbar, so the scaled canvas is fitted
  // to the width the page can actually use rather than to a few pixels too much.
  const vw = document.documentElement.clientWidth || window.innerWidth || DESIGN_WIDTH;
  if (!vw || vw >= DESIGN_WIDTH) return 1;
  return vw / DESIGN_WIDTH;
}

export default function ViewportScale({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(readScale);
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scaled = scale < 1;

  /* Re-measure on resize and on orientation change. `visualViewport` is also
     observed so mobile browsers that report a stale innerWidth during
     rotation still settle on the right factor. */
  useEffect(() => {
    const update = () => setScale(readScale());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  /* Keep the document height equal to the visually scaled height of the
     canvas, so normal page scrolling still ends exactly at the bottom of the
     page. `offsetHeight` is the unscaled layout height, which is what we want
     to multiply. A ResizeObserver catches async content (images, charts,
     route changes) without polling on every scroll. */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const outer = outerRef.current;
    if (!scaled || !canvas || !outer) return;

    const sync = () => {
      outer.style.height = `${Math.ceil(canvas.offsetHeight * scale)}px`;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(canvas);
    window.addEventListener("load", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", sync);
    };
  }, [scaled, scale]);

  const outerStyle: CSSProperties | undefined = scaled
    ? { position: "relative", width: "100%" }
    : undefined;

  const canvasStyle: CSSProperties | undefined = scaled
    ? ({
        position: "absolute",
        top: 0,
        left: 0,
        width: `${DESIGN_WIDTH}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        // Makes container-query units (cqw) resolve against the design canvas
        // instead of the device viewport, so fluid type scales with the page.
        containerType: "inline-size",
        "--kc-scale": scale,
        "--kc-vh": `calc(100vh / ${scale})`,
      } as CSSProperties)
    : undefined;

  return (
    <ViewportScaleContext.Provider value={{ scaled, scale }}>
      <div ref={outerRef} className={scaled ? "kc-scaler" : undefined} style={outerStyle}>
        <div ref={canvasRef} className={scaled ? "kc-canvas" : undefined} style={canvasStyle}>
          {children}
        </div>
      </div>
    </ViewportScaleContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEWPORT-FIXED LAYER

   A transformed ancestor becomes the containing block for `position: fixed`
   descendants, so inside the scaled canvas a "fixed" element would be pinned
   to the 1280px canvas instead of to the visible viewport. Anything that must
   stay genuinely viewport-anchored — floating action buttons, full-screen
   overlays, dialog-style modals, progress bars — is rendered through this
   component, which moves it to <body> only while scaling is active. On
   desktop it renders inline exactly as before.

   These layers keep native device sizing on purpose: a control that has to be
   tapped stays finger-sized and correctly positioned rather than being scaled
   down to a fraction of its size.
   ═══════════════════════════════════════════════════════════════════ */
export function FixedToViewport({ children }: { children: ReactNode }) {
  const { scaled } = useViewportScale();

  if (!scaled || typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}
