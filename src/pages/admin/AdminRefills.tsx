import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/auth-utils";
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  CalendarClock,
  FileCheck2,
} from "lucide-react";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "due_soon", label: "Due Soon" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processed", label: "Processed" },
  { value: "completed", label: "Completed" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  due_soon: "bg-amber-100 text-amber-700",
  pending_verification: "bg-orange-100 text-orange-700",
  confirmed: "bg-green-100 text-green-700",
  processed: "bg-indigo-100 text-indigo-700",
  completed: "bg-gray-100 text-gray-700",
};

export default function AdminRefills() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);

  const allRequests = useQuery(api.adminRefills.listAll);
  const statusCounts = useQuery(api.adminRefills.getStatusCounts) as Record<string, number> | undefined;
  const allReminders = useQuery(api.adminRefills.listAllReminders);
  const updateStatus = useMutation(api.adminRefills.updateStatus);

  const filteredRequests = activeTab === "all"
    ? allRequests
    : allRequests?.filter((r) => r.status === activeTab);

  const handleUpdateStatus = async (
    requestId: string,
    newStatus: string
  ) => {
    try {
      await updateStatus({
        requestId: requestId as any,
        status: newStatus as any,
      });
      toast.success("Status updated");
      setSelectedRequest(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Clock className="size-3" />;
      case "due_soon":
        return <AlertTriangle className="size-3" />;
      case "pending_verification":
        return <FileCheck2 className="size-3" />;
      case "confirmed":
        return <CheckCircle className="size-3" />;
      case "processed":
        return <RefreshCw className="size-3" />;
      case "completed":
        return <CheckCircle className="size-3" />;
      default:
        return <Pill className="size-3" />;
    }
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case "scheduled":
        return ["due_soon", "confirmed"];
      case "due_soon":
        return ["pending_verification", "confirmed"];
      case "pending_verification":
        return ["confirmed"];
      case "confirmed":
        return ["processed"];
      case "processed":
        return ["completed"];
      default:
        return [];
    }
  };

  const isLoading = allRequests === undefined;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medicine Refills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer refill requests and reminders
          </p>
        </div>

        {/* Stats Cards */}
        {statusCounts && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Scheduled", value: statusCounts.scheduled || 0, color: "text-blue-600" },
              { label: "Due Soon", value: statusCounts.due_soon || 0, color: "text-amber-600" },
              { label: "Verification", value: statusCounts.pending_verification || 0, color: "text-orange-600" },
              { label: "Confirmed", value: statusCounts.confirmed || 0, color: "text-green-600" },
              { label: "Processed", value: statusCounts.processed || 0, color: "text-indigo-600" },
              { label: "Completed", value: statusCounts.completed || 0, color: "text-gray-600" },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/60">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs + Request List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                {tab.label}
                {statusCounts && tab.value !== "all" && (
                  <span className="ml-1 text-[10px] opacity-70">
                    {(statusCounts as any)[tab.value] || 0}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : !filteredRequests || filteredRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                    <Pill className="size-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    No refill requests
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === "all"
                      ? "No refill requests have been created yet."
                      : `No refill requests with status: ${activeTab.replace(/_/g, " ")}`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <Card
                    key={request._id}
                    className={`border-border/60 cursor-pointer hover:shadow-md transition-all ${
                      selectedRequest?._id === request._id ? "border-primary ring-1 ring-primary/20" : ""
                    }`}
                    onClick={() =>
                      setSelectedRequest(
                        selectedRequest?._id === request._id ? null : request
                      )
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Pill className="size-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {request.customer?.name || "Customer"}
                              </p>
                              <Badge
                                className={`text-[10px] ${STATUS_COLORS[request.status] || ""}`}
                              >
                                {getStatusIcon(request.status)}
                                <span className="ml-1">
                                  {request.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                </span>
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {request.medicines.map((m: any) => m.productName).join(", ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {request.medicines.length} medicine(s) ·{" "}
                              {formatCurrency(request.totalAmount)}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>

                      {/* Expanded Details */}
                      {selectedRequest?._id === request._id && (
                        <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
                          {/* Customer Info */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Customer
                            </h4>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <User className="size-3.5 text-muted-foreground" />
                                {request.customer?.name || "—"}
                              </span>
                              <span className="text-muted-foreground">
                                {request.customer?.phone || "—"}
                              </span>
                              <span className="text-muted-foreground">
                                {request.customer?.email || "—"}
                              </span>
                            </div>
                          </div>

                          {/* Medicines */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Medicines
                            </h4>
                            <div className="space-y-2">
                              {request.medicines.map((med: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-muted/30 rounded-lg p-3"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {med.productName}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-muted-foreground">
                                        Qty: {med.quantity}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        · {formatCurrency(med.unitPrice)} each
                                      </span>
                                      {med.prescriptionRequired && (
                                        <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600">
                                          Rx Required
                                        </Badge>
                                      )}
                                      {!med.available && (
                                        <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">
                                          Unavailable
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-sm font-semibold text-foreground">
                                    {formatCurrency(med.unitPrice * med.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end mt-2">
                              <span className="text-sm font-bold text-foreground">
                                Total: {formatCurrency(request.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Request Info */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Request Info
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Created: </span>
                                <span className="text-foreground">
                                  {new Date(request.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              {request.reminderId && (
                                <div>
                                  <span className="text-muted-foreground">Reminder: </span>
                                  <span className="text-foreground flex items-center gap-1">
                                    <CalendarClock className="size-3" /> Linked
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Actions
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {getNextStatuses(request.status).map((nextStatus) => (
                                <Button
                                  key={nextStatus}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(request._id, nextStatus);
                                  }}
                                >
                                  Move to{" "}
                                  {nextStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Upcoming Reminders (admin overview) ── */}
        {allReminders && allReminders.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Reminders</h2>
            <div className="space-y-2">
              {allReminders
                .filter((r) => r.isActive)
                .sort((a, b) => a.nextReminderAt - b.nextReminderAt)
                .slice(0, 10)
                .map((reminder) => {
                  const product = reminder.product as any;
                  const customer = reminder.customer as any;
                  const nextDate = new Date(reminder.nextReminderAt);
                  const isDue = reminder.nextReminderAt <= Date.now();

                  return (
                    <Card
                      key={reminder._id}
                      className={`border-border/60 cursor-pointer hover:shadow-md transition-all ${
                        isDue ? "border-amber-300 bg-amber-50/30" : ""
                      } ${
                        selectedReminder?._id === reminder._id ? "border-primary ring-1 ring-primary/20" : ""
                      }`}
                      onClick={() =>
                        setSelectedReminder(
                          selectedReminder?._id === reminder._id ? null : reminder
                        )
                      }
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex size-8 items-center justify-center rounded-lg ${isDue ? "bg-amber-100 text-amber-600" : "bg-violet-100 text-violet-600"}`}>
                              <CalendarClock className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {customer?.name || "Customer"} → {product?.name || "Medicine"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Every {reminder.intervalDays} days · Next:{" "}
                                {isDue ? "Due now" : nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>
                          {isDue && (
                            <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                              Due
                            </Badge>
                          )}
                        </div>

                        {/* Expanded Reminder Details */}
                        {selectedReminder?._id === reminder._id && (
                          <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
                            {/* Customer Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Customer
                              </h4>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1">
                                  <User className="size-3.5 text-muted-foreground" />
                                  {customer?.name || "—"}
                                </span>
                                <span className="text-muted-foreground">
                                  {customer?.phone || "—"}
                                </span>
                                <span className="text-muted-foreground">
                                  {customer?.email || "—"}
                                </span>
                              </div>
                            </div>

                            {/* Medicine Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Medicine
                              </h4>
                              <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-sm font-medium text-foreground">
                                  {product?.name || "—"}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  {product?.strength && (
                                    <span className="text-xs text-muted-foreground">
                                      Strength: {product.strength}
                                    </span>
                                  )}
                                  {product?.dosage && (
                                    <span className="text-xs text-muted-foreground">
                                      Dosage: {product.dosage}
                                    </span>
                                  )}
                                  {product?.form && (
                                    <span className="text-xs text-muted-foreground">
                                      Form: {product.form}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {product?.price != null && (
                                    <span className="text-xs font-semibold text-foreground">
                                      Price: {formatCurrency(product.price)}
                                    </span>
                                  )}
                                  {product?.stockQuantity != null && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        product.stockQuantity === 0
                                          ? "border-red-300 text-red-600"
                                          : "border-green-300 text-green-600"
                                      }`}
                                    >
                                      {product.stockQuantity === 0 ? "Out of Stock" : `In Stock (${product.stockQuantity})`}
                                    </Badge>
                                  )}
                                  {product?.prescriptionRequired && (
                                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                                      Rx Required
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Reminder Details */}
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Reminder Details
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Frequency: </span>
                                  <span className="text-foreground">
                                    Every {reminder.intervalDays} days
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Next reminder: </span>
                                  <span className="text-foreground">
                                    {isDue
                                      ? "Due now"
                                      : nextDate.toLocaleDateString("en-IN", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Status: </span>
                                  <span className="text-foreground flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {reminder.isActive ? "Active" : "Inactive"}
                                  </span>
                                </div>
                                {reminder.createdAt && (
                                  <div>
                                    <span className="text-muted-foreground">Created: </span>
                                    <span className="text-foreground">
                                      {new Date(reminder.createdAt).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
