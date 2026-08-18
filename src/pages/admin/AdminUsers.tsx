import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShieldCheck, User } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function AdminUsers() {
  const users = useQuery(api.admin.listUsers);
  const toggleRole = useMutation(api.admin.toggleUserRole);

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "customer" : "admin";
    if (!confirm(`Change role to "${newRole}"?`)) return;
    try {
      await toggleRole({ userId: userId as any, role: newRole as any });
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">{users?.length ?? 0} users</p>
        </div>

        {users === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <Card key={u._id} className="border-border/60">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {u.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {u.name || "Unnamed"}
                        </span>
                        {u.role === "admin" ? (
                          <Badge className="text-[10px] bg-primary/10 text-primary">
                            <ShieldCheck className="size-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <User className="size-2.5 mr-0.5" />
                            Customer
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email || "No email"} · {u.orderCount} order{u.orderCount !== 1 ? "s" : ""} · {formatCurrency(u.totalSpent)} spent
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => handleToggleRole(u._id, u.role || "customer")}
                  >
                    {u.role === "admin" ? "Demote" : "Make Admin"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
