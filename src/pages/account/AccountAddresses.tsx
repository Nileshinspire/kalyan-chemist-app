import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MapPin,
  Home,
  Briefcase,
  Building2,
  Pencil,
  Trash2,
  Star,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

interface AddressForm {
  fullName: string;
  phone: string;
  houseFlat: string;
  building: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  addressType: "home" | "work" | "other";
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  fullName: "",
  phone: "",
  houseFlat: "",
  building: "",
  street: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
  addressType: "home",
  isDefault: false,
};

function AddressTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "home": return <Home className="size-3.5" />;
    case "work": return <Briefcase className="size-3.5" />;
    default: return <Building2 className="size-3.5" />;
  }
}

export default function AccountAddresses() {
  const addresses = useQuery(api.account.listAddresses);
  const addAddress = useMutation(api.account.addAddress);
  const updateAddress = useMutation(api.account.updateAddress);
  const deleteAddress = useMutation(api.account.deleteAddress);
  const setDefault = useMutation(api.account.setDefaultAddress);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (addr: any) => {
    setEditingId(addr._id);
    setForm({
      fullName: addr.fullName,
      phone: addr.phone,
      houseFlat: addr.houseFlat,
      building: addr.building || "",
      street: addr.street,
      area: addr.area || "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      landmark: addr.landmark || "",
      addressType: addr.addressType,
      isDefault: addr.isDefault,
    });
    setDialogOpen(true);
  };

  const validate = (): string | null => {
    if (!form.fullName.trim()) return "Full name is required";
    if (!form.phone.match(/^[6-9]\d{9}$/)) return "Invalid phone number (10 digits starting with 6-9)";
    if (!form.houseFlat.trim()) return "House/Flat is required";
    if (!form.street.trim()) return "Street is required";
    if (!form.city.trim()) return "City is required";
    if (!form.state) return "State is required";
    if (!form.pincode.match(/^\d{6}$/)) return "Pincode must be 6 digits";
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        houseFlat: form.houseFlat.trim(),
        building: form.building.trim() || undefined,
        street: form.street.trim(),
        area: form.area.trim() || undefined,
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        landmark: form.landmark.trim() || undefined,
        addressType: form.addressType,
        isDefault: form.isDefault,
      };

      if (editingId) {
        await updateAddress({ addressId: editingId as any, ...payload });
        toast.success("Address updated");
      } else {
        await addAddress(payload);
        toast.success("Address added");
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteAddress({ addressId: deleteDialogId as any });
      toast.success("Address deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
    setDeleteDialogId(null);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault({ addressId: id as any });
      toast.success("Default address updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  if (addresses === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Addresses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your delivery addresses
          </p>
        </div>
        <Button onClick={openAdd} className="gradient-primary text-white gap-2">
          <Plus className="size-4" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <MapPin className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No addresses yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a delivery address to get started
            </p>
            <Button onClick={openAdd} className="gradient-primary text-white gap-2">
              <Plus className="size-4" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {addresses.map((addr) => (
              <motion.div
                key={addr._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className={`border-border/60 relative ${addr.isDefault ? "border-primary/40 ring-1 ring-primary/10" : ""}`}>
                  {addr.isDefault && (
                    <div className="absolute -top-2 right-4">
                      <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                        <Star className="size-2.5" />
                        Default
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-primary/[0.06] flex items-center justify-center">
                          <AddressTypeIcon type={addr.addressType} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{addr.fullName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{addr.addressType}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-0.5 mb-4">
                      <p>{addr.houseFlat}{addr.building ? `, ${addr.building}` : ""}</p>
                      <p>{addr.street}{addr.area ? `, ${addr.area}` : ""}</p>
                      <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                      {addr.landmark && <p>Landmark: {addr.landmark}</p>}
                      <p className="font-medium text-foreground">Phone: {addr.phone}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => openEdit(addr)}
                      >
                        <Pencil className="size-3" />
                        Edit
                      </Button>
                      {!addr.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => handleSetDefault(addr._id)}
                        >
                          <Check className="size-3" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                        onClick={() => setDeleteDialogId(addr._id)}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Address" : "Add Address"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update your delivery address" : "Add a new delivery address"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Recipient name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="addrPhone">Phone *</Label>
              <Input
                id="addrPhone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </div>

            {/* House/Flat */}
            <div className="space-y-1.5">
              <Label htmlFor="houseFlat">House/Flat *</Label>
              <Input
                id="houseFlat"
                value={form.houseFlat}
                onChange={(e) => setForm({ ...form, houseFlat: e.target.value })}
                placeholder="e.g. Flat 4B, House No. 123"
              />
            </div>

            {/* Building */}
            <div className="space-y-1.5">
              <Label htmlFor="building">Building / Society</Label>
              <Input
                id="building"
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="e.g. Sunrise Apartments"
              />
            </div>

            {/* Street */}
            <div className="space-y-1.5">
              <Label htmlFor="street">Street *</Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                placeholder="Street name or road"
              />
            </div>

            {/* Area */}
            <div className="space-y-1.5">
              <Label htmlFor="area">Area / Locality</Label>
              <Input
                id="area"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="e.g. Andheri West"
              />
            </div>

            {/* City + State */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Select value={form.state} onValueChange={(val) => setForm({ ...form, state: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pincode + Landmark */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  placeholder="6-digit pincode"
                  maxLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="landmark">Landmark</Label>
                <Input
                  id="landmark"
                  value={form.landmark}
                  onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                  placeholder="Near..."
                />
              </div>
            </div>

            {/* Address Type */}
            <div className="space-y-1.5">
              <Label>Address Type</Label>
              <div className="flex gap-2">
                {(["home", "work", "other"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={form.addressType === type ? "default" : "outline"}
                    size="sm"
                    className={`gap-1.5 capitalize ${form.addressType === type ? "gradient-primary text-white" : ""}`}
                    onClick={() => setForm({ ...form, addressType: type })}
                  >
                    <AddressTypeIcon type={type} />
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Default */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="size-4 rounded border-gray-300"
              />
              <span className="text-sm text-foreground">Set as default address</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Update Address" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Address?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The address will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
