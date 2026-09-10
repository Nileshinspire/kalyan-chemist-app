import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Megaphone,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Upload,
  Image,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface CampaignForm {
  title: string;
  subtitle: string;
  bannerImage: string;
  desktopBannerImage: string;
  mobileBannerImage: string;
  imageSource: "upload" | "url" | "generated" | "none";
  publicUrl: string;
  ctaText: string;
  ctaDestination: string;
  targetType: "category" | "product" | "page" | "external" | "none";
  targetId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  priority: number;
}

const EMPTY_FORM: CampaignForm = {
  title: "",
  subtitle: "",
  bannerImage: "",
  desktopBannerImage: "",
  mobileBannerImage: "",
  imageSource: "url",
  publicUrl: "",
  ctaText: "Shop Now",
  ctaDestination: "",
  targetType: "none",
  targetId: "",
  startDate: new Date().toISOString().slice(0, 16),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  isActive: true,
  priority: 1,
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCampaigns() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "url" | "generated">("url");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const campaigns = useQuery(api.campaigns.list);
  const upsertCampaign = useMutation(api.campaigns.upsert);
  const deleteCampaign = useMutation(api.campaigns.remove);
  const uploadBanner = useMutation(api.campaigns.uploadBanner);
  const validateImageUrl = useMutation(api.campaigns.validateImageUrl);
  const generateCampaignImage = useMutation(api.campaigns.generateCampaignImage);

  const filteredCampaigns = campaigns?.filter((c: any) => {
    if (!search) return true;
    return c.title.toLowerCase().includes(search.toLowerCase());
  });

  // We don't support AI image generation yet unless an existing image-generation service is
  // wired up and configured. Until then, this path is intentionally disabled and kept as a
  // placeholder for when that capability is added.
  const ALLOWED_BANNER_MIME = ["image/jpeg", "image/png", "image/webp"];
  const isAiGenerationAvailable = false;
  const isUrlValid = useRef<boolean | null>(null);
  const validateUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      isUrlValid.current = false;
      return;
    }
    try {
      await validateImageUrl({ url: url.trim() });
      isUrlValid.current = true;
    } catch (err: any) {
      isUrlValid.current = false;
      toast.error(err.message || "Image URL is not valid");
    }
  }, [validateImageUrl]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (campaign: any) => {
    setEditingId(campaign._id);
    setForm({
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      bannerImage: campaign.bannerImage || "",
      desktopBannerImage: campaign.desktopBannerImage || "",
      mobileBannerImage: campaign.mobileBannerImage || "",
      imageSource: (campaign.imageSource as CampaignForm["imageSource"]) || "url",
      publicUrl: campaign.publicUrl || "",
      ctaText: campaign.ctaText || "Shop Now",
      ctaDestination: campaign.ctaDestination || "",
      targetType: campaign.targetType || "none",
      targetId: campaign.targetId || "",
      startDate: new Date(campaign.startDate).toISOString().slice(0, 16),
      endDate: new Date(campaign.endDate).toISOString().slice(0, 16),
      isActive: campaign.isActive,
      priority: campaign.priority,
    });
    setPreviewUrl(campaign.publicUrl || campaign.bannerImage || "");
    setActiveTab(campaign.imageSource === "upload" ? "upload" : campaign.imageSource === "generated" ? "generated" : "url");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Campaign title is required");
      return;
    }

    const startMs = new Date(form.startDate).getTime();
    const endMs = new Date(form.endDate).getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      toast.error("Please enter valid start and end dates");
      return;
    }
    if (startMs >= endMs) {
      toast.error("End date must be after start date");
      return;
    }

    if (form.targetType !== "none" && !form.ctaDestination.trim()) {
      toast.error("CTA destination is required when a target type is selected");
      return;
    }

    if (!previewUrl && activeTab !== "generated") {
      toast.error("Please provide a banner image (upload, URL, or generated).");
      return;
    }

    const finalPublicUrl =
      activeTab === "upload"
        ? previewUrl
        : activeTab === "generated"
        ? generatedUrl ?? previewUrl
        : form.bannerImage.trim();

    if (!finalPublicUrl) {
      toast.error("Please provide a valid banner image source.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        bannerImage: form.bannerImage.trim() || undefined,
        desktopBannerImage: form.desktopBannerImage.trim() || undefined,
        mobileBannerImage: form.mobileBannerImage.trim() || undefined,
        imageSource:
          activeTab === "generated" ? "generated" : activeTab,
        publicUrl: finalPublicUrl,
        ctaText: form.ctaText.trim() || undefined,
        ctaDestination: form.ctaDestination.trim() || undefined,
        targetType: form.targetType,
        targetId: form.targetId.trim() || undefined,
        startDate: startMs,
        endDate: endMs,
        isActive: form.isActive,
        priority: form.priority,
      };
      if (editingId) payload.id = editingId;

      await upsertCampaign(payload);
      toast.success(editingId ? "Campaign updated" : "Campaign created");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteCampaign({ campaignId: deleteDialogId as any });
      toast.success("Campaign deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete campaign");
    }
    setDeleteDialogId(null);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("File read returned no data URL"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const handleBannerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_BANNER_MIME.includes(file.type)) {
      toast.error(
        `Unsupported file type "${file.type}". Supported types: ${ALLOWED_BANNER_MIME.join(", ")}`
      );
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      if (editingId) {
        const url = (await uploadBanner({ campaignId: editingId, file })) as string;
        setPreviewUrl(url);
        setForm((prev) => ({
          ...prev,
          bannerImage: url,
          publicUrl: url,
          imageSource: "upload",
        }));
      } else {
        // For a new campaign, we cannot upload until the record exists, so stage the
        // file locally as a preview, then upload it server-side on save.
        const staged = await readFileAsDataUrl(file);
        setPreviewUrl(staged);
        setForm((prev) => ({
          ...prev,
          bannerImage: staged,
          publicUrl: staged,
          imageSource: "upload",
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!form.title.trim()) {
      toast.error("Add a campaign title before generating an image.");
      return;
    }
    if (!isAiGenerationAvailable) {
      toast.error("AI image generation is not configured yet.");
      return;
    }
    setUploading(true);
    try {
      const url = (await generateCampaignImage({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
      })) as string | null;
      if (!url) {
        toast.error("Image generation did not return a valid image URL.");
        return;
      }
      setGeneratedUrl(url);
      setPreviewUrl(url);
      setForm((prev) => ({
        ...prev,
        publicUrl: url,
        imageSource: "generated",
      }));
    } catch (err: any) {
      toast.error(err.message || "Image generation failed");
    } finally {
      setUploading(false);
    }
  };

  const now = Date.now();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Promotional Campaigns</h1>
            <p className="text-sm text-muted-foreground">Create and manage homepage banner campaigns</p>
          </div>
          <Button onClick={openAdd} className="gradient-primary text-white gap-2">
            <Plus className="size-4" /> Add Campaign
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Campaign list */}
        {campaigns === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredCampaigns || filteredCampaigns.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Megaphone className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first promotional campaign</p>
              <Button onClick={openAdd} className="gradient-primary text-white gap-2">
                <Plus className="size-4" /> Add Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((campaign: any) => {
              const isExpired = now > campaign.endDate;
              const isScheduled = now < campaign.startDate;
              const isLive = campaign.isActive && !isExpired && !isScheduled;

              return (
                <Card key={campaign._id} className="border-border/60 hover:shadow-sm transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Banner preview */}
                      <div className="w-32 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                        {campaign.bannerImage ? (
                          <img
                            src={campaign.bannerImage}
                            alt={campaign.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <Megaphone className="size-6" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground truncate">{campaign.title}</h3>
                          {isLive && (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Live</Badge>
                          )}
                          {isScheduled && (
                            <Badge variant="secondary" className="text-[10px]">Scheduled</Badge>
                          )}
                          {isExpired && (
                            <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600">Expired</Badge>
                          )}
                          {!campaign.isActive && (
                            <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {campaign.subtitle || "No subtitle"} · Priority: {campaign.priority}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => openEdit(campaign)}>
                          <Pencil className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteDialogId(campaign._id)}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update the promotional campaign details." : "Set up a new homepage banner campaign."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Title */}
              <div className="space-y-1.5">
                <Label>Campaign Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Skincare Fest"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <Label>Subtitle / Description</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Glow Into the Season"
                />
              </div>

              {/* Campaign Creative */}
              <div className="space-y-3">
                <Label className="!mb-1">Campaign Creative</Label>

                {/* Source tabs */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("url");
                      setPreviewUrl(form.bannerImage || "");
                    }}
                    className={`flex-1 rounded-lg border p-2 text-sm font-medium transition-colors ${
                      activeTab === "url"
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted text-muted-foreground"
                    }`}
                  >
                    <Image className="size-4 mr-1.5" />
                    Use Image URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("upload");
                      if (!previewUrl) setPreviewUrl(null);
                    }}
                    className={`flex-1 rounded-lg border p-2 text-sm font-medium transition-colors ${
                      activeTab === "upload"
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted text-muted-foreground"
                    }`}
                  >
                    <Upload className="size-4 mr-1.5" />
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("generated");
                      if (!generatedUrl) setPreviewUrl(null);
                    }}
                    className={`flex-1 rounded-lg border p-2 text-sm font-medium transition-colors ${
                      activeTab === "generated"
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="size-4 mr-1.5" />
                    Generate with AI
                  </button>
                </div>

                {/* URL source */}
                {activeTab === "url" && (
                  <div className="space-y-1.5">
                    <Label>Image URL</Label>
                    <Input
                      value={form.bannerImage}
                      onChange={(e) => {
                        setForm({ ...form, bannerImage: e.target.value });
                        setPreviewUrl(e.target.value || null);
                      }}
                    placeholder="https://example.com/banner.jpg"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[11px] px-2.5 h-7"
                      disabled={!form.bannerImage.trim() || saving || uploading}
                      onClick={() => validateUrl(form.bannerImage.trim())}
                    >
                      Validate URL
                    </Button>
                    {isUrlValid.current !== null && (
                      <span className="text-[11px] text-muted-foreground self-center">
                        {isUrlValid.current ? "Looks valid" : "Invalid or unreachable"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Paste a publicly accessible image URL (JPG, PNG, WebP).
                  </p>
                  </div>
                )}

                {/* Upload source */}
                {activeTab === "upload" && (
                  <div className="space-y-1.5">
                    <Label>Upload Banner Image</Label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      id="campaign-banner-upload"
                      onChange={handleBannerFileChange}
                    />
                    <label
                      htmlFor="campaign-banner-upload"
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-sm transition-colors ${
                        previewUrl
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/40 bg-muted/50 text-muted-foreground"
                      } hover:bg-muted/80`}
                    >
                      {previewUrl ? (
                        <>
                          <Image className="size-4 text-primary" />
                          Image selected — choose a different file to replace
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          Select banner image
                        </>
                      )}
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Supports JPG, PNG, WebP. The file is stored and used directly on the homepage.
                    </p>
                  </div>
                )}

                {/* AI generation source — disabled unless an existing image-generation capability is configured */}
                {activeTab === "generated" && (
                  isAiGenerationAvailable && (
                  <div className="space-y-1.5">
                    <Label>Generate Banner with AI</Label>
                    {generatedUrl ? (
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <span className="text-sm text-muted-foreground">
                          AI banner is configured for this campaign.
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() => {
                            setGeneratedUrl(null);
                            setPreviewUrl(null);
                          }}
                        >
                          Remove generated banner
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/40 bg-muted/40 p-4 text-center">                            <Sparkles className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          AI image generation is not configured yet.
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Choose &ldquo;Upload Image&rdquo; or &ldquo;Use Image URL&rdquo; in the meantime.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {previewUrl && (
                  <div className="mt-2">
                    <Label className="!mb-1.5">Banner Preview</Label>
                    <div className="rounded-lg overflow-hidden border border-border/40 h-32 sm:h-40 bg-muted">
                      <img
                        src={previewUrl}
                        alt="Banner preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          toast.error("Preview could not be loaded. Check the image source.");
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Optional desktop / mobile overrides */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Desktop Banner (optional)</Label>
                  <Input
                    value={form.desktopBannerImage}
                    onChange={(e) => setForm({ ...form, desktopBannerImage: e.target.value })}
                    placeholder="Desktop image URL"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    If provided, this is used on desktop instead of the main banner.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile Banner (optional)</Label>
                  <Input
                    value={form.mobileBannerImage}
                    onChange={(e) => setForm({ ...form, mobileBannerImage: e.target.value })}
                    placeholder="Mobile image URL"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    If provided, this is used on mobile instead of the main banner.
                  </p>
                </div>
              </div>

              {/* AI banner generation (only if configured) */}
              {activeTab === "generated" && (
                isAiGenerationAvailable && (
                <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-4 text-primary" />
                    <Label className="!mb-0">Generate a Banner from the Campaign Details</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    If an image-generation service is available, it can create a desktop-appropriate promotional banner using the title and subtitle you provided.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={saving || uploading}
                      onClick={handleGenerateImage}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Generate Banner
                        </>
                      )}
                    </Button>
                    {generatedUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setGeneratedUrl(null);
                          setPreviewUrl(null);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>CTA Button Text</Label>
                  <Input
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    placeholder="Shop Now"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Type</Label>
                  <select
                    value={form.targetType}
                    onChange={(e) => setForm({ ...form, targetType: e.target.value as any })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    <option value="none">None</option>
                    <option value="category">Category</option>
                    <option value="product">Product</option>
                    <option value="page">Internal Page</option>
                    <option value="external">External Link</option>
                  </select>
                </div>
              </div>

              {form.targetType !== "none" && (
                <div className="space-y-1.5">
                  <Label>CTA Destination {form.targetType === "page" ? "(route path)" : form.targetType === "external" ? "(full URL)" : "(slug or ID)"}</Label>
                  <Input
                    value={form.ctaDestination}
                    onChange={(e) => setForm({ ...form, ctaDestination: e.target.value })}
                    placeholder={
                      form.targetType === "page"
                        ? "/products"
                        : form.targetType === "external"
                        ? "https://example.com"
                        : "skin-personal-care"
                    }
                  />
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date *</Label>
                  <Input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date *</Label>
                  <Input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Priority & Active */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority (lower = shown first)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`flex items-center gap-2 h-9 w-full rounded-md border px-3 text-sm transition-colors ${
                      form.isActive
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {form.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    {form.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingId ? "Update Campaign" : "Create Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Campaign?</DialogTitle>
              <DialogDescription>This action cannot be undone. The campaign will be permanently removed.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
