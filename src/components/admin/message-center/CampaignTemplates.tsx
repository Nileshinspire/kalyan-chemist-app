import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  BODY_MAX,
  MESSAGE_CATEGORIES,
  TITLE_MAX,
  categoryEmoji,
  categoryLabel,
  type MessageCategory,
} from "@/convex/messageCenterCore";

interface TemplateDraft {
  _id?: any;
  name: string;
  category: MessageCategory;
  title: string;
  body: string;
  imageUrl?: string;
}

const EMPTY_DRAFT: TemplateDraft = {
  name: "",
  category: "announcement",
  title: "",
  body: "",
};

/** Template library: create, edit, reuse, duplicate and delete saved messages. */
export default function CampaignTemplates({
  onUse,
}: {
  onUse: (template: any) => void;
}) {
  const templates = useQuery(api.messageCampaigns.listTemplates, {});
  const saveTemplate = useMutation(api.messageCampaigns.saveTemplate);
  const deleteTemplate = useMutation(api.messageCampaigns.deleteTemplate);
  const duplicateTemplate = useMutation(api.messageCampaigns.duplicateTemplate);

  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await saveTemplate({
        templateId: draft._id,
        name: draft.name,
        category: draft.category,
        title: draft.title,
        body: draft.body,
        imageUrl: draft.imageUrl?.trim() || undefined,
      });
      toast.success(draft._id ? "Template updated" : "Template saved");
      setDraft(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(template: any) {
    setBusyId(String(template._id));
    try {
      await duplicateTemplate({ templateId: template._id });
      toast.success("Template duplicated");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not duplicate template");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(template: any) {
    setBusyId(String(template._id));
    try {
      await deleteTemplate({ templateId: template._id });
      toast.success("Template deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not delete template");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-primary" />
            Template library
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Save frequently used messages, then reuse or duplicate them without
            retyping. Templates never send anything on their own.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus className="size-3.5" />
          New template
        </Button>
      </div>

      {templates === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-16 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No templates yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create one here, or save a message as a template while composing.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template: any) => (
            <Card key={template._id} className="border-border/60">
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{template.name}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {categoryEmoji(template.category)}{" "}
                      {categoryLabel(template.category)}
                    </Badge>
                  </div>
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-muted/40 p-2.5">
                  <p className="truncate text-xs font-medium">{template.title}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                    {template.body}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => onUse(template)}
                  >
                    <Send className="size-3" />
                    Use in campaign
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => setDraft({ ...template })}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Duplicate ${template.name}`}
                    disabled={busyId === String(template._id)}
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    aria-label={`Delete ${template.name}`}
                    disabled={busyId === String(template._id)}
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?._id ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Templates store copy only. Sending still requires choosing an audience
              and confirming the campaign.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  maxLength={80}
                  placeholder="e.g. Diwali greetings"
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-category">Category</Label>
                <select
                  id="tpl-category"
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      category: event.target.value as MessageCategory,
                    })
                  }
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                >
                  {MESSAGE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-title">Message title</Label>
                <Input
                  id="tpl-title"
                  value={draft.title}
                  maxLength={TITLE_MAX}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-body">Message body</Label>
                <Textarea
                  id="tpl-body"
                  value={draft.body}
                  rows={6}
                  maxLength={BODY_MAX}
                  onChange={(event) =>
                    setDraft({ ...draft, body: event.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
