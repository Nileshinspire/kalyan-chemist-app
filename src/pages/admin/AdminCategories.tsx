import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCategories() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize your product categories.
          </p>
        </motion.div>

        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Tag className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Category Management
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Full category management will be available in Phase 2. This will
              include creating, editing, and organizing medicine categories.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
