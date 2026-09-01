import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNavigate } from "react-router";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  FlaskConical,
  Calendar,
  Clock,
  MapPin,
  Home,
  Download,
  Eye,
  CheckCircle2,
  Circle,
  XCircle,
  FileText,
  CreditCard,
  ChevronRight,
  Lock,
  Loader2,
} from "lucide-react";

/* ── Status step definitions ── */
const LAB_STEPS = [
  { key: "pending", label: "Booking Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "sample_collection_scheduled", label: "Collection Scheduled" },
  { key: "sample_collected", label: "Sample Collected" },
  { key: "report_ready", label: "Report Ready" },
  { key: "completed", label: "Completed" },
];

const CANCELLED_STATUSES = ["cancelled"];

function getStatusIndex(status: string): number {
  return LAB_STEPS.findIndex((s) => s.key === status);
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    sample_collection_scheduled: "bg-indigo-50 text-indigo-700 border-indigo-200",
    sample_collected: "bg-purple-50 text-purple-700 border-purple-200",
    report_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    sample_collection_scheduled: "Collection Scheduled",
    sample_collected: "Sample Collected",
    report_ready: "Report Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}

/* ── Status Tracker ── */
function StatusTracker({ status }: { status: string }) {
  if (CANCELLED_STATUSES.includes(status)) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4">
        <XCircle className="size-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-700">Booking Cancelled</p>
          <p className="text-xs text-red-600">This booking has been cancelled.</p>
        </div>
      </div>
    );
  }

  const currentIdx = getStatusIndex(status);

  return (
    <div className="space-y-0">
      {LAB_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle2 className="size-5 text-[#0a3d2e] shrink-0" />
              ) : isCurrent ? (
                <div className="size-5 rounded-full border-2 border-[#0a3d2e] bg-[#0a3d2e]/10 flex items-center justify-center shrink-0">
                  <div className="size-2 rounded-full bg-[#0a3d2e]" />
                </div>
              ) : (
                <Circle className="size-5 text-gray-300 shrink-0" />
              )}
              {idx < LAB_STEPS.length - 1 && (
                <div className={`w-0.5 h-6 ${isCompleted ? "bg-[#0a3d2e]" : "bg-gray-200"}`} />
              )}
            </div>
            <div className={`pb-4 ${isFuture ? "text-gray-400" : "text-foreground"}`}>
              <p className={`text-sm ${isCurrent ? "font-bold" : isCompleted ? "font-medium" : "font-normal"}`}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Report Section (payment-gated) ── */
function ReportSection({ booking }: { booking: any }) {
  const reportStatus = String(booking.reportStatus || "pending");
  const paymentStatus = String(booking.paymentStatus || "pending");
  const hasReport = !!booking.reportFileId;
  const finalAmount = Number(booking.finalAmount) || 0;
  const isPaid = paymentStatus === "paid";

  // Backend enforces access — this query returns null if unpaid
  const reportUrl = useQuery(
    api.labTests.getReportUrl,
    hasReport ? { bookingId: booking._id as Id<"lab_bookings"> } : "skip",
  );

  // ── STATE 1: Payment Pending + Report Pending ──
  if (!isPaid && (reportStatus === "pending" || reportStatus === "processing") && !hasReport) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="size-4 text-yellow-600" />
          <p className="text-sm font-bold text-yellow-800">Payment Pending</p>
        </div>
        <p className="text-xs text-yellow-700">
          Report will be available after processing and successful payment.
        </p>
        <PayNowButton booking={booking} amount={finalAmount} />
      </div>
    );
  }

  // ── STATE 2: Payment Pending + Report Ready ──
  if (!isPaid && reportStatus === "ready" && hasReport) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="size-4 text-amber-600" />
          <p className="text-sm font-bold text-amber-800">Payment Required</p>
        </div>
        <p className="text-xs text-amber-700 mb-3">
          Please complete the payment to view or download your lab report.
        </p>
        <PayNowButton booking={booking} amount={finalAmount} />
      </div>
    );
  }

  // ── STATE 3: Payment Paid + Report Pending ──
  if (isPaid && reportStatus === "pending" && !hasReport) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-gray-400" />
          <p className="text-sm text-gray-600">Report not available yet</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Your report will appear here once it is uploaded and marked ready.
        </p>
      </div>
    );
  }

  // ── STATE 4: Payment Paid + Report Processing ──
  if (isPaid && reportStatus === "processing") {
    return (
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-blue-700">Your report is being processed.</p>
        </div>
        <p className="text-xs text-blue-500 mt-1">
          You will be notified once it is ready for download.
        </p>
      </div>
    );
  }

  // ── STATE 5: Payment Paid + Report Ready ──
  if (isPaid && reportStatus === "ready" && hasReport && reportUrl) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="size-5 text-green-600" />
          <p className="text-sm font-bold text-green-800">Your Report is Ready</p>
        </div>
        <div className="flex gap-2">
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
          >
            <Eye className="size-3.5" />
            View Report
          </a>
          <ReportDownloadBtn url={reportUrl} fileName={booking.reportFileName as string} testName={String(booking.testName)} />
        </div>
      </div>
    );
  }

  // ── Fallback: Paid but report URL not available yet ──
  if (isPaid) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-gray-400" />
          <p className="text-sm text-gray-600">Report not available yet</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Your report will appear here once it is uploaded and marked ready.
        </p>
      </div>
    );
  }

  // ── Unpaid fallback ──
  return (
    <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="size-4 text-yellow-600" />
        <p className="text-sm font-bold text-yellow-800">Payment Required</p>
      </div>
      <p className="text-xs text-yellow-700 mb-3">
        Please complete the payment to view or download your lab report.
      </p>
      <PayNowButton booking={booking} amount={finalAmount} />
    </div>
  );
}

