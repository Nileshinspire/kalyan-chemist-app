import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { Save, Loader2, User, Mail, Phone, CheckCircle2, MessageCircle, Bell } from "lucide-react";
import { toast } from "sonner";

export default function AccountProfile() {
  const profile = useQuery(api.account.getProfile);
  const updateProfile = useMutation(api.account.updateProfile);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize form from profile data
  if (profile && !initialized) {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
    setInitialized(true);
  }

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Phone must be 10 digits starting with 6-9");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your personal information
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            Your account details are used for order processing and delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="max-w-md"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="size-3.5 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="max-w-md"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="size-3.5 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              className="max-w-md"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Indian mobile number starting with 6, 7, 8, or 9
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gradient-primary text-white gap-2"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferences />
    </motion.div>
  );
}

function NotificationPreferences() {
  const notifPrefs = useQuery(api.orderNotifications.getNotificationPreferences);
  const updateWhatsAppOptIn = useMutation(api.orderNotifications.updateWhatsAppOptIn);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const handleWhatsAppToggle = async (checked: boolean) => {
    setWhatsappLoading(true);
    try {
      await updateWhatsAppOptIn({ optIn: checked });
      toast.success(
        checked
          ? "WhatsApp notifications enabled"
          : "WhatsApp notifications disabled"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to update preference");
    } finally {
      setWhatsappLoading(false);
    }
  };

  if (notifPrefs === undefined) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to receive order status updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email Notifications */}
        <div className="flex items-center justify-between py-3 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email Notifications</span>
              {notifPrefs?.emailVerified && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="size-2.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {notifPrefs?.email
                ? `Order updates will be sent to ${notifPrefs.email}`
                : "Add a verified email to receive order updates"}
            </p>
          </div>
          <Switch
            checked={notifPrefs?.emailVerified ?? false}
            disabled={!notifPrefs?.emailVerified}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {/* SMS Notifications */}
        <div className="flex items-center justify-between py-3 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">SMS Notifications</span>
              {notifPrefs?.phoneVerified && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="size-2.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {notifPrefs?.phone
                ? `Order updates will be sent to +91 ${notifPrefs.phone}`
                : "Add a phone number to receive SMS updates"}
            </p>
          </div>
          <Switch
            checked={notifPrefs?.phoneVerified ?? false}
            disabled={!notifPrefs?.phoneVerified}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {/* WhatsApp Notifications */}
        <div className="flex items-center justify-between py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-green-600" />
              <span className="text-sm font-medium">WhatsApp Notifications</span>
              {notifPrefs?.whatsappOptIn && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="size-2.5" /> Enabled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Receive order status updates on WhatsApp
            </p>
          </div>
          {whatsappLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={notifPrefs?.whatsappOptIn ?? false}
              disabled={!notifPrefs?.phoneVerified}
              onCheckedChange={handleWhatsAppToggle}
              className="data-[state=checked]:bg-green-600"
            />
          )}
        </div>

        {!notifPrefs?.phoneVerified && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Add and verify a phone number to enable SMS and WhatsApp notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
