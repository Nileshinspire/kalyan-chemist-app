import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminReviews() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reviews
          </h1>
          <p className="text-sm text-muted-foreground">
            View and moderate customer reviews.
          </p>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Star className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Review Management
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Full review management will be available in Phase 2. This will
              include viewing, moderating, and responding to customer reviews.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
