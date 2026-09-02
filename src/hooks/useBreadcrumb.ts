import { useEffect } from "react";
import { useLocation } from "react-router";
import { useNavigation } from "@/context/NavigationContext";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb";

/**
 * Hook to set the current page's breadcrumb trail.
 *
 * Reads the incoming trail from `location.state?.breadcrumbTrail`,
 * appends the current page item, and sets the trail in NavigationContext.
 *
 * @param currentItem - This page's breadcrumb item (label + optional href)
 * @param fallback - Static breadcrumbs if no trail was passed (e.g. direct URL access)
 */
export function useSetBreadcrumb(
  currentItem: BreadcrumbItem,
  fallback?: BreadcrumbItem[]
) {
  const location = useLocation();
  const { setTrail } = useNavigation();

  // Stable key for the fallback so the effect only runs when the actual
  // items change, not on every render (inline arrays create new refs).
  const fallbackKey = fallback ? JSON.stringify(fallback) : "";

  useEffect(() => {
    const incomingTrail =
      (location.state as any)?.breadcrumbTrail as BreadcrumbItem[] | undefined;

    if (incomingTrail && incomingTrail.length > 0) {
      // Build trail: incoming parent items + current page (non-clickable)
      // Avoid duplicates: if the incoming trail already ends with the current page label,
      // don't append it again.
      const lastIncoming = incomingTrail[incomingTrail.length - 1];
      const hasCurrentPage = lastIncoming && lastIncoming.label === currentItem.label;
      const trail = hasCurrentPage
        ? incomingTrail.map((item) => ({ ...item })) // clone to avoid mutation
        : [
            ...incomingTrail.map((item) => ({ ...item })),
            { label: currentItem.label },
          ];
      setTrail(trail);
    } else if (fallback && fallback.length > 0) {
      // No incoming trail — use fallback (direct URL access)
      setTrail(fallback);
    } else {
      // No trail at all — clear (root page behavior)
      setTrail([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, currentItem.label, fallbackKey, setTrail]);
}

/**
 * Helper to navigate to a child page while preserving the breadcrumb trail.
 * Pass the current trail + the next item as location.state.breadcrumbTrail.
 */
export function getBreadcrumbState(
  currentTrail: BreadcrumbItem[],
  nextItem: BreadcrumbItem
) {
  return {
    state: {
      breadcrumbTrail: [...currentTrail, { label: nextItem.label, href: nextItem.href }],
    },
  };
}
