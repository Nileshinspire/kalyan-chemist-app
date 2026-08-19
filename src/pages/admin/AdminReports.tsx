import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminReports() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Analytics and business intelligence.
          </p>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <BarChart3 className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Reports & Analytics
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Full reporting will be available in Phase 2. This will include
              sales analytics, inventory reports, customer insights, and
              revenue tracking.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
