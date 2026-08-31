import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FileText,
  Download,
  Eye,
  Clock,
  FlaskConical,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function AccountLabReports() {
  const bookings = useQuery(api.labTests.myBookingsWithReports);

  if (bookings === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lab Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and download your lab test reports
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
          <FlaskConical className="mx-auto size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            No lab test bookings yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Book a lab test to see your reports here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Lab Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and download your lab test reports
        </p>
      </div>

      <div className="space-y-3">
        {bookings.map((booking) => {
          const reportStatus = booking.reportStatus || "pending";
          const hasReport = !!booking.reportFileId;

          return (
            <div
              key={booking._id}
              className="rounded-xl border border-border/60 bg-card p-4 transition-all hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {booking.testName}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {booking.testType === "package" ? "Package" : "Single Test"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {booking.collectionDate}
                    </span>
                    <span>{booking.timeSlot}</span>
                    <span>{booking.categoryName}</span>
                  </div>

                  {/* Report Status */}
                  <div className="flex items-center gap-2">
                    {reportStatus === "ready" && hasReport ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 border border-green-200">
                        <CheckCircle2 className="size-3" />
                        Report Ready
                      </span>
                    ) : reportStatus === "processing" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                        <Clock className="size-3" />
                        Processing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 border border-yellow-200">
                        <Clock className="size-3" />
                        Report Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {reportStatus === "ready" && hasReport ? (
                    <>
                      <ReportViewButton
                        bookingId={booking._id}
                        fileName={booking.reportFileName || "report"}
                      />
                      <ReportDownloadButton
                        bookingId={booking._id}
                        fileName={booking.reportFileName || "report"}
                        testName={booking.testName}
                      />
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Report not available yet
                    </p>
                  )}
                </div>
              </div>

              {!(reportStatus === "ready" && hasReport) && (
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Your report will appear here once it is uploaded and marked ready.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── View Report Button ── */
function ReportViewButton({
  bookingId,
  fileName,
}: {
  bookingId: string;
  fileName: string;
}) {
  const reportUrl = useQuery(api.labTests.getReportUrl, {
    bookingId: bookingId as never,
  });

  if (!reportUrl) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
      >
        <Eye className="size-3" />
        View
      </button>
    );
  }

  return (
    <a
      href={reportUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
    >
      <Eye className="size-3" />
      View
    </a>
  );
}

/* ── Download Report Button ── */
function ReportDownloadButton({
  bookingId,
  fileName,
  testName,
}: {
  bookingId: string;
  fileName: string;
  testName: string;
}) {
  const reportUrl = useQuery(api.labTests.getReportUrl, {
    bookingId: bookingId as never,
  });

  if (!reportUrl) {
    return null;
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(reportUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const ext = fileName.split(".").pop() || "pdf";
      const cleanName = testName.replace(/[^a-zA-Z0-9]/g, "");
      link.href = url;
      link.download = `KalyanChemist_${cleanName}_Report.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error("Download failed");
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
    >
      <Download className="size-3" />
      Download
    </button>
  );
}
