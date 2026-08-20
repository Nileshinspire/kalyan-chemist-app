import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Truck,
  Phone,
  Building2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDeliverySettings() {
  const config = useQuery(api.deliveryConfig.get);
  const upsertConfig = useMutation(api.deliveryConfig.upsert);
  const addPincode = useMutation(api.deliveryConfig.addPincode);
  const removePincode = useMutation(api.deliveryConfig.removePincode);
  const togglePincode = useMutation(api.deliveryConfig.togglePincode);

  // ── Store info state ──
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeWhatsApp, setStoreWhatsApp] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [defaultFee, setDefaultFee] = useState("49");
  const [freeThreshold, setFreeThreshold] = useState("500");
  const [minOrder, setMinOrder] = useState("0");
  const [estTime, setEstTime] = useState("2-4 hours");
  const [codAvailable, setCodAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Pincode dialog state ──
  const [showPincodeDialog, setShowPincodeDialog] = useState(false);
  const [newPincode, setNewPincode] = useState("");
  const [newPinArea, setNewPinArea] = useState("");
  const [newPinFee, setNewPinFee] = useState("");
  const [newPinMinOrder, setNewPinMinOrder] = useState("");
  const [newPinEstTime, setNewPinEstTime] = useState("");
  const [newPinCod, setNewPinCod] = useState(true);
  const [newPinActive, setNewPinActive] = useState(true);
  const [addingPin, setAddingPin] = useState(false);

  // Hydrate form from config
  if (config && !storeName && config.storeName) {
    setStoreName(config.storeName);
    setStoreAddress(config.storeAddress);
    setStorePhone(config.storePhone);
    setStoreWhatsApp(config.storeWhatsApp || "");
    setBusinessHours(config.businessHours);
    setDefaultFee(String(config.defaultDeliveryFee));
    setFreeThreshold(String(config.freeDeliveryThreshold));
    setMinOrder(String(config.minimumOrder));
    setEstTime(config.estimatedDeliveryTime);
    setCodAvailable(config.defaultCodAvailable);
  }

  const handleSave = async () => {
    if (!storeName || !storeAddress || !storePhone) {
      toast.error("Please fill in store name, address, and phone");
      return;
    }
    setSaving(true);
    try {
      await upsertConfig({
        storeName,
        storeAddress,
        storePhone,
        storeWhatsApp: storeWhatsApp || undefined,
        businessHours,
        defaultDeliveryFee: Number(defaultFee) || 0,
        freeDeliveryThreshold: Number(freeThreshold) || 500,
        minimumOrder: Number(minOrder) || 0,
        estimatedDeliveryTime: estTime,
        defaultCodAvailable: codAvailable,
        pincodes: config?.pincodes || [],
      });
      toast.success("Delivery settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPincode = async () => {
    if (!newPincode || newPincode.length !== 6) {
      toast.error("Enter a valid 6-digit pincode");
      return;
    }
    setAddingPin(true);
    try {
      await addPincode({
        pincode: newPincode.trim(),
        area: newPinArea.trim() || newPincode,
        isActive: newPinActive,
        deliveryFee: newPinFee ? Number(newPinFee) : undefined,
        minimumOrder: newPinMinOrder ? Number(newPinMinOrder) : undefined,
        estimatedDeliveryTime: newPinEstTime || undefined,
        codAvailable: newPinCod,
      });
      toast.success(`Pincode ${newPincode} added`);
      setShowPincodeDialog(false);
      setNewPincode("");
      setNewPinArea("");
      setNewPinFee("");
      setNewPinMinOrder("");
      setNewPinEstTime("");
    } catch (e: any) {
      toast.error(e.message || "Failed to add pincode");
    } finally {
      setAddingPin(false);
    }
  };

  const handleRemovePincode = async (pincode: string) => {
    try {
      await removePincode({ pincode });
      toast.success(`Pincode ${pincode} removed`);
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    }
  };

  const handleTogglePincode = async (pincode: string) => {
    try {
      await togglePincode({ pincode });
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle");
    }
  };

  const pincodes = config?.pincodes || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery Settings</h1>
          <p className="text-sm text-muted-foreground">Configure store information, delivery areas, and pincode availability</p>
        </motion.div>

        {config === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Store Information ── */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="size-4" /> Store Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Store Name</Label>
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Kalyan Chemist" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Store Address</Label>
                  <Textarea value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Full store address" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={storeWhatsApp} onChange={(e) => setStoreWhatsApp(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Hours</Label>
                  <Input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} placeholder="Mon-Sat: 9 AM - 10 PM" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-white gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* ── Delivery Configuration ── */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Truck className="size-4" /> Delivery Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Default Delivery Fee (₹)</Label>
                    <Input type="number" value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Free Delivery Above (₹)</Label>
                    <Input type="number" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Minimum Order (₹)</Label>
                    <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Est. Delivery Time</Label>
                    <Input value={estTime} onChange={(e) => setEstTime(e.target.value)} placeholder="2-4 hours" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">Enable COD by default for all areas</p>
                  </div>
                  <Switch checked={codAvailable} onCheckedChange={setCodAvailable} />
                </div>
              </CardContent>
            </Card>

            {/* ── Delivery Areas / Pincodes ── */}
            <Card className="border-border/60 lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="size-4" /> Delivery Areas ({pincodes.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowPincodeDialog(true)}
                    className="gradient-primary text-white gap-1.5"
                  >
                    <Plus className="size-3.5" /> Add Pincode
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pincodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No delivery areas configured yet</p>
                    <p className="text-xs mt-1">Add pincodes to start accepting orders from those areas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pincodes.map((pin) => (
                      <div
                        key={pin.pincode}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          pin.isActive
                            ? "border-border/60 bg-card"
                            : "border-border/30 bg-muted/30 opacity-60"
                        }`}
                      >
                        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Pincode</p>
                            <p className="text-sm font-semibold font-mono">{pin.pincode}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Area</p>
                            <p className="text-sm font-medium truncate">{pin.area}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Fee</p>
                            <p className="text-sm">
                              {pin.deliveryFee != null
                                ? `₹${pin.deliveryFee}`
                                : `₹${defaultFee} (default)`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Options</p>
                            <div className="flex items-center gap-2">
                              {pin.codAvailable !== false ? (
                                <Badge className="text-[10px] bg-blue-100 text-blue-800">COD</Badge>
                              ) : (
                                <Badge className="text-[10px] bg-muted text-muted-foreground">No COD</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={pin.isActive}
                            onCheckedChange={() => handleTogglePincode(pin.pincode)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemovePincode(pin.pincode)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Add Pincode Dialog ── */}
      <Dialog open={showPincodeDialog} onOpenChange={setShowPincodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Delivery Pincode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pincode *</Label>
                <Input
                  maxLength={6}
                  placeholder="e.g. 421301"
                  value={newPincode}
                  onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Area Name *</Label>
                <Input
                  placeholder="e.g. Kalyan West"
                  value={newPinArea}
                  onChange={(e) => setNewPinArea(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Fee (₹)</Label>
                <Input
                  type="number"
                  placeholder={`Default: ${defaultFee}`}
                  value={newPinFee}
                  onChange={(e) => setNewPinFee(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min Order (₹)</Label>
                <Input
                  type="number"
                  placeholder={`Default: ${minOrder}`}
                  value={newPinMinOrder}
                  onChange={(e) => setNewPinMinOrder(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Est. Delivery Time</Label>
              <Input
                placeholder={`Default: ${estTime}`}
                value={newPinEstTime}
                onChange={(e) => setNewPinEstTime(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <Label className="text-sm">COD Available</Label>
              <Switch checked={newPinCod} onCheckedChange={setNewPinCod} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <Label className="text-sm">Active</Label>
              <Switch checked={newPinActive} onCheckedChange={setNewPinActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPincodeDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPincode} disabled={addingPin} className="gradient-primary text-white gap-1.5">
              {addingPin ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add Pincode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
