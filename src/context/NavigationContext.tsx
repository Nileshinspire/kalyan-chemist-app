import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb";

export interface BreadcrumbTrail {
  items: BreadcrumbItem[];
}

interface NavigationContextValue {
  /** The current breadcrumb trail */
  trail: BreadcrumbItem[];
  /** Set the breadcrumb trail for the current page */
  setTrail: (items: BreadcrumbItem[]) => void;
  /** Push an item onto the current trail (for navigating deeper) */
  pushItem: (item: BreadcrumbItem) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  trail: [],
  setTrail: () => {},
  pushItem: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

/**
 * Hook that returns the breadcrumb trail from context, with a fallback.
 * Pages can call this to get their breadcrumbs: if the context has a trail,
 * use it; otherwise fall back to static breadcrumbs.
 */
export function useBreadcrumbs(fallback: BreadcrumbItem[]): BreadcrumbItem[] {
  const { trail } = useNavigation();
  return trail.length > 0 ? trail : fallback;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [trail, setTrailState] = useState<BreadcrumbItem[]>([]);

  const setTrail = useCallback((items: BreadcrumbItem[]) => {
    setTrailState(items);
  }, []);

  const pushItem = useCallback((item: BreadcrumbItem) => {
    setTrailState((prev) => [...prev, item]);
  }, []);

  return (
    <NavigationContext.Provider value={{ trail, setTrail, pushItem }}>
      {children}
    </NavigationContext.Provider>
  );
}
