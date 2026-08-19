import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCoupons() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Coupons
          </h1>
          <p className="text-sm text-muted-foreground">
            Create and manage discount coupons.
          </p>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Ticket className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Coupon Management
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Full coupon management will be available in Phase 2. This will
              include creating discount codes, setting usage limits, and
              tracking redemption.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
