import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Upload,
  FileText,
  Image,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Loader2,
  MessageSquare,
  Calendar,
  User,
  Stethoscope,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  under_review: { label: "Under Review", color: "bg-blue-100 text-blue-800", icon: Eye },
  approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  needs_clarification: { label: "Needs Clarification", color: "bg-orange-100 text-orange-800", icon: MessageSquare },
};

export default function AccountPrescriptions() {
  const navigate = useNavigate();
  const prescriptions = useQuery(api.prescriptions.list);
  const uploadRx = useMutation(api.prescriptions.upload);
  const generateUploadUrl = useMutation(api.prescriptions.generateUploadUrl);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detailRx = prescriptions?.find((rx) => rx._id === showDetailDialog);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Invalid file type. Allowed: JPG, PNG, PDF");
      return;
    }
    if (selected.size > MAX_SIZE) {
      toast.error("File size must be less than 10MB");
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
    if (!doctorName.trim()) {
      toast.error("Doctor name is required");
      return;
    }
    if (!prescriptionDate) {
      toast.error("Prescription date is required");
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64 data URL for Convex upload
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload file to Convex storage
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("File upload failed");
      const { storageId } = await result.json();

      await uploadRx({
        patientName: patientName.trim(),
        doctorName: doctorName.trim(),
        prescriptionDate: new Date(prescriptionDate).getTime(),
        notes: notes.trim() || undefined,
        fileId: storageId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      toast.success("Prescription uploaded successfully!");
      setShowUploadDialog(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload prescription");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPatientName("");
    setDoctorName("");
    setPrescriptionDate("");
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (prescriptions === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusCounts = prescriptions.reduce(
    (acc, rx) => {
      acc[rx.status] = (acc[rx.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage your prescriptions for Rx medicines
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)} className="gradient-primary text-white gap-2">
          <Upload className="size-4" />
          Upload Prescription
        </Button>
      </div>

      {/* Status Summary */}
      {prescriptions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="text-center p-3 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-lg font-bold text-foreground">{statusCounts[key] || 0}</p>
              <p className="text-xs text-muted-foreground">{config.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {prescriptions.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Pill className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No prescriptions yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload your prescription to order prescription-required medicines. Our pharmacist will review and approve it.
            </p>
            <Button onClick={() => setShowUploadDialog(true)} className="gradient-primary text-white gap-2">
              <Upload className="size-4" />
              Upload Your First Prescription
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Prescription List */
        <div className="space-y-4">
          <AnimatePresence>
            {prescriptions.map((rx) => {
              const config = STATUS_CONFIG[rx.status];
              const StatusIcon = config.icon;
              return (
                <motion.div key={rx._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border/60 hover:shadow-card-hover transition-all cursor-pointer"
                    onClick={() => setShowDetailDialog(rx._id)}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="size-12 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                          {rx.fileType === "application/pdf" ? (
                            <FileText className="size-6 text-primary" />
                          ) : (
                            <Image className="size-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">{rx.fileName}</h3>
                            <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="size-3" /> {rx.patientName}</span>
                            <span className="flex items-center gap-1"><Stethoscope className="size-3" /> Dr. {rx.doctorName}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {new Date(rx.prescriptionDate).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                          {/* Status-specific messages */}
                          {rx.status === "rejected" && rx.rejectionReason && (
                            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
                              Rejection: {rx.rejectionReason}
                            </p>
                          )}
                          {rx.status === "needs_clarification" && rx.clarificationNote && (
                            <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
                              Clarification needed: {rx.clarificationNote}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { setShowUploadDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Prescription</DialogTitle>
            <DialogDescription>
              Upload a valid prescription from your doctor. Accepted formats: JPG, PNG, PDF (max 10MB)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File Upload */}
            <div className="space-y-1.5">
              <Label>Prescription File *</Label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
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
                    {file.type === "application/pdf" ? (
                      <FileText className="size-8 text-primary" />
                    ) : (
                      <Image className="size-8 text-primary" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select file</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">JPG, PNG, or PDF — Max 10MB</p>
                  </>
                )}
              </div>
            </div>

            {/* Patient Name */}
            <div className="space-y-1.5">
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input id="patientName" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name as on prescription" />
            </div>

            {/* Doctor Name */}
            <div className="space-y-1.5">
              <Label htmlFor="doctorName">Doctor Name *</Label>
              <Input id="doctorName" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Prescribing doctor's name" />
            </div>

            {/* Prescription Date */}
            <div className="space-y-1.5">
              <Label htmlFor="rxDate">Prescription Date *</Label>
              <Input id="rxDate" type="date" value={prescriptionDate} onChange={(e) => setPrescriptionDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="rxNotes">Notes (optional)</Label>
              <Textarea id="rxNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes for the pharmacist" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !file} className="gradient-primary text-white gap-2">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Uploading..." : "Upload Prescription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetailDialog} onOpenChange={() => setShowDetailDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detailRx && (() => {
            const config = STATUS_CONFIG[detailRx.status];
            const auditLog = JSON.parse(detailRx.auditLog || "[]");
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Prescription Details
                    <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* File Info */}
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    {detailRx.fileType === "application/pdf" ? (
                      <FileText className="size-8 text-primary" />
                    ) : (
                      <Image className="size-8 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{detailRx.fileName}</p>
                      <p className="text-xs text-muted-foreground">{(detailRx.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{detailRx.patientName}</span></div>
                    <div><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">Dr. {detailRx.doctorName}</span></div>
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(detailRx.prescriptionDate).toLocaleDateString("en-IN")}</span></div>
                    <div><span className="text-muted-foreground">Uploaded:</span> <span className="font-medium">{new Date(detailRx.createdAt).toLocaleDateString("en-IN")}</span></div>
                  </div>

                  {detailRx.notes && (
                    <div className="text-sm"><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{detailRx.notes}</span></div>
                  )}

                  {/* Admin Messages */}
                  {detailRx.rejectionReason && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                      <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-600">{detailRx.rejectionReason}</p>
                    </div>
                  )}

                  {detailRx.clarificationNote && (
                    <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                      <p className="text-xs font-semibold text-orange-700 mb-1">Clarification Requested</p>
                      <p className="text-sm text-orange-600">{detailRx.clarificationNote}</p>
                    </div>
                  )}

                  {detailRx.adminNotes && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Admin Notes</p>
                      <p className="text-sm text-blue-600">{detailRx.adminNotes}</p>
                    </div>
                  )}

                  {/* Audit Trail */}
                  {auditLog.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <History className="size-3" /> Audit Trail
                      </h4>
                      <div className="space-y-2">
                        {auditLog.map((entry: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <div className="size-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                            <div>
                              <span className="font-medium capitalize">{entry.status?.replace("_", " ")}</span>
                              {entry.note && <span className="text-muted-foreground"> — {entry.note}</span>}
                              <p className="text-muted-foreground/70">{new Date(entry.timestamp).toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Re-upload CTA for rejected/clarification */}
                  {(detailRx.status === "rejected" || detailRx.status === "needs_clarification") && (
                    <Button
                      onClick={() => {
                        setShowDetailDialog(null);
                        setShowUploadDialog(true);
                      }}
                      className="w-full gradient-primary text-white gap-2"
                    >
                      <Upload className="size-4" />
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
