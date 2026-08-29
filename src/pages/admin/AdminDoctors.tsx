import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCog,
  Loader2,
  ArrowLeft,
  X,
  Stethoscope,
} from "lucide-react";

const SPECIALTIES = [
  { key: "general-physician", label: "General Physician" },
  { key: "dermatology", label: "Dermatology" },
  { key: "obstetrics-gynaecology", label: "Obstetrics & Gynaecology" },
  { key: "orthopaedics", label: "Orthopaedics" },
  { key: "ent", label: "ENT" },
  { key: "neurology", label: "Neurology" },
  { key: "cardiology", label: "Cardiology" },
  { key: "urology", label: "Urology" },
  { key: "gastroenterology", label: "Gastroenterology/GI" },
  { key: "psychiatry", label: "Psychiatry" },
  { key: "paediatrics", label: "Paediatrics" },
  { key: "pulmonology", label: "Pulmonology" },
  { key: "endocrinology", label: "Endocrinology" },
  { key: "nephrology", label: "Nephrology" },
  { key: "neurosurgery", label: "Neurosurgery" },
  { key: "rheumatology", label: "Rheumatology" },
  { key: "ophthalmology", label: "Ophthalmology" },
  { key: "surgical-gastroenterology", label: "Surgical Gastroenterology" },
  { key: "infectious-disease", label: "Infectious Disease" },
  { key: "general-laparoscopic-surgery", label: "General & Laparoscopic Surgery" },
  { key: "psychology", label: "Psychology" },
  { key: "medical-oncology", label: "Medical Oncology" },
  { key: "diabetology", label: "Diabetology" },
  { key: "dentist", label: "Dentist" },
];

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface DoctorForm {
  name: string;
  specialty: string;
  qualification: string;
  experience: string;
  consultationFee: number;
  profilePhoto: string;
  clinicName: string;
  clinicAddress: string;
  city: string;
  state: string;
  pincode: string;
  aboutDoctor: string;
  languagesSpoken: string;
  consultationType: string[];
  availableDays: string[];
  availableTimeFrom: string;
  availableTimeTo: string;
  appointmentDuration: number;
  maxPatientsPerSlot: number;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
}

const EMPTY_FORM: DoctorForm = {
  name: "",
  specialty: "",
  qualification: "",
  experience: "",
  consultationFee: 500,
  profilePhoto: "",
  clinicName: "",
  clinicAddress: "",
  city: "",
  state: "",
  pincode: "",
  aboutDoctor: "",
  languagesSpoken: "English, Hindi",
  consultationType: ["In-Person"],
  availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  availableTimeFrom: "09:00",
  availableTimeTo: "17:00",
  appointmentDuration: 30,
  maxPatientsPerSlot: 1,
  contactPhone: "",
  contactEmail: "",
  isActive: true,
};

