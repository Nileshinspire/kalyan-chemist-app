import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string; // If undefined, this is the current (non-clickable) page
}

/**
 * Breadcrumb component.
 *
 * Purely presentational: it renders exactly the `items` it is given.
 *
 * Breadcrumbs are NEVER stored globally and NEVER derived from navigation
 * history. Each page derives its own trail from the CURRENT route + CURRENT
 * page data and passes it here, so the trail can never go stale after a route
 * change. Every parent item is a real React Router link; the current page is
 * rendered as non-clickable text.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
      <ol className="flex min-w-0 items-center flex-wrap gap-x-1 gap-y-0.5 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-x-1">
              {i > 0 && (
                <ChevronRight className="size-3.5 text-gray-300 shrink-0" />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current="page"
                  className="font-medium text-gray-800 truncate max-w-[150px] sm:max-w-none"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-gray-400 hover:text-gray-700 transition-colors truncate max-w-[110px] sm:max-w-none"
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
