import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/auth-utils";
import {
  Pill,
  Clock,
  User,
  CalendarClock,
} from "lucide-react";

export default function AdminRefills() {
  const [selectedReminder, setSelectedReminder] = useState<any>(null);

  const allReminders = useQuery(api.adminRefills.listAllReminders);

  const isLoading = allReminders === undefined;
  const activeReminders = allReminders?.filter((r) => r.isActive) ?? [];
  const sortedReminders = [...activeReminders].sort(
    (a, b) => a.nextReminderAt - b.nextReminderAt
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medicine Refills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor customer refill reminders
          </p>
        </div>

        {/* Upcoming Reminders */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Upcoming Reminders
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : sortedReminders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                  <CalendarClock className="size-7 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  No upcoming reminders
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Customer reminders will appear here once set.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedReminders.slice(0, 20).map((reminder) => {
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
                      selectedReminder?._id === reminder._id
                        ? "border-primary ring-1 ring-primary/20"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedReminder(
                        selectedReminder?._id === reminder._id
                          ? null
                          : reminder
                      )
                    }
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-8 items-center justify-center rounded-lg ${
                              isDue
                                ? "bg-amber-100 text-amber-600"
                                : "bg-violet-100 text-violet-600"
                            }`}
                          >
                            <CalendarClock className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {customer?.name || "Customer"} →{" "}
                              {product?.name || "Medicine"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Every {reminder.intervalDays} days · Next:{" "}
                              {isDue
                                ? "Due now"
                                : nextDate.toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })}
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
                                    {product.stockQuantity === 0
                                      ? "Out of Stock"
                                      : `In Stock (${product.stockQuantity})`}
                                  </Badge>
                                )}
                                {product?.prescriptionRequired && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-orange-300 text-orange-600"
                                  >
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
                                <span className="text-muted-foreground">
                                  Frequency:{" "}
                                </span>
                                <span className="text-foreground">
                                  Every {reminder.intervalDays} days
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Next reminder:{" "}
                                </span>
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
                                <span className="text-muted-foreground">
                                  Status:{" "}
                                </span>
                                <span className="text-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {reminder.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              {reminder.createdAt && (
                                <div>
                                  <span className="text-muted-foreground">
                                    Created:{" "}
                                  </span>
                                  <span className="text-foreground">
                                    {new Date(
                                      reminder.createdAt
                                    ).toLocaleDateString("en-IN", {
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
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
