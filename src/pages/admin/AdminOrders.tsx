import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminOrders() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage customer orders.
          </p>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardList className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Order Management
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Full order management will be available in Phase 2. This will
              include order tracking, status updates, delivery management, and
              order history.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