export default function AdminDoctors() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const doctorCounts = useQuery(api.doctors.doctorCountBySpecialty);
  const doctors = useQuery(api.doctors.adminListDoctors, {
    specialty: selectedSpecialty || undefined,
    search: search || undefined,
  });

  const createDoctor = useMutation(api.doctors.createDoctor);
  const updateDoctor = useMutation(api.doctors.updateDoctor);
  const deleteDoctor = useMutation(api.doctors.deleteDoctor);
  const toggleActive = useMutation(api.doctors.toggleDoctorActive);

  const specialtyLabel = (key: string) =>
    SPECIALTIES.find((s) => s.key === key)?.label || key;

  const openCreate = (specialty?: string) => {
    setEditingDoctor(null);
    setForm({ ...EMPTY_FORM, specialty: specialty || "" });
    setDialogOpen(true);
  };

  const openEdit = (doctor: any) => {
    setEditingDoctor(doctor._id);
    setForm({
      name: doctor.name,
      specialty: doctor.specialty,
      qualification: doctor.qualification || "",
      experience: doctor.experience || "",
      consultationFee: doctor.consultationFee,
      profilePhoto: doctor.profilePhoto || "",
      clinicName: doctor.clinicName || "",
      clinicAddress: doctor.clinicAddress || "",
      city: doctor.city || "",
      state: doctor.state || "",
      pincode: doctor.pincode || "",
      aboutDoctor: doctor.aboutDoctor || "",
      languagesSpoken: doctor.languagesSpoken?.join(", ") || "English, Hindi",
      consultationType: doctor.consultationType || ["In-Person"],
      availableDays: doctor.availableDays || ["monday", "tuesday", "wednesday", "thursday", "friday"],
      availableTimeFrom: doctor.availableTimeFrom || "09:00",
      availableTimeTo: doctor.availableTimeTo || "17:00",
      appointmentDuration: doctor.appointmentDuration || 30,
      maxPatientsPerSlot: doctor.maxPatientsPerSlot || 1,
      contactPhone: doctor.contactPhone || "",
      contactEmail: doctor.contactEmail || "",
      isActive: doctor.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.specialty) {
      toast.error("Please fill in doctor name and specialty");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        specialty: form.specialty,
        qualification: form.qualification || undefined,
        experience: form.experience || undefined,
        consultationFee: form.consultationFee,
        profilePhoto: form.profilePhoto || undefined,
        clinicName: form.clinicName || undefined,
        clinicAddress: form.clinicAddress || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        aboutDoctor: form.aboutDoctor || undefined,
        languagesSpoken: form.languagesSpoken
          ? form.languagesSpoken.split(",").map((l) => l.trim()).filter(Boolean)
          : undefined,
        consultationType: form.consultationType.length > 0 ? form.consultationType : undefined,
        availableDays: form.availableDays.length > 0 ? form.availableDays : undefined,
        availableTimeFrom: form.availableTimeFrom || undefined,
        availableTimeTo: form.availableTimeTo || undefined,
        appointmentDuration: form.appointmentDuration || undefined,
        maxPatientsPerSlot: form.maxPatientsPerSlot || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        isActive: form.isActive,
      };

      if (editingDoctor) {
        await updateDoctor({ doctorId: editingDoctor as any, ...data });
        toast.success("Doctor updated successfully");
      } else {
        await createDoctor(data);
        toast.success("Doctor added successfully");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save doctor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doctorId: string) => {
    try {
      await deleteDoctor({ doctorId: doctorId as any });
      toast.success("Doctor deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete doctor");
    }
  };

  const handleToggleActive = async (doctorId: string, isActive: boolean) => {
    try {
      await toggleActive({ doctorId: doctorId as any, isActive });
      toast.success(isActive ? "Doctor activated" : "Doctor deactivated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update doctor");
    }
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const toggleConsultType = (type: string) => {
    setForm((prev) => ({
      ...prev,
      consultationType: prev.consultationType.includes(type)
        ? prev.consultationType.filter((t) => t !== type)
        : [...prev.consultationType, type],
    }));
  };

  // ── Specialty Grid View ──
  if (view === "grid" && !selectedSpecialty) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold tracking-tight">Doctors</h1>
            <p className="text-sm text-muted-foreground">Manage doctors by specialty</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {SPECIALTIES.map((spec) => {
              const count = doctorCounts?.[spec.key] || 0;
              return (
                <button
                  key={spec.key}
                  onClick={() => setSelectedSpecialty(spec.key)}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-all duration-300 hover:shadow-md hover:border-primary/30 cursor-pointer"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary/70 group-hover:bg-primary/15 group-hover:text-primary transition-all">
                    <Stethoscope className="size-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {spec.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{count} doctors</Badge>
                </button>
              );
            })}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ── Doctor List View ──
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => { setSelectedSpecialty(null); setSearch(""); }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2 cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              All Specialties
            </button>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedSpecialty ? specialtyLabel(selectedSpecialty) : "All Doctors"}
            </h1>
            <p className="text-sm text-muted-foreground">{doctors?.length ?? 0} doctor(s)</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search doctors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl w-60"
              />
            </div>
            <Button onClick={() => openCreate(selectedSpecialty || undefined)} className="gradient-primary text-white shadow-glow">
              <Plus className="mr-2 size-4" /> Add Doctor
            </Button>
          </div>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="p-0">
            {doctors === undefined ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : doctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <UserCog className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No doctors found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? "Try a different search term" : "Add your first doctor to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doctor) => (
                      <TableRow key={doctor._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{doctor.name}</p>
                            <p className="text-xs text-muted-foreground">{doctor.qualification || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{specialtyLabel(doctor.specialty)}</Badge>
                        </TableCell>
                        <TableCell>₹{doctor.consultationFee}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doctor.clinicName || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doctor.city || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={doctor.isActive ? "default" : "secondary"} className={`text-xs ${doctor.isActive ? "bg-green-100 text-green-700" : ""}`}>
                            {doctor.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(doctor)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`size-8 ${doctor.isActive ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                              onClick={() => handleToggleActive(doctor._id, !doctor.isActive)}
                            >
                              {doctor.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(doctor._id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDoctor ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Doctor Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Full Name" />
              </div>
              <div className="space-y-2">
                <Label>Specialty *</Label>
                <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qualification</Label>
                <Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="MBBS, MD" />
              </div>
              <div className="space-y-2">
                <Label>Experience</Label>
                <Input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="10 years" />
              </div>
              <div className="space-y-2">
                <Label>Consultation Fee (₹)</Label>
                <Input type="number" value={form.consultationFee || ""} onChange={(e) => setForm({ ...form, consultationFee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Profile Photo URL</Label>
                <Input value={form.profilePhoto} onChange={(e) => setForm({ ...form, profilePhoto: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Clinic/Hospital Name</Label>
                <Input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} placeholder="Hospital name" />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+91..." />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Clinic/Hospital Address</Label>
                <Input value={form.clinicAddress} onChange={(e) => setForm({ ...form, clinicAddress: e.target.value })} placeholder="Full address" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="400001" />
              </div>
              <div className="space-y-2">
                <Label>Languages Spoken</Label>
                <Input value={form.languagesSpoken} onChange={(e) => setForm({ ...form, languagesSpoken: e.target.value })} placeholder="English, Hindi" />
                <p className="text-[11px] text-muted-foreground">Comma separated</p>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>About Doctor</Label>
                <Input value={form.aboutDoctor} onChange={(e) => setForm({ ...form, aboutDoctor: e.target.value })} placeholder="Brief description about the doctor" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Consultation Type</Label>
                <div className="flex flex-wrap gap-2">
                  {["In-Person", "Online", "Video Call", "Phone"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleConsultType(type)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        form.consultationType.includes(type)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Available Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                        form.availableDays.includes(day)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Available Time From</Label>
                <Input type="time" value={form.availableTimeFrom} onChange={(e) => setForm({ ...form, availableTimeFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Available Time To</Label>
                <Input type="time" value={form.availableTimeTo} onChange={(e) => setForm({ ...form, availableTimeTo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Appointment Duration (min)</Label>
                <Select value={String(form.appointmentDuration)} onValueChange={(v) => setForm({ ...form, appointmentDuration: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 20, 30, 45, 60].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Patients Per Slot</Label>
                <Input type="number" value={form.maxPatientsPerSlot || ""} onChange={(e) => setForm({ ...form, maxPatientsPerSlot: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {editingDoctor ? "Update" : "Add Doctor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Doctor</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
