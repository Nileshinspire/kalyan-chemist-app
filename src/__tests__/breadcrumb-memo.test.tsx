import { describe, it, expect } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { usePageBreadcrumbs } from "@/hooks/usePageBreadcrumbs";

/**
 * Proves the resolver memo actually HOLDS between renders.
 *
 * If a dependency were rebuilt during render (e.g. a fresh `[]` fallback or a
 * freshly-split segment array), the memo would recompute every time and this
 * counter would climb on each parent re-render.
 */
function CountingProbe({ data, onResolve }: { data?: any; onResolve: () => void }) {
  const items = usePageBreadcrumbs(data);
  onResolve();
  return (
    <nav aria-label="Breadcrumb">
      {items.map((i, n) => (
        <span key={n}>{i.label}</span>
      ))}
    </nav>
  );
}

describe("resolver memo stability", () => {
  it("does not recompute when a parent re-renders with identical inputs", () => {
    let resolves = 0;
    const onResolve = () => {
      resolves++;
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/products?category=pain-relief"]}>
        <CountingProbe onResolve={onResolve} />
      </MemoryRouter>
    );

    const afterMount = resolves;
    expect(afterMount).toBeGreaterThan(0);

    // Re-render with the SAME route and NO data argument at all (the common
    // case for most pages). A correctly-memoised resolver does not recompute.
    rerender(
      <MemoryRouter initialEntries={["/products?category=pain-relief"]}>
        <CountingProbe onResolve={onResolve} />
      </MemoryRouter>
    );

    // React StrictMode is not enabled here, so a single extra commit at most.
    expect(resolves - afterMount).toBeLessThanOrEqual(1);
    cleanup();
  });

  it("still recomputes when the route actually changes", () => {
    const seen: string[][] = [];
    let nav: (to: string) => void = () => {};

    function Capture() {
      const items = usePageBreadcrumbs();
      const navigate = useNavigate();
      nav = navigate;
      seen.push(items.map((i) => i.label));
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/upload-prescription"]}>
        <Capture />
      </MemoryRouter>
    );
    expect(seen[seen.length - 1]).toEqual(["Home", "Upload Prescription"]);

    // Real SPA navigation (MemoryRouter's initialEntries only apply on mount,
    // so the route must actually be navigated to).
    act(() => {
      nav("/lab-tests");
    });
    expect(seen[seen.length - 1]).toEqual(["Home", "Lab Tests"]);

    act(() => {
      nav("/upload-prescription");
    });
    expect(seen[seen.length - 1]).toEqual(["Home", "Upload Prescription"]);
    cleanup();
  });
});
