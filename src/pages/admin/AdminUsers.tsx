import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Users,
  Loader2,
  Search,
  ShieldCheck,
  Shield,
  Mail,
  Phone,
  ShoppingCart,
  IndianRupee,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [toggleDialog, setToggleDialog] = useState<{ userId: string; currentRole: string } | null>(null);

  const users = useQuery(api.admin.listUsers);
  const toggleRole = useMutation(api.admin.toggleUserRole);

  const filteredUsers = users?.filter((u: any) => {
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleToggleRole = async (userId: string, newRole: "admin" | "customer") => {
    try {
      await toggleRole({ userId: userId as any, role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setToggleDialog(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const stats = {
    total: users?.length || 0,
    admins: users?.filter((u: any) => u.role === "admin").length || 0,
    customers: users?.filter((u: any) => u.role === "customer" || !u.role).length || 0,
    totalRevenue: users?.reduce((s: number, u: any) => s + (u.totalSpent || 0), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">View and manage customer accounts</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: stats.total, color: "text-foreground" },
            { label: "Admins", value: stats.admins, color: "text-purple-600" },
            { label: "Customers", value: stats.customers, color: "text-blue-600" },
            { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-muted/30 border border-border/40">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {["all", "admin", "customer"].map((role) => (
              <Button
                key={role}
                variant={roleFilter === role ? "default" : "outline"}
                size="sm"
                className={`text-xs capitalize ${roleFilter === role ? "gradient-primary text-white" : ""}`}
                onClick={() => setRoleFilter(role)}
              >
                {role === "all" ? "All" : role}
              </Button>
            ))}
          </div>
        </div>

        {/* Users List */}
        {users === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredUsers || filteredUsers.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Users className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground">
                {search || roleFilter !== "all" ? "Try adjusting your filters" : "No customers have registered yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u: any) => (
              <Card key={u._id} className="border-border/60 hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(u.name || u.email || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-sm font-semibold truncate">{u.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="size-3" /> {u.email || "No email"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="size-3" /> {u.phone || "No phone"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Orders</p>
                        <p className="text-sm font-medium">{u.orderCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                        <p className="text-sm font-semibold">{formatCurrency(u.totalSpent || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        className={`text-[10px] capitalize ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {u.role === "admin" ? (
                          <ShieldCheck className="size-2.5 mr-1" />
                        ) : (
                          <Shield className="size-2.5 mr-1" />
                        )}
                        {u.role || "customer"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px]"
                        onClick={() => setToggleDialog({ userId: u._id, currentRole: u.role || "customer" })}
                      >
                        Change Role
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Toggle Role Dialog */}
      <Dialog open={!!toggleDialog} onOpenChange={() => setToggleDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select the new role for this user. This affects their access permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current role: <span className="font-semibold capitalize">{toggleDialog?.currentRole}</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant={toggleDialog?.currentRole === "customer" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => toggleDialog && handleToggleRole(toggleDialog.userId, "customer")}
                disabled={toggleDialog?.currentRole === "customer"}
              >
                <Shield className="size-4" /> Customer
              </Button>
              <Button
                variant={toggleDialog?.currentRole === "admin" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => toggleDialog && handleToggleRole(toggleDialog.userId, "admin")}
                disabled={toggleDialog?.currentRole === "admin"}
              >
                <ShieldCheck className="size-4" /> Admin
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleDialog(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
