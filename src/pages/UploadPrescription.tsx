import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Image,
  FileText,
  AlertTriangle,
  User,
  Calendar,
  Stethoscope,
  Pill,
  HardDrive,
  CheckCircle,
  Upload,
} from "lucide-react";

/* ── Requirement items ── */
const REQUIREMENTS = [
  { icon: Stethoscope, label: "Doctor Details" },
  { icon: Calendar, label: "Date of Prescription" },
  { icon: User, label: "Patient Details" },
  { icon: Pill, label: "Medicine Details" },
  { icon: HardDrive, label: "Maximum File Size" },
] as const;

export default function UploadPrescription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const generateUploadUrl = useMutation(api.prescriptions.generateUploadUrl);
  const uploadPrescription = useMutation(api.prescriptions.upload);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a JPG, PNG, or PDF file.");
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB.");
        return;
      }

      if (!user) {
        toast.error("Please sign in to upload a prescription.");
        navigate("/auth?returnTo=/upload-prescription");
        return;
      }

      setUploading(true);

      try {
        // 1. Generate Convex upload URL
        const uploadUrl = await generateUploadUrl();

        // 2. Upload file to Convex storage
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error("File upload failed. Please try again.");
        }

        const { storageId } = await response.json();

        // 3. Create prescription record (uses sensible defaults for required fields)
        await uploadPrescription({
          patientName: user.name || "Patient",
          doctorName: "Pending",
          prescriptionDate: Date.now(),
          notes: "Uploaded via Upload Prescription page",
          fileId: storageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        // Show preview
        if (file.type !== "application/pdf") {
          setPreviewUrl(URL.createObjectURL(file));
        }

        toast.success("Prescription uploaded! Our pharmacist will review it shortly.");
      } catch (err: any) {
        toast.error(err.message || "Failed to upload prescription. Please try again.");
      } finally {
        setUploading(false);
      }

      // Reset the input so the same file can be re-selected
      e.target.value = "";
    },
    [user, generateUploadUrl, uploadPrescription, navigate]
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* ── Page Title ── */}
      <div className="bg-white border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
          <h1 className="text-xl sm:text-2xl font-bold text-[#0a3d2e] tracking-tight">
            UPLOAD PRESCRIPTION
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your valid prescription and we will deliver your medicines with care.
          </p>
        </div>
      </div>

      {/* ── Three Column Layout ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ════ COLUMN 1 — Upload Prescription ════ */}
          <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-1">
              Choose from the following to upload prescription:
            </h2>
            <div className="h-px bg-border/50 my-4" />

            {/* Choose from Gallery */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-4 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Image className="size-5" />
              </div>
              <span className="text-sm font-semibold text-primary group-hover:text-primary/80 transition-colors">
                CHOOSE FROM GALLERY
              </span>
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs font-medium text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* E-Prescription */}
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 px-4 py-4 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <span className="text-sm font-semibold text-foreground/70">
                SELECT FROM E-PRESCRIPTION
              </span>
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Upload preview */}
            {previewUrl && (
              <div className="mt-4 rounded-lg border border-border/60 overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="w-full h-40 object-contain bg-muted/30"
                />
              </div>
            )}

            {/* Uploaded prescriptions area */}
            <div className="mt-6 rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 flex flex-col items-center justify-center min-h-[120px]">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/50 mb-2"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="9" y1="6" x2="15" y2="6" />
                <line x1="9" y1="9.5" x2="15" y2="9.5" />
                <line x1="9" y1="13" x2="13" y2="13" />
              </svg>
              <p className="text-xs text-muted-foreground text-center">
                Uploaded Prescriptions will be shown here
              </p>
            </div>

            {uploading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Uploading prescription…
              </div>
            )}
          </div>

          {/* ════ COLUMN 2 — Prescription Requirements ════ */}
          <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-1">
              Make sure the prescription you upload contains the following elements:
            </h2>
            <div className="h-px bg-border/50 my-4" />

            {/* Requirements grid */}
            <div className="grid grid-cols-2 gap-4">
              {REQUIREMENTS.map((req) => {
                const Icon = req.icon;
                return (
                  <div
                    key={req.label}
                    className="flex flex-col items-center text-center gap-2 rounded-xl bg-[#f0f9f4] border border-[#0a3d2e]/10 p-4"
                  >
                    <div className="flex size-11 items-center justify-center rounded-full bg-[#0a3d2e]/10 text-[#0a3d2e]">
                      <Icon className="size-5" />
                    </div>
                    <span className="text-xs font-medium text-foreground leading-tight">
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Warning note */}
            <div className="mt-6 flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                Our pharmacist will dispense medicines only if the prescription is valid &amp; it meets all government regulations.
              </p>
            </div>
          </div>

          {/* ════ COLUMN 3 — Sample Prescription ════ */}
          <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-1">
              View Sample Prescription below:
            </h2>
            <div className="h-px bg-border/50 my-4" />

            {/* Sample prescription card */}
            <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
              {/* Prescription header */}
              <div className="bg-[#0a3d2e] text-white px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold">Dr. Nidhi Sharma</p>
                    <p className="text-xs text-white/70 mt-0.5">
                      City Health Clinic
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      12 MG Road, Thane, Maharashtra
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Regd. no.: 123456
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-400 text-[#0a3d2e] text-sm font-bold">
                      1
                    </span>
                  </div>
                </div>
              </div>

              {/* Prescription body */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-[#0a3d2e]">Patient:</span>
                  <span className="text-xs text-foreground">Rajesh Kumar, 45 years, Male</span>
                </div>

                {/* Rx symbol */}
                <div className="mb-3">
                  <span className="text-lg font-bold text-[#0a3d2e]">&#8478;</span>
                </div>

                {/* Medicine list */}
                <div className="space-y-2.5 border-l-2 border-[#0a3d2e]/20 pl-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Tab. Amoxicillin 500mg</p>
                    <p className="text-xs text-muted-foreground">1-0-1 &times; 5 days</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tab. Paracetamol 650mg</p>
                    <p className="text-xs text-muted-foreground">1-1-1 as needed</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Syr. Ambroxol 15mg/5ml</p>
                    <p className="text-xs text-muted-foreground">5ml &times; 3 times daily &times; 7 days</p>
                  </div>
                </div>

                {/* Doctor signature area */}
                <div className="mt-5 pt-3 border-t border-border/40 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Date: 25/08/2026</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground italic">
                      Dr. Nidhi Sharma
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      M.B.B.S., D.G.O.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Green check */}
            <div className="mt-4 flex items-center gap-2 text-sm text-[#0a3d2e]">
              <CheckCircle className="size-4" />
              <span className="font-medium">Valid prescription format</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
