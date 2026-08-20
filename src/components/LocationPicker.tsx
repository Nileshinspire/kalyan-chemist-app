import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  Crosshair,
  Loader2,
  Navigation,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
  compact?: boolean;
}

export default function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
  compact = false,
}: LocationPickerProps) {
  const [detecting, setDetecting] = useState(false);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange(
          Math.round(position.coords.latitude * 1000000) / 1000000,
          Math.round(position.coords.longitude * 1000000) / 1000000
        );
        setDetecting(false);
        toast.success("Location detected successfully");
      },
      (error) => {
        setDetecting(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location access denied. Please enable location permissions.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out. Please try again.");
            break;
          default:
            toast.error("Unable to detect location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [onLocationChange]);

  const clearLocation = useCallback(() => {
    onLocationChange(null, null);
  }, [onLocationChange]);

  const hasLocation = latitude !== null && longitude !== null;
  const mapUrl = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;
  const googleMapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={detectLocation}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Crosshair className="size-3" />
            )}
            {detecting ? "Detecting..." : "Use Current Location"}
          </Button>
          {hasLocation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={clearLocation}
            >
              Clear
            </Button>
          )}
        </div>

        {hasLocation && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3 text-primary shrink-0" />
            <span>
              {latitude}, {longitude}
            </span>
            <a
              href={googleMapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on Map <ExternalLink className="size-2.5" />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-primary" />
        <Label className="text-sm font-semibold">Delivery Location</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Pin your exact delivery location so our delivery partner can find you easily.
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={detectLocation}
        disabled={detecting}
      >
        {detecting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Crosshair className="size-3.5" />
        )}
        {detecting ? "Detecting your location..." : "Use My Current Location"}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Latitude</Label>
          <Input
            type="number"
            step="0.000001"
            placeholder="e.g. 19.0760"
            value={latitude ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onLocationChange(
                val ? parseFloat(val) : null,
                longitude
              );
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Longitude</Label>
          <Input
            type="number"
            step="0.000001"
            placeholder="e.g. 72.8777"
            value={longitude ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onLocationChange(
                latitude,
                val ? parseFloat(val) : null
              );
            }}
          />
        </div>
      </div>

      {hasLocation && (
        <div className="space-y-2">
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border/60">
            <iframe
              src={mapUrl!}
              className="w-full h-full border-0"
              loading="lazy"
              title="Delivery location map"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Navigation className="inline size-3 mr-1" />
              Lat: {latitude}, Lng: {longitude}
            </p>
            <a
              href={googleMapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open in Google Maps <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      {!hasLocation && (
        <p className="text-[10px] text-muted-foreground italic">
          Optional — helps ensure accurate delivery
        </p>
      )}
    </div>
  );
}
