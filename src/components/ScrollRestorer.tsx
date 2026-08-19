import { useEffect } from "react";
import { useLocation } from "react-router";

/** Scrolls to top on every route change. This fixes the issue where
 *  clicking footer links appears broken because the scroll position
 *  stays at the bottom of the previous page. */
export default function ScrollRestorer() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
