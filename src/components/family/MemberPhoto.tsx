import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function MemberAvatar({
  name,
  photoUrl,
  className = "size-12 rounded-2xl text-sm",
  fallbackClassName = "",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-primary/10 font-bold text-primary ring-1 ring-primary/10 ${className} ${fallbackClassName}`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${name} profile photo`}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span aria-hidden>{initialsFor(name)}</span>
      )}
    </div>
  );
}

export function MemberPhotoDialog({
  open,
  onOpenChange,
  memberId,
  name,
  photoUrl,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: Id<"family_members">;
  name: string;
  photoUrl?: string | null;
  onChanged?: () => void;
}) {
  const generateUploadUrl = useMutation(api.familyHealth.generateProfilePhotoUploadUrl);
  const setProfilePhoto = useMutation(api.familyHealth.setProfilePhoto);
  const removeProfilePhoto = useMutation(api.familyHealth.removeProfilePhoto);

  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function chooseFile(chosen: File | null) {
    if (!chosen) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(chosen.type)) {
      toast.error("Choose a JPG, PNG or WebP photo.");
      return;
    }
    if (chosen.size > 5 * 1024 * 1024) {
      toast.error("Profile photos must be 5 MB or smaller.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  }

  async function savePhoto() {
    if (!file) {
      toast.error("Choose or take a photo first.");
      return;
    }
    setSaving(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Photo upload failed. Please try again.");
      const { storageId } = await response.json();
      await setProfilePhoto({
        memberId,
        fileId: storageId,
        fileName: file.name || "profile-photo",
        fileType: file.type,
        fileSize: file.size,
      });
      toast.success("Profile photo updated");
      onChanged?.();
      handleOpenChange(false);
    } catch (error: unknown) {
      toast.error(errorText(error, "Could not save the photo"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeProfilePhoto({ memberId });
      toast.success("Profile photo removed");
      onChanged?.();
      setRemoveOpen(false);
      handleOpenChange(false);
    } catch (error: unknown) {
      toast.error(errorText(error, "Could not remove the photo"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{photoUrl ? "Change profile photo" : "Add profile photo"}</DialogTitle>
            <DialogDescription>
              Optional photo for {name}. JPG, PNG or WebP up to 5 MB.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex size-32 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-muted/30">
              {preview || photoUrl ? (
                <img
                  src={preview ?? photoUrl ?? ""}
                  alt={`${name} preview`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-primary">{initialsFor(name)}</span>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <input
                ref={cameraInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={galleryInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => cameraInput.current?.click()}
              >
                <Camera className="size-4" /> Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => galleryInput.current?.click()}
              >
                <ImagePlus className="size-4" /> Gallery
              </Button>
            </div>
            {file && (
              <p className="max-w-full truncate text-xs text-muted-foreground">{file.name}</p>
            )}
            {photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveOpen(true)}
              >
                <Trash2 className="size-3.5" /> Remove current photo
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-10" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button className="h-10" onClick={savePhoto} disabled={saving || !file}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}&apos;s photo?</AlertDialogTitle>
            <AlertDialogDescription>
              The initials avatar will be shown instead. Health records are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing && <Loader2 className="mr-1 size-4 animate-spin" />}
              Remove photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
