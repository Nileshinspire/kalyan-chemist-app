import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export interface BreadcrumbItem {
  label: string;
  href?: string; // If undefined, this is the current (non-clickable) page
}

/**
 * Context-aware Breadcrumb component.
 *
 * Reads the current breadcrumb trail from NavigationContext.
 * If a trail is set (via useSetBreadcrumb), uses it.
 * Otherwise falls back to the `items` prop (static breadcrumbs).
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { trail } = useNavigation();

  // Use context trail if available, otherwise fall back to prop items
  const displayItems = trail.length > 0 ? trail : items;

  if (!displayItems || displayItems.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
      <ol className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-sm">
        {displayItems.map((item, i) => {
          const isLast = i === displayItems.length - 1;
          return (
            <li key={i} className="flex items-center gap-x-1">
              {i > 0 && (
                <ChevronRight className="size-3.5 text-gray-300 shrink-0" />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current="page"
                  className="font-medium text-gray-800 truncate max-w-[200px] sm:max-w-none"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-gray-400 hover:text-gray-700 transition-colors truncate max-w-[160px] sm:max-w-none"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
