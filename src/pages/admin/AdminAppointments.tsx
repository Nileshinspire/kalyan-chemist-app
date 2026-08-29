import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  Calendar,
  User,
  Stethoscope,
  Eye,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminAppointments() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewingAppointment, setViewingAppointment] = useState<any>(null);

  const appointments = useQuery(api.appointments.adminListAppointments, {
    status: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
  });

  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);

  const handleStatusUpdate = async (appointmentId: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
    try {
      await updateStatus({ appointmentId: appointmentId as any, status });
      toast.success(`Appointment ${status}`);
      setViewingAppointment(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight">Doctor Appointments</h1>
          <p className="text-sm text-muted-foreground">Manage customer appointment bookings</p>
        </motion.div>

        {/* Filters */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer or doctor name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] rounded-xl">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {appointments === undefined ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No appointments found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || filterStatus !== "all" ? "Try different filters" : "No appointments have been booked yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => (
                      <TableRow key={apt._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{apt.customerName}</p>
                            <p className="text-xs text-muted-foreground">{apt.customerPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{apt.doctorName}</p>
                            <p className="text-xs text-muted-foreground">{apt.specialty}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{apt.appointmentDate}</p>
                            <p className="text-xs text-muted-foreground">{apt.appointmentTime}</p>
                          </div>
                        </TableCell>
                        <TableCell>₹{apt.consultationFee}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${STATUS_COLORS[apt.status] || ""}`}>
                            {apt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setViewingAppointment(apt)}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{appointments?.length ?? 0} appointment(s) total</p>

        {/* View / Manage Appointment Dialog */}
        <Dialog open={!!viewingAppointment} onOpenChange={() => setViewingAppointment(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            {viewingAppointment && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</p>
                    <p className="text-sm font-medium">{viewingAppointment.customerName}</p>
                    <p className="text-xs text-muted-foreground">{viewingAppointment.customerEmail}</p>
                    <p className="text-xs text-muted-foreground">{viewingAppointment.customerPhone}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Doctor</p>
                    <p className="text-sm font-medium">{viewingAppointment.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{viewingAppointment.specialty}</p>
                    {viewingAppointment.clinicName && (
                      <p className="text-xs text-muted-foreground">{viewingAppointment.clinicName}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appointment</p>
                    <p className="text-sm font-medium">{viewingAppointment.appointmentDate} at {viewingAppointment.appointmentTime}</p>
                    <p className="text-xs text-muted-foreground">Fee: ₹{viewingAppointment.consultationFee}</p>
                    {viewingAppointment.consultationType && (
                      <p className="text-xs text-muted-foreground">Type: {viewingAppointment.consultationType}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge className={`text-xs ${STATUS_COLORS[viewingAppointment.status] || ""}`}>
                      {viewingAppointment.status}
                    </Badge>
                    {viewingAppointment.notes && (
                      <p className="text-xs text-muted-foreground mt-1">Notes: {viewingAppointment.notes}</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["pending", "confirmed", "completed", "cancelled"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={viewingAppointment.status === status ? "default" : "outline"}
                        size="sm"
                        className={`text-xs capitalize ${viewingAppointment.status === status ? "gradient-primary text-white" : ""}`}
                        onClick={() => handleStatusUpdate(viewingAppointment._id, status)}
                        disabled={viewingAppointment.status === status}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Booked: {new Date(viewingAppointment.bookingDate).toLocaleString()}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
