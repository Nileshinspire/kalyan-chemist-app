import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  MessageCircle,
  ShoppingCart,
  Pill,
  Eye,
  EyeOff,
  Loader2,
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  CheckCircle,
  StickyNote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Pill; color: string; bgColor: string }
> = {
  enquiry: {
    label: "Enquiry",
    icon: MessageCircle,
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  order: {
    label: "WhatsApp Order",
    icon: ShoppingCart,
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  cart: {
    label: "Cart Enquiry",
    icon: ShoppingCart,
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  product: {
    label: "Product Enquiry",
    icon: Pill,
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
};

export default function AdminWhatsApp() {
  const stats = useQuery(api.whatsappEnquiries.stats);
  const enquiries = useQuery(api.whatsappEnquiries.list);
  const markViewed = useMutation(api.whatsappEnquiries.markViewed);
  const markAllViewed = useMutation(api.whatsappEnquiries.markAllViewed);
  const addNotes = useMutation(api.whatsappEnquiries.addNotes);

  const [filter, setFilter] = useState<string>("all");
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const handleMarkAllViewed = async () => {
    try {
      const result = await markAllViewed();
      toast.success(`Marked ${result.count} enquiry(s) as viewed`);
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as viewed");
    }
  };

  const handleMarkViewed = async (id: string) => {
    try {
      await markViewed({ enquiryId: id as any });
    } catch (error: any) {
      toast.error(error.message || "Failed");
    }
  };

  const handleSaveNotes = async () => {
    if (!notesId || !notesText.trim()) return;
    try {
      await addNotes({ enquiryId: notesId as any, notes: notesText.trim() });
      toast.success("Notes saved");
      setNotesId(null);
      setNotesText("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save notes");
    }
  };

  const filteredEnquiries =
    enquiries?.filter((e) => {
      if (filter === "all") return true;
      if (filter === "unread") return !e.viewed;
      return e.type === filter;
    }) ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageCircle className="size-6 text-green-600" />
              WhatsApp Enquiries & Orders
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track customer enquiries and orders received through WhatsApp
            </p>
          </div>
          {stats && stats.unviewed > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleMarkAllViewed}
            >
              <CheckCircle className="size-3.5" />
              Mark All Read ({stats.unviewed})
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 grid-cols-2 sm:grid-cols-4"
          >
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                    <MessageCircle className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">
                      Total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">
                      {stats.orders}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp Orders
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <ShoppingCart className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">{stats.enquiries}</p>
                    <p className="text-xs text-muted-foreground">
                      General Enquiries
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">{stats.todayCount}</p>
                    <p className="text-xs text-muted-foreground">Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Weekly Overview Bar */}
        {stats && stats.last7Days && (
          <Card className="border-border/60">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                Last 7 Days Activity
              </h3>
              <div className="flex items-end gap-2 h-24">
                {stats.last7Days.map((day) => {
                  const maxCount = Math.max(
                    ...stats.last7Days.map((d) => d.count),
                    1
                  );
                  const height = (day.count / maxCount) * 100;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {day.count}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-primary/80 transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {day.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "enquiry", label: "General Enquiries" },
            { key: "order", label: "WhatsApp Orders" },
            { key: "cart", label: "Cart Enquiries" },
            { key: "product", label: "Product Enquiries" },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? "default" : "outline"}
              size="sm"
              className="text-xs rounded-lg"
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Enquiries Table */}
        {enquiries === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="p-12 text-center">
              <MessageCircle className="size-10 text-muted-foreground/40 mx-auto mb-3" />                <p className="text-sm font-medium text-muted-foreground">
                  No records found
                </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
            {filter === "all"
              ? "No WhatsApp enquiries or orders have been recorded yet."
              : "No enquiries match the selected filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnquiries.map((enquiry) => {
                    const config = TYPE_CONFIG[enquiry.type] ?? TYPE_CONFIG.enquiry;
                    const Icon = config.icon;
                    return (
                      <TableRow
                        key={enquiry._id}
                        className={`${!enquiry.viewed ? "bg-primary/[0.02]" : ""}`}
                      >
                        <TableCell>
                          {!enquiry.viewed ? (
                            <div className="size-2 rounded-full bg-green-500" />
                          ) : (
                            <div className="size-2 rounded-full bg-transparent" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`gap-1 text-xs ${config.color} ${config.bgColor}`}
                          >
                            <Icon className="size-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium max-w-[240px] truncate">
                            {enquiry.summary}
                          </p>
                          {enquiry.productName && (
                            <p className="text-xs text-muted-foreground">
                              Product: {enquiry.productName}
                            </p>
                          )}
                          {enquiry.available !== undefined && enquiry.type === "order" && (
                            <p className={`text-xs font-medium mt-0.5 ${enquiry.available ? "text-green-600" : "text-red-600"}`}>
                              {enquiry.available ? "✓ Available" : "✗ Unavailable"}
                              {enquiry.requestedQuantity ? ` (Qty: ${enquiry.requestedQuantity})` : ""}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {enquiry.customerName ? (
                              <span className="font-medium">
                                {enquiry.customerName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {enquiry.customerPhone && (
                              <p className="text-xs text-muted-foreground">
                                {enquiry.customerPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {enquiry.totalAmount ? (
                            <span className="text-sm font-semibold">
                              ₹{enquiry.totalAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                          {enquiry.itemCount && (
                            <p className="text-xs text-muted-foreground">
                              {enquiry.itemCount} item(s)
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(enquiry.createdAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!enquiry.viewed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="Mark as viewed"
                                onClick={() => handleMarkViewed(enquiry._id)}
                              >
                                <Eye className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Add notes"
                              onClick={() => {
                                setNotesId(enquiry._id);
                                setNotesText(enquiry.adminNotes || "");
                              }}
                            >
                              <StickyNote className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Notes Dialog */}
        {notesId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-bold">Admin Notes</h3>
                <textarea
                  className="w-full h-28 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="Add notes about this enquiry..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNotesId(null);
                      setNotesText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
