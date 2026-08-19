import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Warehouse,
  AlertTriangle,
  PackageX,
  PackageCheck,
  Loader2,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings,
} from "lucide-react";

export default function AdminInventory() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [threshold, setThreshold] = useState(10);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [newThreshold, setNewThreshold] = useState(10);

  const products = useQuery(api.adminInventory.list, {
    search: search || undefined,
    lowStockThreshold: threshold,
    filter: filter as any,
  });

  const summary = useQuery(api.adminInventory.getLowStockSummary, {
    threshold,
  });

  const logs = useQuery(
    api.adminInventory.getLogs,
    historyProduct ? { productId: historyProduct._id, limit: 20 } : "skip"
  );

  const adjustStock = useMutation(api.adminInventory.adjustStock);

  const openAdjust = (product: any) => {
    setAdjustProduct(product);
    setNewQuantity(product.stockQuantity);
    setReason("");
    setAdjustDialogOpen(true);
  };

  const openHistory = (product: any) => {
    setHistoryProduct(product);
    setHistoryDialogOpen(true);
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }
    if (newQuantity < 0) {
      toast.error("Stock quantity cannot be negative");
      return;
    }
    setSaving(true);
    try {
      const result = await adjustStock({
        productId: adjustProduct._id,
        newQuantity,
        reason: reason.trim(),
      });
      const action = result.adjustment > 0 ? "restocked" : result.adjustment < 0 ? "reduced" : "unchanged";
      toast.success(`Stock ${action}: ${result.previousQuantity} → ${result.newQuantity}`);
      setAdjustDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = products === undefined || summary === undefined;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground">Monitor stock levels and adjust inventory</p>
          </div>
          <Button variant="outline" onClick={() => { setNewThreshold(threshold); setThresholdDialogOpen(true); }} className="gap-2">
            <Settings className="size-4" /> Low Stock Threshold ({threshold})
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Warehouse className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total Products</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <PackageCheck className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.inStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">In Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.lowStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <PackageX className="size-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.outOfStockCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !products || products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Warehouse className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No products found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? "Try a different search term" : "Add products to manage inventory"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Current Stock</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {product.sku || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${
                            product.stockStatus === "out_of_stock"
                              ? "text-red-600"
                              : product.stockStatus === "low_stock"
                              ? "text-amber-600"
                              : "text-foreground"
                          }`}>
                            {product.stockQuantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              product.stockStatus === "out_of_stock"
                                ? "destructive"
                                : product.stockStatus === "low_stock"
                                ? "outline"
                                : "secondary"
                            }
                            className={`text-xs ${
                              product.stockStatus === "low_stock"
                                ? "border-amber-300 text-amber-700"
                                : product.stockStatus === "in_stock"
                                ? "bg-green-100 text-green-700"
                                : ""
                            }`}
                          >
                            {product.stockStatus === "out_of_stock"
                              ? "Out of Stock"
                              : product.stockStatus === "low_stock"
                              ? "Low Stock"
                              : "In Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openAdjust(product)}>
                              <ArrowUpCircle className="size-3.5" /> Adjust
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openHistory(product)}>
                              <History className="size-3.5" /> History
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

        <p className="text-xs text-muted-foreground">{products?.length ?? 0} product(s) shown</p>

        {/* Stock Adjustment Dialog */}
        <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
            </DialogHeader>
            {adjustProduct && (
              <div className="space-y-4 py-2">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="font-medium">{adjustProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current stock: <span className="font-semibold">{adjustProduct.stockQuantity}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>New Quantity</Label>
                  <Input
                    type="number"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Adjustment: {newQuantity - adjustProduct.stockQuantity >= 0 ? "+" : ""}
                    {newQuantity - adjustProduct.stockQuantity} units
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Restocked from supplier, Damaged units, etc."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjust} disabled={saving} className="gradient-primary text-white">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Update Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Stock History — {historyProduct?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              {!logs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No adjustments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Before</TableHead>
                      <TableHead className="text-center">After</TableHead>
                      <TableHead className="text-center">Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-center text-sm">{log.previousQuantity}</TableCell>
                        <TableCell className="text-center text-sm">{log.newQuantity}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${
                            log.adjustment > 0 ? "text-green-600" : log.adjustment < 0 ? "text-red-600" : "text-muted-foreground"
                          }`}>
                            {log.adjustment > 0 ? "+" : ""}{log.adjustment}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{log.reason}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.adminName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Threshold Dialog */}
        <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Low Stock Threshold</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Products with stock at or below this threshold will be flagged as "Low Stock".
              </p>
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setThresholdDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => { setThreshold(newThreshold); setThresholdDialogOpen(false); toast.success("Threshold updated"); }} className="gradient-primary text-white">
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
