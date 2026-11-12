import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Loader2, Layers, PackagePlus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProductLike = {
  _id: Id<"products">;
  name: string;
  stockQuantity: number;
};

function toDateInputValue(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInput(value: string) {
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export default function ProductBatchesDialog({
  product,
  onOpenChange,
}: {
  product: ProductLike | null;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useQuery(
    api.batches.listForProduct,
    product ? { productId: product._id } : "skip",
  );
  const receiveBatch = useMutation(api.batches.receiveBatch);
  const adjustBatch = useMutation(api.batches.adjustBatch);

  const [saving, setSaving] = useState(false);

  const [batchNumber, setBatchNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [manufacturing, setManufacturing] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [receiveReason, setReceiveReason] = useState("");

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<
    "adjustment" | "damaged" | "expired"
  >("adjustment");

  function resetReceiveForm() {
    setBatchNumber("");
    setExpiry("");
    setManufacturing("");
    setQuantity("");
    setPurchasePrice("");
    setSupplier("");
    setReceiveReason("");
  }

  async function handleReceive() {
    if (!product) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Received quantity must be a whole number greater than 0");
      return;
    }
    if (!expiry) {
      toast.error("Expiry date is required for a batch");
      return;
    }
    const expiryMs = parseDateInput(expiry);
    if (!Number.isFinite(expiryMs)) {
      toast.error("Enter a valid expiry date");
      return;
    }
    let manufacturingMs: number | undefined;
    if (manufacturing) {
      manufacturingMs = parseDateInput(manufacturing);
      if (!Number.isFinite(manufacturingMs)) {
        toast.error("Enter a valid manufacturing date");
        return;
      }
      if (manufacturingMs > expiryMs) {
        toast.error("Manufacturing date cannot be after the expiry date");
        return;
      }
    }
    let price: number | undefined;
    if (purchasePrice.trim()) {
      price = Number(purchasePrice);
      if (!Number.isFinite(price) || price < 0) {
        toast.error("Enter a valid purchase price");
        return;
      }
    }

    setSaving(true);
    try {
      const result = await receiveBatch({
        productId: product._id,
        quantity: qty,
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: expiryMs,
        manufacturingDate: manufacturingMs,
        purchasePrice: price,
        supplier: supplier.trim() || undefined,
        reason: receiveReason.trim() || undefined,
      });
      toast.success(
        result.toppedUp
          ? `Added ${qty} units to batch ${result.batchNumber ?? ""}`.trim()
          : `Batch received — stock ${result.previousQuantity} → ${result.newQuantity}`,
      );
      resetReceiveForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to receive batch");
    } finally {
      setSaving(false);
    }
  }

  function startAdjust(id: string) {
    setAdjustingId(id);
    setAdjustQuantity(
      String(data?.batches.find((b) => b._id === id)?.availableQuantity ?? ""),
    );
    setAdjustReason("");
    setAdjustType("adjustment");
  }

  async function handleAdjustBatch() {
    if (!adjustingId) return;
    const next = Number(adjustQuantity);
    if (!Number.isInteger(next) || next < 0) {
      toast.error("Batch quantity must be a whole number of 0 or more");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }

    setSaving(true);
    try {
      const result = await adjustBatch({
        batchId: adjustingId as Id<"product_batches">,
        newQuantity: next,
        reason: adjustReason.trim(),
        movementType: adjustType,
      });
      toast.success(
        result.changed
          ? `Batch adjusted by ${result.adjustment > 0 ? "+" : ""}${result.adjustment} units`
          : "No change to this batch",
      );
      setAdjustingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to adjust batch");
    } finally {
      setSaving(false);
    }
  }

  const batches = data?.batches ?? [];
  const totalAvailable = data?.totalAvailable ?? 0;
  const expiredUnits = data?.expiredUnits ?? 0;
  const unbatched = Math.max(0, (product?.stockQuantity ?? 0) - totalAvailable);

  const statusBadgeClass = (batch: typeof batches[number]) =>
    `text-[10px] ${
      batch.expired
        ? "bg-red-100 text-red-700"
        : batch.needsVerification
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700"
    }`;

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-y-auto"
        style={{
          width: "100%",
          maxWidth: "min(900px, calc(100vw - 32px))",
          maxHeight: "calc(100dvh - 32px)",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Batches — {product?.name}
          </DialogTitle>
          <DialogDescription>
            Each batch keeps its own expiry and quantity. Customer orders are
            filled from the earliest-expiring batch first (FEFO); expired
            batches stay on record but are never sold.
          </DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Product stock</p>
                <p className="text-lg font-bold text-foreground">
                  {product?.stockQuantity ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">In batches</p>
                <p className="text-lg font-bold text-foreground">{totalAvailable}</p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  unbatched > 0
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-muted/40"
                }`}
              >
                <p className="text-[11px] text-muted-foreground">Unbatched</p>
                <p className="text-lg font-bold text-foreground">{unbatched}</p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  expiredUnits > 0
                    ? "bg-red-50 border border-red-200"
                    : "bg-muted/40"
                }`}
              >
                <p className="text-[11px] text-muted-foreground">Expired units</p>
                <p className="text-lg font-bold text-foreground">{expiredUnits}</p>
              </div>
            </div>

            {unbatched > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <TriangleAlert className="size-4 shrink-0 mt-0.5" />
                <p>
                  {unbatched} unit(s) of this product have no batch behind them.
                  They sell normally as un-batched stock until you record the
                  real batch details below — no batch number or expiry is
                  invented for them.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Batches</p>

              <div className="space-y-3">
                {batches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 break-words">
                    No batches recorded for this product yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="rounded-xl border border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch no.</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead className="text-center">Available</TableHead>
                            <TableHead className="text-center">Received</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((batch) => (
                            <TableRow key={batch._id}>
                              <TableCell className="font-mono text-xs">
                                {batch.batchNumber || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {batch.expiryDate
                                  ? new Date(batch.expiryDate).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )
                                  : "—"}
                                {typeof batch.daysUntilExpiry === "number" &&
                                  batch.daysUntilExpiry >= 0 && (
                                    <span className="block text-[10px] text-muted-foreground">
                                      {batch.daysUntilExpiry} days left
                                    </span>
                                  )}
                              </TableCell>
                              <TableCell className="text-center text-sm font-semibold">
                                {batch.availableQuantity}
                              </TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {batch.receivedQuantity}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                {batch.supplier || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={statusBadgeClass(batch)}>
                                  {batch.expired
                                    ? "Expired"
                                    : batch.needsVerification
                                    ? "Verify"
                                    : "Sellable"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => startAdjust(batch._id)}
                                >
                                  Adjust
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {adjustingId && (
              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground flex items-start gap-1.5">
                  <Layers className="size-3.5 text-primary shrink-0 mt-0.5" />
                  Adjust batch{" "}
                  {batches.find((b) => b._id === adjustingId)?.batchNumber ??
                    "(select row above)"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">New available quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Adjustment type</Label>
                    <Select
                      value={adjustType}
                      onValueChange={(v) => setAdjustType(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adjustment">Manual adjustment</SelectItem>
                        <SelectItem value="damaged">Damaged stock</SelectItem>
                        <SelectItem value="expired">Expired stock removal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reason *</Label>
                    <Input
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Damaged in transit"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdjustingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={handleAdjustBatch}
                  >
                    {saving && (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    )}
                    Save batch adjustment
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/60 p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <PackagePlus className="size-3.5 text-primary" />
                Receive a batch
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Batch number (optional)</Label>
                  <Input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g. D650-A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expiry date *</Label>
                  <Input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Manufacturing date</Label>
                  <Input
                    type="date"
                    value={manufacturing}
                    onChange={(e) => setManufacturing(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Received quantity *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier</Label>
                  <Input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note / reason</Label>
                <Input
                  value={receiveReason}
                  onChange={(e) => setReceiveReason(e.target.value)}
                  placeholder="e.g. GRN 1234 from distributor"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Receiving adds the quantity to this product&apos;s stock and records
                it against the new batch. A repeated batch number with the same
                expiry tops up that batch; a different expiry is refused.
              </p>
              <div className="flex justify-end">
                <Button disabled={saving} onClick={handleReceive}>
                  {saving && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  Receive batch
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
