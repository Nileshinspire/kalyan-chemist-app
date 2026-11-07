import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, MapPinOff } from "lucide-react";
import { getGoogleMapsApiKey, loadGoogleMaps } from "@/lib/googleMaps";

export function LiveDeliveryMap({
  latitude,
  longitude,
  label = "Delivery partner",
  heightClass = "h-64 sm:h-80",
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  label?: string;
  heightClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const hasKey = Boolean(getGoogleMapsApiKey());
  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const externalUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null;

  useEffect(() => {
    if (!hasKey || !hasCoords) return;
    let cancelled = false;
    setStatus("loading");

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        const position = { lat: latitude as number, lng: longitude as number };
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: position,
            zoom: 16,
            clickableIcons: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          markerRef.current = new google.maps.Marker({
            position,
            map: mapRef.current,
            title: label,
          });
        } else {
          markerRef.current?.setPosition(position);
          mapRef.current.panTo(position);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [hasKey, hasCoords, latitude, longitude, label]);

  if (!hasCoords) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 text-center ${heightClass}`}
      >
        <MapPinOff className="size-6 text-muted-foreground/60" />
        <p className="max-w-xs text-xs text-muted-foreground">
          Waiting for the delivery partner&apos;s GPS location. The map updates as soon
          as the first location arrives.
        </p>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 text-center ${heightClass}`}
      >
        <MapPinOff className="size-6 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">Live map unavailable</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {import.meta.env.DEV
            ? "Add VITE_GOOGLE_MAPS_API_KEY in the project's Keys settings to enable the Google Map."
            : "You can still open the delivery partner's latest location in Google Maps."}
        </p>
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open latest location <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/60 bg-muted/30 ${heightClass}`}
    >
      <div ref={containerRef} className="h-full w-full" aria-label={label} />
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading Google Map…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-4 text-center">
          <MapPinOff className="size-6 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">Map could not load</p>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open latest location <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
