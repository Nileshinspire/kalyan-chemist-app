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

  useEffect(() => {
    const incomingTrail =
      (location.state as any)?.breadcrumbTrail as BreadcrumbItem[] | undefined;

    if (incomingTrail && incomingTrail.length > 0) {
      // Build trail: incoming parent items + current page (non-clickable)
      const trail = [
        ...incomingTrail.map((item) => ({ ...item })), // clone to avoid mutation
        { label: currentItem.label }, // current page is always non-clickable
      ];
      setTrail(trail);
    } else if (fallback && fallback.length > 0) {
      // No incoming trail — use fallback (direct URL access)
      setTrail(fallback);
    } else {
      // No trail at all — clear (root page behavior)
      setTrail([]);
    }
  }, [location.state, currentItem.label, fallback, setTrail]);
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
