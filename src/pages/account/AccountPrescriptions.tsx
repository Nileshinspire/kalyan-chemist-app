import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Pill,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Loader2,
  Calendar,
  User,
  Stethoscope,
  Download,
  RotateCcw,
  ShoppingBag,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { usePrescriptionUpload } from "@/hooks/usePrescriptionUpload";
import { downloadFile } from "@/lib/downloadFile";
import type { LucideIcon } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  pending: {
    label: "Pending Review",
    color: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  under_review: {
    label: "Under Review",
    color: "bg-blue-100 text-blue-800",
    icon: Eye,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  needs_clarification: {
    label: "Needs Clarification",
    color: "bg-orange-100 text-orange-800",
    icon: AlertTriangle,
  },
};

const dateLabel = (ts?: number) =>
  ts ? new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : null;

function isPdf(fileType: string) {
  return fileType === "application/pdf";
}

export default function AccountPrescriptions() {
  const prescriptions = useQuery(api.prescriptions.list);
  const { uploading, uploadPrescription } = usePrescriptionUpload();

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRx = prescriptions?.find((rx) => rx._id === selectedId);

  const stats = useMemo(() => {
    const rows = prescriptions ?? [];
    return {
      pending: rows.filter(
        (rx) => rx.status === "pending" || rx.status === "under_review",
      ).length,
      approved: rows.filter((rx) => rx.status === "approved").length,
      rejected: rows.filter((rx) => rx.status === "rejected").length,
    };
  }, [prescriptions]);

  const resetForm = () => {
    setFile(null);
    setPatientName("");
    setDoctorName("");
    setPrescriptionDate("");
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openUpload = (prefill?: { patientName?: string; doctorName?: string }) => {
    resetForm();
    if (prefill?.patientName) setPatientName(prefill.patientName);
    if (prefill?.doctorName) setDoctorName(prefill.doctorName);
    setShowUploadDialog(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(selected.type)) {
      toast.error("Invalid file type. Allowed: JPG, PNG, PDF");
      e.target.value = "";
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }

    try {
      await uploadPrescription(file, {
        patientName: patientName.trim(),
        doctorName: doctorName.trim() || undefined,
        prescriptionDate: prescriptionDate
          ? new Date(prescriptionDate).getTime()
          : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Prescription uploaded. Our pharmacist will review it.");
      setShowUploadDialog(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload prescription",
      );
    }
  };

  if (prescriptions === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Prescriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every prescription you upload — from the homepage or checkout — lives here.
          </p>
        </div>
        <Button
          onClick={() => openUpload()}
          className="gradient-primary text-white gap-2 shrink-0"
        >
          <Upload className="size-4" />
          Upload New Prescription
        </Button>
      </div>

      {/* Status summary */}
      {prescriptions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pending", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Rejected", value: stats.rejected },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center"
            >
              <p className="text-lg font-bold text-foreground">{tile.value}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {prescriptions.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Pill className="mx-auto mb-4 size-12 text-muted-foreground/30" />
            <h3 className="mb-1 text-lg font-semibold text-foreground">
              No prescriptions yet
            </h3>
            <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
              Upload a photo or PDF of your prescription. Our pharmacist reviews it
              before prescription medicines are dispensed.
            </p>
            <Button
              onClick={() => openUpload()}
              className="gradient-primary text-white gap-2"
            >
              <Upload className="size-4" />
              Upload Your First Prescription
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prescriptions.map((rx) => {
            const config = STATUS_CONFIG[rx.status];
            const StatusIcon = config.icon;
            const needsAction =
              rx.status === "rejected" || rx.status === "needs_clarification";
            const expiresAt = rx.expiresAt;
            const expired = rx.expired;

            const latestOrder = rx.relatedOrders[0];
            const orderLabel =
              latestOrder?.invoiceNumber ??
              (latestOrder ? `#${latestOrder._id.slice(-6)}` : null);

            return (
              <Card
                key={rx._id}
                className="border-border/60 hover:shadow-card-hover transition-shadow cursor-pointer"
                onClick={() => setSelectedId(rx._id)}
              >
                <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Document preview */}
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                      {rx.fileUrl && !isPdf(rx.fileType) ? (
                        <img
                          src={rx.fileUrl}
                          alt={`Prescription for ${rx.patientName}`}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <FileText className="size-8 text-primary/50" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 rounded bg-background/90 px-1 text-[9px] font-semibold uppercase text-muted-foreground">
                        {isPdf(rx.fileType) ? "PDF" : "IMG"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {rx.fileName}
                        </p>
                        <Badge className={`text-[10px] ${config.color}`}>
                          <StatusIcon className="mr-1 size-3" />
                          {config.label}
                        </Badge>
                      </div>

                      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex items-center gap-1 truncate">
                          <User className="size-3 shrink-0" /> {rx.patientName}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <Stethoscope className="size-3 shrink-0" />
                          {rx.doctorName ? `Dr. ${rx.doctorName}` : "Doctor not provided"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 shrink-0" />
                          Rx date: {dateLabel(rx.prescriptionDate) ?? "Not provided"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          Uploaded: {dateLabel(rx.createdAt)}
                        </span>
                      </div>

                      {rx.status === "approved" && (
                        <p
                          className={`mt-2 text-[11px] font-medium ${
                            expired ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {expired
                            ? "This prescription is older than 180 days — upload a recent one."
                            : `Valid until ${dateLabel(expiresAt)}`}
                        </p>
                      )}

                      {rx.status === "rejected" && rx.rejectionReason && (
                        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">
                          Reason: {rx.rejectionReason}
                        </p>
                      )}
                      {rx.status === "needs_clarification" && rx.clarificationNote && (
                        <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1 text-[11px] text-orange-700">
                          {rx.clarificationNote}
                        </p>
                      )}

                      {latestOrder && (
                        <Link
                          to={`/orders/${latestOrder._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ShoppingBag className="size-3" />
                          Order {orderLabel}
                          {rx.relatedOrders.length > 1 &&
                            ` · +${rx.relatedOrders.length - 1} more`}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border/40 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(rx._id);
                      }}
                    >
                      <Eye className="size-3.5" /> View
                    </Button>
                    {rx.fileUrl ? (
                      <a
                        href={rx.fileUrl}
                        download={rx.fileName}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void downloadFile(rx.fileUrl!, rx.fileName);
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    ) : null}
                    {(needsAction || (rx.status === "approved" && rx.expired)) && (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-primary/10 text-xs text-primary hover:bg-primary/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUpload({
                            patientName: rx.patientName,
                            doctorName: rx.doctorName,
                          });
                        }}
                      >
                        <RotateCcw className="size-3.5" /> Re-upload
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          setShowUploadDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Prescription</DialogTitle>
            <DialogDescription>
              Upload a valid prescription from your doctor. JPG, PNG or PDF, up to 10MB.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Prescription File *</Label>
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-border/60 p-6 text-center transition-all hover:border-primary/30 hover:bg-primary/[0.02]"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    {isPdf(file.type) ? (
                      <FileText className="size-8 text-primary" />
                    ) : (
                      <ImageIcon className="size-8 text-primary" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Click to select file</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      JPG, PNG, or PDF — Max 10MB
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input
                id="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient name as on prescription"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="doctorName">Doctor Name (optional)</Label>
                <Input
                  id="doctorName"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Prescribing doctor"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rxDate">Prescription Date (optional)</Label>
                <Input
                  id="rxDate"
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rxNotes">Notes (optional)</Label>
              <Textarea
                id="rxNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for the pharmacist"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !patientName.trim()}
              className="gradient-primary text-white gap-2"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? "Uploading..." : "Upload Prescription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedRx} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selectedRx && (() => {
            const config = STATUS_CONFIG[selectedRx.status];
            const auditLog: Array<{
              status?: string;
              note?: string;
              timestamp: number;
            }> = (() => {
              try {
                return JSON.parse(selectedRx.auditLog || "[]");
              } catch {
                return [];
              }
            })();
            const expiresAt = selectedRx.expiresAt;
            const needsAction =
              selectedRx.status === "rejected" ||
              selectedRx.status === "needs_clarification";

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Prescription Details
                    <Badge className={`text-[10px] ${config.color}`}>
                      {config.label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* File preview */}
                  {selectedRx.fileUrl ? (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                      {isPdf(selectedRx.fileType) ? (
                        <div className="space-y-3 p-4">
                          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
                            <FileText className="size-10 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {selectedRx.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                PDF — {(selectedRx.fileSize / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <iframe
                            src={selectedRx.fileUrl}
                            title={`Prescription ${selectedRx.fileName}`}
                            className="h-64 w-full rounded-lg border border-border/40"
                          />
                        </div>
                      ) : (
                        <img
                          src={selectedRx.fileUrl}
                          alt={`Prescription for ${selectedRx.patientName}`}
                          className="max-h-[380px] w-full object-contain"
                        />
                      )}
                      <div className="flex flex-wrap justify-center gap-2 p-3">
                        <a
                          href={selectedRx.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                        >
                          <Eye className="size-4" /> Open
                        </a>
                        <a
                          href={selectedRx.fileUrl}
                          download={selectedRx.fileName}
                          onClick={(e) => {
                            e.preventDefault();
                            void downloadFile(
                              selectedRx.fileUrl!,
                              selectedRx.fileName,
                            );
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                        >
                          <Download className="size-4" /> Download
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                      The file preview is unavailable. Please contact support.
                    </p>
                  )}

                  {/* Details */}
                  <div className="grid grid-cols-1 gap-3 text-sm min-[380px]:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Patient:</span>{" "}
                      <span className="font-medium">{selectedRx.patientName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Doctor:</span>{" "}
                      <span className="font-medium">
                        {selectedRx.doctorName
                          ? `Dr. ${selectedRx.doctorName}`
                          : "Not provided"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rx date:</span>{" "}
                      <span className="font-medium">
                        {dateLabel(selectedRx.prescriptionDate) ?? "Not provided"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Uploaded:</span>{" "}
                      <span className="font-medium">
                        {dateLabel(selectedRx.createdAt)}
                      </span>
                    </div>
                  </div>

                  {selectedRx.status === "approved" && (
                    <p className="text-xs text-muted-foreground">
                      Valid until{" "}
                      <span className="font-medium text-foreground">
                        {dateLabel(expiresAt)}
                      </span>{" "}
                      (180 days from the prescription date).
                    </p>
                  )}

                  {selectedRx.notes && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Notes:</span>{" "}
                      <span className="font-medium">{selectedRx.notes}</span>
                    </p>
                  )}

                  {selectedRx.rejectionReason && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-red-700">
                        Rejection Reason
                      </p>
                      <p className="text-sm text-red-600">
                        {selectedRx.rejectionReason}
                      </p>
                    </div>
                  )}

                  {selectedRx.clarificationNote && (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-orange-700">
                        Clarification Requested
                      </p>
                      <p className="text-sm text-orange-600">
                        {selectedRx.clarificationNote}
                      </p>
                    </div>
                  )}

                  {selectedRx.adminNotes && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-blue-700">
                        Pharmacist Notes
                      </p>
                      <p className="text-sm text-blue-600">{selectedRx.adminNotes}</p>
                    </div>
                  )}

                  {selectedRx.relatedOrders.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <ShoppingBag className="size-3" /> Linked orders
                      </h4>
                      <div className="space-y-1.5">
                        {selectedRx.relatedOrders.map((order) => (
                          <Link
                            key={order._id}
                            to={`/orders/${order._id}`}
                            onClick={() => setSelectedId(null)}
                            className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted/50"
                          >
                            <span className="font-medium text-foreground">
                              {order.invoiceNumber ?? `Order #${order._id.slice(-6)}`}
                            </span>
                            <span className="capitalize text-muted-foreground">
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {auditLog.length > 0 && (
                    <details className="text-xs">
                      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-foreground">
                        <History className="size-3" /> Review history
                      </summary>
                      <div className="mt-2 space-y-2">
                        {auditLog.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
                            <div>
                              <span className="font-medium capitalize">
                                {entry.status?.replace(/_/g, " ")}
                              </span>
                              {entry.note && (
                                <span className="text-muted-foreground">
                                  {" "}— {entry.note}
                                </span>
                              )}
                              <p className="text-muted-foreground/70">
                                {new Date(entry.timestamp).toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {(needsAction ||
                    (selectedRx.status === "approved" && selectedRx.expired)) && (
                    <Button
                      onClick={() => {
                        const prefill = {
                          patientName: selectedRx.patientName,
                          doctorName: selectedRx.doctorName,
                        };
                        setSelectedId(null);
                        openUpload(prefill);
                      }}
                      className="w-full gradient-primary text-white gap-2"
                    >
                      <RotateCcw className="size-4" />
                      Upload New Prescription
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
