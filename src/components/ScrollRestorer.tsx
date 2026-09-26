import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

/** Scrolls to top on every route change. This fixes the issue where
 *  clicking footer links appears broken because the scroll position
 *  stays at the bottom of the previous page.
 *
 *  Uses a layout effect so the reset happens before the browser paints the
 *  new route — otherwise the incoming page would briefly render at the old
 *  scroll offset, which reads as a stutter/wait when navigating. */
export default function ScrollRestorer() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
