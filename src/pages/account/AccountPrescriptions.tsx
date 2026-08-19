import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { Pill, Upload, FileText } from "lucide-react";

export default function AccountPrescriptions() {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Prescriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload and manage your prescriptions for Rx medicines
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="py-16 text-center">
          <Pill className="size-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Prescription Management
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Upload your prescription and our pharmacist will verify it. This feature will be available soon.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/products")}>
              <FileText className="size-4" />
              Browse Medicines
            </Button>
            <Button className="gradient-primary text-white gap-2" disabled>
              <Upload className="size-4" />
              Upload Prescription
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
