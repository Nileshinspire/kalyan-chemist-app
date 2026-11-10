import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

export type PrescriptionUploadMeta = {
  patientName: string;
  doctorName?: string;
  prescriptionDate?: number;
  notes?: string;
};

/**
 * Shared prescription upload used by the homepage, checkout and My
 * Prescriptions. The file goes to Convex storage and one central
 * `prescriptions` record is created — every entry point uses the same record.
 */
export function usePrescriptionUpload() {
  const generateUploadUrl = useMutation(api.prescriptions.generateUploadUrl);
  const createPrescription = useMutation(api.prescriptions.upload);
  const [uploading, setUploading] = useState(false);

  const uploadPrescription = useCallback(
    async (
      file: File,
      meta: PrescriptionUploadMeta,
    ): Promise<Id<"prescriptions">> => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Please upload a JPG, PNG, or PDF file.");
      }
      if (file.size > MAX_SIZE) {
        throw new Error("File size must be 10 MB or less.");
      }

      setUploading(true);
      try {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error("File upload failed. Please try again.");
        }
        const { storageId } = await response.json();

        const result = await createPrescription({
          patientName: meta.patientName,
          doctorName: meta.doctorName,
          prescriptionDate: meta.prescriptionDate,
          notes: meta.notes,
          fileId: storageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        return result.prescriptionId;
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl, createPrescription],
  );

  return { uploading, uploadPrescription };
}
