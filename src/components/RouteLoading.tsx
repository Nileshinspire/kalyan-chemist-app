/** Shared, minimal loading indicator for the few lazy routes that still need a
 *  Suspense boundary (rare/auth/admin screens). Customer routes are bundled
 *  eagerly, so this is never shown during normal shopping navigation. */
export default function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="size-12 rounded-xl bg-primary/10 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading…
        </p>
      </div>
    </div>
  );
}
