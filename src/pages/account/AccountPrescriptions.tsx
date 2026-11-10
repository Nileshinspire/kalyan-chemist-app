import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Calendar,
  User,
  Stethoscope,
  Download,
  ShoppingBag,
  History,
} from "lucide-react";
import { downloadFile } from "@/lib/downloadFile";
import type { LucideIcon } from "lucide-react";

/**
 * Customer-facing prescription history.
 *
 * This page is read-only by design: it lists every prescription uploaded from
 * the homepage or from checkout for the signed-in customer. Uploading happens
 * on /upload-prescription and in the checkout prescription step.
 */

type HistoryStatus = {
  label: "Pending" | "Approved" | "Rejected";
  color: string;
  icon: LucideIcon;
};

const PENDING: HistoryStatus = {
  label: "Pending",
  color: "bg-amber-100 text-amber-800",
  icon: Clock,
};
const APPROVED: HistoryStatus = {
  label: "Approved",
  color: "bg-green-100 text-green-800",
  icon: CheckCircle2,
};
const REJECTED: HistoryStatus = {
  label: "Rejected",
  color: "bg-red-100 text-red-800",
  icon: XCircle,
};

/** Collapse the review workflow into the three customer-facing states. */
function historyStatus(status: string): HistoryStatus {
  if (status === "approved") return APPROVED;
  if (status === "rejected") return REJECTED;
  return PENDING;
}

const dateLabel = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

function isPdf(fileType: string) {
  return fileType === "application/pdf";
}

export default function AccountPrescriptions() {
  const prescriptions = useQuery(api.prescriptions.list);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRx = prescriptions?.find((rx) => rx._id === selectedId);

  const stats = useMemo(() => {
    const rows = prescriptions ?? [];
    return {
      pending: rows.filter(
        (rx) => historyStatus(rx.status).label === "Pending",
      ).length,
      approved: rows.filter((rx) => rx.status === "approved").length,
      rejected: rows.filter((rx) => rx.status === "rejected").length,
    };
  }, [prescriptions]);

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
      <div>
        <h1 className="text-xl font-bold text-foreground">My Prescriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every prescription you upload from the homepage or checkout, with its
          pharmacist verification and linked orders.
        </p>
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

      {/* Empty state — no upload actions here */}
      {prescriptions.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <h3 className="text-lg font-semibold text-foreground">
              No prescriptions uploaded yet.
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your uploaded prescriptions will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prescriptions.map((rx) => {
            const config = historyStatus(rx.status);

            const latestOrder = rx.relatedOrders[0];
            const orderLabel =
              latestOrder?.invoiceNumber ??
              (latestOrder ? `#${latestOrder._id.slice(-6)}` : null);

            return (
              <Card
                key={rx._id}
                className="border-border/60 transition-shadow hover:shadow-card-hover"
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
                          <config.icon className="mr-1 size-3" />
                          {config.label}
                        </Badge>
                      </div>

                      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex items-center gap-1 truncate">
                          <User className="size-3 shrink-0" /> {rx.patientName}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <Stethoscope className="size-3 shrink-0" />
                          {rx.doctorName
                            ? `Dr. ${rx.doctorName}`
                            : "Doctor not provided"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 shrink-0" />
                          Rx date:{" "}
                          {dateLabel(rx.prescriptionDate) ?? "Not provided"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          Uploaded: {dateLabel(rx.createdAt)}
                        </span>
                      </div>

                      {rx.status === "rejected" && rx.rejectionReason && (
                        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">
                          Reason: {rx.rejectionReason}
                        </p>
                      )}
                      {rx.status === "needs_clarification" &&
                        rx.clarificationNote && (
                          <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1 text-[11px] text-orange-700">
                            Note from pharmacist: {rx.clarificationNote}
                          </p>
                        )}

                      {latestOrder && (
                        <Link
                          to={`/orders/${latestOrder._id}`}
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
                      onClick={() => setSelectedId(rx._id)}
                    >
                      <Eye className="size-3.5" /> View
                    </Button>
                    {rx.fileUrl ? (
                      <a
                        href={rx.fileUrl}
                        download={rx.fileName}
                        onClick={(e) => {
                          e.preventDefault();
                          void downloadFile(rx.fileUrl!, rx.fileName);
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedRx} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selectedRx &&
            (() => {
              const config = historyStatus(selectedRx.status);
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
                                  PDF —{" "}
                                  {(selectedRx.fileSize / 1024).toFixed(1)} KB
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
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
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
                        <span className="font-medium">
                          {selectedRx.patientName}
                        </span>
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
                          {dateLabel(selectedRx.prescriptionDate) ??
                            "Not provided"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Uploaded:
                        </span>{" "}
                        <span className="font-medium">
                          {dateLabel(selectedRx.createdAt)}
                        </span>
                      </div>
                    </div>

                    {selectedRx.status === "approved" && (
                      <p className="text-xs text-muted-foreground">
                        Valid until{" "}
                        <span className="font-medium text-foreground">
                          {dateLabel(selectedRx.expiresAt)}
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
                        <p className="text-sm text-blue-600">
                          {selectedRx.adminNotes}
                        </p>
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
                                {order.invoiceNumber ??
                                  `Order #${order._id.slice(-6)}`}
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
                                    {" "}
                                    — {entry.note}
                                  </span>
                                )}
                                <p className="text-muted-foreground/70">
                                  {new Date(entry.timestamp).toLocaleString(
                                    "en-IN",
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
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
