import { Upload, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

export default function UploadPrescription() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24 text-center">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="size-10 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Upload Your Prescription
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Upload your prescription and we will process your order with the right medicines and dosage.
        </p>
        <div className="rounded-2xl border-2 border-dashed border-border p-12 mb-8">
          <Upload className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Drag & drop your prescription here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Supports JPG, PNG, PDF — Max 10MB
          </p>
          <Button className="mt-6" onClick={() => {/* will be wired later */}}>
            Choose File
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