function ReportDownloadBtn({ url, fileName, testName }: { url: string; fileName: string; testName: string }) {
  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const ext = (fileName || "report").split(".").pop() || "pdf";
      const cleanName = testName.replace(/[^a-zA-Z0-9]/g, "");
      link.href = blobUrl;
      link.download = `KalyanChemist_${cleanName}_Report.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      console.error("Download failed");
    }
  };
  return (
    <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a3d2e] px-3 py-2 text-xs font-medium text-white hover:bg-[#082f23] transition-colors">
      <Download className="size-3.5" />
      Download
    </button>
  );
}

/* ── Pay Now Button (Razorpay) ── */
function PayNowButton({ booking, amount }: { booking: any; amount: number }) {
  const [paying, setPaying] = useState(false);
  const payLabTestBooking = useMutation(api.labTests.payLabTestBooking);

  const handlePay = useCallback(async () => {
    if (paying) return;
    setPaying(true);

    try {
      // Check if Razorpay is loaded
      const w = window as any;
      if (!w.Razorpay) {
        // Razorpay not configured — mark as paid directly for demo
        await payLabTestBooking({
          bookingId: booking._id as Id<"lab_bookings">,
        });
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
        amount: amount * 100, // Razorpay expects paise
        currency: "INR",
        name: "Kalyan Chemist",
        description: `Payment for ${booking.testName}`,
        handler: async (response: any) => {
          try {
            await payLabTestBooking({
              bookingId: booking._id as Id<"lab_bookings">,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch (err) {
            console.error("Payment recording failed:", err);
          } finally {
            setPaying(false);
          }
        },
        prefill: {
          name: booking.customerName || "",
          email: booking.customerEmail || "",
          contact: booking.customerPhone || "",
        },
        theme: {
          color: "#0a3d2e",
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new w.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay error:", err);
      setPaying(false);
    }
  }, [paying, booking, amount, payLabTestBooking]);

  return (
    <button
      onClick={handlePay}
      disabled={paying || amount <= 0}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a3d2e] px-4 py-2 text-xs font-bold text-white hover:bg-[#082f23] transition-colors disabled:opacity-50"
    >
      {paying ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <CreditCard className="size-3.5" />
      )}
      Pay Now
      {amount > 0 && <span className="ml-1">₹{amount.toLocaleString("en-IN")}</span>}
    </button>
  );
}

/* ══════════════════════════════════════════════════════ */
/* ── MAIN PAGE ── */
/* ══════════════════════════════════════════════════════ */

export default function AccountLabTests() {
  const navigate = useNavigate();
  const bookings = useQuery(api.labTests.myBookingsWithReports);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  /* ── Loading ── */
  if (bookings === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ── Empty ── */
  if (bookings.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Lab Tests</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your lab test bookings and reports</p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
          <FlaskConical className="mx-auto size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Lab Tests Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Your lab test bookings will appear here.</p>
          <button onClick={() => navigate("/lab-tests")} className="rounded-xl bg-[#0a3d2e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#082f23] transition-colors">
            Explore Lab Tests
          </button>
        </div>
      </div>
    );
  }

  /* ── Split upcoming / past ── */
  const now = new Date().toISOString().split("T")[0];
  const upcoming = bookings.filter((b) => b.collectionDate >= now && !CANCELLED_STATUSES.includes(b.bookingStatus));
  const past = bookings.filter((b) => b.collectionDate < now || CANCELLED_STATUSES.includes(b.bookingStatus));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Lab Tests</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your lab test bookings and reports</p>
      </div>

      {/* ── Detail View ── */}
      {selectedBooking && (
        <BookingDetail booking={selectedBooking} onBack={() => setSelectedBooking(null)} />
      )}

      {/* ── Upcoming ── */}
      {!selectedBooking && upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b._id} booking={b} onClick={() => setSelectedBooking(b)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Past & Completed ── */}
      {!selectedBooking && past.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Past & Completed</h2>
          <div className="space-y-3">
            {past.map((b) => (
              <BookingCard key={b._id} booking={b} onClick={() => setSelectedBooking(b)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Booking Card ── */
function BookingCard({ booking, onClick }: { booking: any; onClick: () => void }) {
  const isCancelled = CANCELLED_STATUSES.includes(String(booking.bookingStatus));
  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-all hover:shadow-sm cursor-pointer ${isCancelled ? "border-red-200 opacity-75" : "border-border/60"}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="size-10 rounded-xl bg-[#0a3d2e]/8 flex items-center justify-center shrink-0">
            <FlaskConical className="size-4 text-[#0a3d2e]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-foreground truncate">{String(booking.testName)}</h3>
              <StatusBadge status={booking.bookingStatus as string} />
            </div>
            <p className="text-xs text-muted-foreground">{booking.categoryName as string} · {booking.testType === "package" ? "Package" : "Single Test"}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="size-3" />{booking.collectionDate as string}</span>
              <span className="flex items-center gap-1"><Clock className="size-3" />{booking.timeSlot as string}</span>
              <span className="flex items-center gap-1">
                {booking.collectionType === "home" ? <Home className="size-3" /> : <MapPin className="size-3" />}
                {booking.collectionType === "home" ? "Home Collection" : "Lab Visit"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">₹{(Number(booking.finalAmount)).toLocaleString("en-IN")}</p>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <CreditCard className="size-3 text-muted-foreground" />
            <span className={`text-[10px] font-medium ${booking.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"}`}>
              {booking.paymentStatus === "paid" ? "Paid" : "Pending"}
            </span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground mt-2 ml-auto" />
        </div>
      </div>
    </div>
  );
}

/* ── Booking Detail ── */
function BookingDetail({ booking, onBack }: { booking: any; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Breadcrumb items={[
        { label: "Account", href: "/account" },
        { label: "My Lab Tests", href: "/account/my-lab-tests" },
        { label: String(booking.testName) },
      ]} />

      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{String(booking.testName)}</h2>
            <p className="text-sm text-muted-foreground">{booking.categoryName as string}</p>
          </div>
          <StatusBadge status={booking.bookingStatus as string} />
        </div>
        <StatusTracker status={booking.bookingStatus as string} />
      </div>

      {/* Report */}
      <ReportSection booking={booking} />

      {/* Booking Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Booking Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Booking ID</span><span className="font-medium">KC-LT-{String(booking._id).slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Booked On</span><span className="font-medium">{new Date(Number(booking.createdAt)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{booking.testType as string}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">₹{(Number(booking.finalAmount)).toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span>
              <span className={`font-medium ${booking.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"}`}>
                {booking.paymentStatus === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Collection Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{booking.collectionType === "home" ? "Home Collection" : "Lab Visit"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{booking.collectionDate as string}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{booking.timeSlot as string}</span></div>
            {booking.address && <div className="pt-2 border-t border-border/40"><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium mt-0.5">{booking.address as string}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
