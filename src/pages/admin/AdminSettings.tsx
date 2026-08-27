import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Settings, Save, Loader2, CheckCircle2, Store, Phone, Mail, MapPin, Clock, CreditCard, Truck } from "lucide-react";

export default function AdminSettings() {
  const settings = useQuery(api.adminSettings.getSettings);
  const updateSettings = useMutation(api.adminSettings.updateSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ _initialized: false });

  if (settings && !form._initialized) {
    setForm({
      storeName: settings.storeName ?? "Kalyan Chemist",
      storeEmail: settings.storeEmail ?? "hello@kalyanchemist.in",
      storePhone: settings.storePhone ?? "+91 98765 43210",
      storeAddress: settings.storeAddress ?? "123 Health Street, Mumbai, Maharashtra 400001",
      storeHours: settings.storeHours ?? "Mon – Sat, 8 AM – 10 PM",
      currency: settings.currency ?? "₹",
      taxRate: settings.taxRate ?? 0,
      minOrderAmount: settings.minOrderAmount ?? 0,
      deliveryFee: settings.deliveryFee ?? 0,
      freeDeliveryAbove: settings.freeDeliveryAbove ?? 0,
      whatsappNumber: settings.whatsappNumber ?? "+91 98765 43210",
      _initialized: true,
    });
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateSettings({
        storeName: form.storeName,
        storeEmail: form.storeEmail,
        storePhone: form.storePhone,
        storeAddress: form.storeAddress,
        storeHours: form.storeHours,
        currency: form.currency,
        taxRate: Number(form.taxRate),
        minOrderAmount: Number(form.minOrderAmount),
        deliveryFee: Number(form.deliveryFee),
        freeDeliveryAbove: Number(form.freeDeliveryAbove),
        whatsappNumber: form.whatsappNumber,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <Settings className="size-3" />
            Store Settings
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your store configuration and business details</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Store className="size-4 text-primary" /> Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Store Name</Label>
                  <Input value={form.storeName ?? ""} onChange={(e) => update("storeName", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><Mail className="size-3" /> Store Email</Label>
                  <Input type="email" value={form.storeEmail ?? ""} onChange={(e) => update("storeEmail", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><Phone className="size-3" /> Store Phone</Label>
                  <Input value={form.storePhone ?? ""} onChange={(e) => update("storePhone", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><Phone className="size-3" /> WhatsApp Number</Label>
                  <Input value={form.whatsappNumber ?? ""} onChange={(e) => update("whatsappNumber", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><MapPin className="size-3" /> Store Address</Label>
                  <Input value={form.storeAddress ?? ""} onChange={(e) => update("storeAddress", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><Clock className="size-3" /> Business Hours</Label>
                  <Input value={form.storeHours ?? ""} onChange={(e) => update("storeHours", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Input value={form.currency ?? "₹"} onChange={(e) => update("currency", e.target.value)} className="rounded-xl" maxLength={5} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="size-4 text-primary" /> Delivery & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tax Rate (%)</Label>
                  <Input type="number" value={form.taxRate ?? 0} onChange={(e) => update("taxRate", Number(e.target.value))} className="rounded-xl" min={0} max={100} step={0.5} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Minimum Order (₹)</Label>
                  <Input type="number" value={form.minOrderAmount ?? 0} onChange={(e) => update("minOrderAmount", Number(e.target.value))} className="rounded-xl" min={0} step={10} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1"><CreditCard className="size-3" /> Delivery Fee (₹)</Label>
                  <Input type="number" value={form.deliveryFee ?? 0} onChange={(e) => update("deliveryFee", Number(e.target.value))} className="rounded-xl" min={0} step={5} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Free Delivery Above (₹)</Label>
                  <Input type="number" value={form.freeDeliveryAbove ?? 0} onChange={(e) => update("freeDeliveryAbove", Number(e.target.value))} className="rounded-xl" min={0} step={50} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white rounded-xl gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Saving…" : "Save Settings"}
            </Button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="size-4" /> Settings saved
              </motion.span>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
