import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  AlertTriangle,
  FileText,
  Image,
  Download,
  ExternalLink,
  Loader2,
  User,
  Stethoscope,
  Calendar,
  History,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  pending: {
    label: "Pending Review",
    color: "bg-yellow-100 text-yellow-800",
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
    icon: MessageSquare,
  },
};

export default function AdminPrescriptions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [clarificationNote, setClarificationNote] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const prescriptions = useQuery(api.prescriptions.adminList, {
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });
  const pendingCount = useQuery(api.prescriptions.pendingCount);
  const startReview = useMutation(api.prescriptions.startReview);
  const approveMutation = useMutation(api.prescriptions.approve);
  const rejectMutation = useMutation(api.prescriptions.reject);
  const requestClarification = useMutation(api.prescriptions.requestClarification);
  const getFileUrl = useMutation(api.prescriptions.generateUploadUrl);

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      rx.patientName.toLowerCase().includes(q) ||
      rx.doctorName.toLowerCase().includes(q) ||
      rx.fileName.toLowerCase().includes(q) ||
      rx.userName.toLowerCase().includes(q) ||
      rx.userEmail.toLowerCase().includes(q)
    );
  });

  const statusCounts = prescriptions?.reduce(
    (acc, rx) => {
      acc[rx.status] = (acc[rx.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleStartReview = async (rxId: string) => {
    try {
      await startReview({ prescriptionId: rxId as any });
      toast.success("Review started");
    } catch (error: any) {
      toast.error(error.message || "Failed to start review");
    }
  };

  const handleApprove = async () => {
    if (!selectedRx) return;
    setActionLoading(true);
    try {
      await approveMutation({
        prescriptionId: selectedRx._id,
        adminNotes: adminNotes.trim() || undefined,
      });
      toast.success("Prescription approved successfully");
      setShowReviewDialog(false);
      resetReviewForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRx || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setActionLoading(true);
    try {
      await rejectMutation({
        prescriptionId: selectedRx._id,
        rejectionReason: rejectionReason.trim(),
        adminNotes: adminNotes.trim() || undefined,
      });
      toast.success("Prescription rejected");
      setShowReviewDialog(false);
      resetReviewForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestClarification = async () => {
    if (!selectedRx || !clarificationNote.trim()) {
      toast.error("Clarification note is required");
      return;
    }
    setActionLoading(true);
    try {
      await requestClarification({
        prescriptionId: selectedRx._id,
        clarificationNote: clarificationNote.trim(),
        adminNotes: adminNotes.trim() || undefined,
      });
      toast.success("Clarification requested");
      setShowReviewDialog(false);
      resetReviewForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to request clarification");
    } finally {
      setActionLoading(false);
    }
  };

  const resetReviewForm = () => {
    setSelectedRx(null);
    setRejectionReason("");
    setClarificationNote("");
    setAdminNotes("");
  };

  const openReviewDialog = (rx: any) => {
    setSelectedRx(rx);
    setShowReviewDialog(true);
  };

  const openFileViewer = (rx: any) => {
    setShowFileViewer(rx);
  };

  if (prescriptions === undefined) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage customer prescriptions
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`border-border/60 cursor-pointer hover:shadow-sm transition-all ${
                    statusFilter === key
                      ? "ring-2 ring-primary/30 border-primary/30"
                      : ""
                  }`}
                  onClick={() =>
                    setStatusFilter(statusFilter === key ? "all" : key)
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center ${config.color}`}
                      >
                        <StatusIcon className="size-4" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {statusCounts?.[key] || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config.label}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Search & Filter */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient, doctor, file, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[180px] rounded-xl">
                  <Filter className="mr-2 size-3" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions Table */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {!filteredPrescriptions || filteredPrescriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Pill className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No prescriptions found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "No prescriptions match the selected filter"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Patient / Doctor</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrescriptions.map((rx) => {
                      const config = STATUS_CONFIG[rx.status];
                      const StatusIcon = config.icon;
                      return (
                        <TableRow key={rx._id} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {rx.userName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rx.userEmail}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {rx.patientName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Dr. {rx.doctorName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {rx.fileType === "application/pdf" ? (
                                <FileText className="size-4 text-primary" />
                              ) : (
                                <Image className="size-4 text-primary" />
                              )}
                              <div>
                                <p className="text-sm font-medium truncate max-w-[150px]">
                                  {rx.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(rx.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              {new Date(rx.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-[10px] ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => openFileViewer(rx)}
                              >
                                <Eye className="size-3.5" />
                                View
                              </Button>
                              {rx.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-blue-600 hover:text-blue-700"
                                  onClick={() => {
                                    handleStartReview(rx._id);
                                    openReviewDialog(rx);
                                  }}
                                >
                                  Review
                                </Button>
                              )}
                              {(rx.status === "pending" ||
                                rx.status === "under_review" ||
                                rx.status === "needs_clarification") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-primary hover:text-primary/80"
                                  onClick={() => openReviewDialog(rx)}
                                >
                                  Act
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {filteredPrescriptions?.length ?? 0} prescription(s) total
        </p>
      </div>

      {/* File Viewer Dialog */}
      <Dialog
        open={!!showFileViewer}
        onOpenChange={() => setShowFileViewer(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {showFileViewer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Prescription File
                  <Badge
                    className={`text-[10px] ${STATUS_CONFIG[showFileViewer.status]?.color}`}
                  >
                    {STATUS_CONFIG[showFileViewer.status]?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {showFileViewer.fileName} — Uploaded by{" "}
                  {showFileViewer.userName}
                </DialogDescription>
              </DialogHeader>

              {/* File preview */}
              <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/20">
                {showFileViewer.fileType === "application/pdf" ? (
                  <div className="p-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl mb-4">
                      <FileText className="size-10 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {showFileViewer.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF Document —{" "}
                          {(showFileViewer.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground text-center py-4">
                      PDF preview is available via the View button below.
                      Click "Open in New Tab" to view the full prescription.
                    </p>
                  </div>
                ) : showFileViewer.fileType.startsWith("image/") ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Click "Open in New Tab" to view the full prescription
                      image.
                    </p>
                    <div className="inline-flex items-center gap-3 p-4 bg-muted/40 rounded-xl">
                      <Image className="size-10 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium">
                          {showFileViewer.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Image —{" "}
                          {(showFileViewer.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Unsupported file type
                  </div>
                )}
              </div>

              {/* File Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Patient:</span>{" "}
                  <span className="font-medium">
                    {showFileViewer.patientName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Doctor:</span>{" "}
                  <span className="font-medium">
                    Dr. {showFileViewer.doctorName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prescription Date:</span>{" "}
                  <span className="font-medium">
                    {new Date(
                      showFileViewer.prescriptionDate
                    ).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploaded:</span>{" "}
                  <span className="font-medium">
                    {new Date(
                      showFileViewer.createdAt
                    ).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </div>

              {showFileViewer.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes:</span>{" "}
                  <span className="font-medium">
                    {showFileViewer.notes}
                  </span>
                </div>
              )}

              {showFileViewer.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-600">
                    {showFileViewer.rejectionReason}
                  </p>
                </div>
              )}

              {showFileViewer.clarificationNote && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="text-xs font-semibold text-orange-700 mb-1">
                    Clarification Requested
                  </p>
                  <p className="text-sm text-orange-600">
                    {showFileViewer.clarificationNote}
                  </p>
                </div>
              )}

              {showFileViewer.adminNotes && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    Admin Notes
                  </p>
                  <p className="text-sm text-blue-600">
                    {showFileViewer.adminNotes}
                  </p>
                </div>
              )}

              {/* Audit Trail */}
              {(() => {
                const auditLog = JSON.parse(showFileViewer.auditLog || "[]");
                if (auditLog.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <History className="size-3" /> Audit Trail
                    </h4>
                    <div className="space-y-2">
                      {auditLog.map((entry: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs"
                        >
                          <div className="size-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-medium capitalize">
                              {entry.status?.replace("_", " ")}
                            </span>
                            {entry.note && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {entry.note}
                              </span>
                            )}
                            <p className="text-muted-foreground/70">
                              {new Date(entry.timestamp).toLocaleString(
                                "en-IN"
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFileViewer(null)}
                >
                  Close
                </Button>
                {(showFileViewer.status === "pending" ||
                  showFileViewer.status === "under_review" ||
                  showFileViewer.status === "needs_clarification") && (
                  <Button
                    className="gradient-primary text-white gap-2"
                    onClick={() => {
                      setShowFileViewer(null);
                      openReviewDialog(showFileViewer);
                    }}
                  >
                    <Eye className="size-4" />
                    Review Prescription
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onOpenChange={(open) => {
          if (!open) resetReviewForm();
          setShowReviewDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedRx && (
            <>
              <DialogHeader>
                <DialogTitle>Review Prescription</DialogTitle>
                <DialogDescription>
                  Review and take action on {selectedRx.userName}'s prescription
                  for {selectedRx.patientName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Quick file info */}
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  {selectedRx.fileType === "application/pdf" ? (
                    <FileText className="size-8 text-primary" />
                  ) : (
                    <Image className="size-8 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {selectedRx.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dr. {selectedRx.doctorName} —{" "}
                      {new Date(
                        selectedRx.prescriptionDate
                      ).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="adminNotes">
                    Admin Notes (optional)
                  </Label>
                  <Textarea
                    id="adminNotes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes about this prescription"
                    rows={2}
                  />
                </div>

                {/* Rejection Reason (shown for reject action) */}
                <div className="space-y-1.5" id="reject-section">
                  <Label htmlFor="rejectionReason">
                    Rejection Reason{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why is this prescription being rejected?"
                    rows={2}
                  />
                </div>

                {/* Clarification Note (shown for clarification action) */}
                <div className="space-y-1.5" id="clarify-section">
                  <Label htmlFor="clarificationNote">
                    Clarification Note{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="clarificationNote"
                    value={clarificationNote}
                    onChange={(e) => setClarificationNote(e.target.value)}
                    placeholder="What clarification is needed from the customer?"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReviewDialog(false);
                    resetReviewForm();
                  }}
                >
                  Cancel
                </Button>
                <div className="flex flex-wrap gap-2 justify-end">
                  {clarificationNote.trim() && (
                    <Button
                      variant="outline"
                      className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={handleRequestClarification}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MessageSquare className="size-4" />
                      )}
                      Request Clarification
                    </Button>
                  )}
                  {rejectionReason.trim() && (
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={handleReject}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Reject
                    </Button>
                  )}
                  <Button
                    className="gradient-primary text-white gap-2"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Approve
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
