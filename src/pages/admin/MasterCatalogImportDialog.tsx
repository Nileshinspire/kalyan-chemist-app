/**
 * Master catalog import dialog — the Admin's one-time (and update) path for a
 * licensed dataset.
 *
 * The admin picks the dataset file (CSV or XLSX) and, optionally, the image
 * ZIP that ships with it. Column names are recognised automatically; images
 * are matched to their exact record by source Product ID → SKU/GTIN →
 * declared filename → exact normalized name, and stored inside Convex storage
 * with provenance. The admin never maps fields or creates products by hand.
 */
import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CATALOG_FIELDS,
  mapColumns,
  planZipImages,
  rowToRecord,
  type ParsedRow,
} from "@/convex/masterCatalogCore";
import {
  chunkArray,
  readImageZipFile,
  readTableFile,
  toBase64,
  type TableData,
  type ZipEntry,
} from "@/lib/catalogFiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Database, FileSpreadsheet, Loader2, PackageCheck, Upload } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Preview = {
  fileName: string;
  imageFileName: string | null;
  records: ParsedRow[];
  /** catalogProductId → image filenames found in the ZIP for that record. */
  zipMatches: Array<{ catalogProductId: string; sourceProductId?: string; filenames: string[] }>;
  unmatchedImages: string[];
  urlImageCount: number;
  mappedFieldLabels: string[];
  imageUrlColumns: number;
};

type ImportResult = {
  created: number;
  updated: number;
  imagesStored: number;
  imagesUnmatched: number;
};

const RECORDS_PER_CHUNK = 100;
const IMAGES_PER_CHUNK = 4;
const CHUNK_BYTES_BUDGET = 2_500_000;

export default function MasterCatalogImportDialog({ open, onOpenChange }: Props) {
  const stats = useQuery(api.masterCatalog.stats);
  const importRecords = useMutation(api.masterCatalog.importRecords);
  const recordImportBatch = useMutation(api.masterCatalog.recordImportBatch);
  const storeImportedImages = useAction(api.masterCatalog.storeImportedImages);

  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const zipEntries = useRef<Map<string, Uint8Array>>(new Map());

  const reset = () => {
    setDatasetFile(null);
    setZipFile(null);
    setPreview(null);
    setError(null);
    setResult(null);
    setProgress(null);
    zipEntries.current = new Map();
  };

  const handleParse = async () => {
    if (!datasetFile) {
      setError("Choose the licensed dataset file first (.csv or .xlsx).");
      return;
    }
    setParsing(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const table: TableData = await readTableFile(datasetFile);
      if (table.headers.length === 0) {
        throw new Error("The dataset has no readable header row.");
      }
      const mapping = mapColumns(table.headers);
      if (mapping.columns.productName === null) {
        throw new Error(
          "No product-name column found. Add a column such as “Product Name”, or rename the closest column and re-import.",
        );
      }

      // One record per row; duplicate identities collapse so a chunk can
      // never insert the same product twice.
      const byId = new Map<string, ParsedRow>();
      for (const row of table.rows) {
        const parsed = rowToRecord(row, mapping);
        if (parsed) byId.set(parsed.record.catalogProductId, parsed);
      }
      const records = [...byId.values()];
      if (records.length === 0) {
        throw new Error("No product rows were found under the mapped columns.");
      }

      let zipMatches: Preview["zipMatches"] = [];
      let unmatchedImages: string[] = [];
      zipEntries.current = new Map();
      if (zipFile) {
        const entries: ZipEntry[] = await readImageZipFile(zipFile);
        if (entries.length === 0) {
          throw new Error("The image ZIP contains no image files (.jpg/.png/.webp).");
        }
        for (const entry of entries) {
          zipEntries.current.set(entry.filename, entry.bytes);
        }
        const plan = planZipImages(
          records.map(({ record, imageFilename }) => ({
            catalogProductId: record.catalogProductId,
            normalizedName: record.normalizedName,
            canonicalProductName: record.canonicalProductName,
            dosageForm: record.dosageForm,
            sourceProductId: record.sourceProductId,
            sku: record.sku,
            gtin: record.gtin,
            declaredFilename: imageFilename,
          })),
          entries.map((entry) => ({ filename: entry.filename })),
        );
        zipMatches = plan.attachments.map((attachment) => ({
          catalogProductId: attachment.catalogProductId,
          sourceProductId: attachment.sourceProductId,
          filenames: attachment.filenames,
        }));
        unmatchedImages = plan.unmatched;
      }

      const mappedFieldLabels: string[] = [];
      for (const field of CATALOG_FIELDS) {
        if (mapping.columns[field] !== null) mappedFieldLabels.push(field);
      }
      if (mapping.imageUrlColumns.length > 0) mappedFieldLabels.push("imageUrl");

      setPreview({
        fileName: datasetFile.name,
        imageFileName: zipFile?.name ?? null,
        records,
        zipMatches,
        unmatchedImages,
        urlImageCount: records.reduce((sum, r) => sum + r.imageUrls.length, 0),
        mappedFieldLabels,
        imageUrlColumns: mapping.imageUrlColumns.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the dataset.");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const batchId = `import-${Date.now()}`;
    let created = 0;
    let updated = 0;
    let imagesStored = 0;
    try {
      // 1. Records, chunked so a large dataset never becomes one huge request.
      const chunks = chunkArray(preview.records, RECORDS_PER_CHUNK);
      for (let i = 0; i < chunks.length; i += 1) {
        setProgress(
          `Importing product records… ${i * RECORDS_PER_CHUNK + Math.min(RECORDS_PER_CHUNK, chunks[i].length)}/${preview.records.length}`,
        );
        const response = await importRecords({
          batchId,
          fileName: preview.fileName,
          records: chunks[i].map((row) => row.record),
        });
        created += response.created;
        updated += response.updated;
      }

      // 2. Image URLs that the dataset declared on its rows.
      const urlItems = preview.records
        .filter((row) => row.imageUrls.length > 0)
        .map((row) => ({
          catalogProductId: row.record.catalogProductId,
          sourceProductId: row.record.sourceProductId,
          urls: row.imageUrls,
        }));
      for (const chunk of chunkArray(urlItems, 6)) {
        setProgress(`Storing ${chunk.reduce((n, item) => n + item.urls.length, 0)} dataset image URLs…`);
        const response = await storeImportedImages({
          batchId,
          source: "licensed dataset",
          items: chunk,
        });
        imagesStored += response.stored;
      }

      // 3. Images from the licensed ZIP, uploaded against their matched record.
      const zipItems: Array<{
        catalogProductId: string;
        sourceProductId?: string;
        files: Array<{ filename: string; base64: string }>;
      }> = [];
      for (const match of preview.zipMatches) {
        const files: Array<{ filename: string; base64: string }> = [];
        for (const filename of match.filenames) {
          const bytes = zipEntries.current.get(filename);
          if (!bytes) continue;
          files.push({ filename, base64: toBase64(bytes) });
        }
        if (files.length > 0) {
          zipItems.push({
            catalogProductId: match.catalogProductId,
            sourceProductId: match.sourceProductId,
            files,
          });
        }
      }
      let batch: typeof zipItems = [];
      let batchBytes = 0;
      const flushZipBatch = async () => {
        if (batch.length === 0) return;
        const response = await storeImportedImages({
          batchId,
          source: "image zip",
          items: batch,
        });
        imagesStored += response.stored;
        batch = [];
        batchBytes = 0;
      };
      for (const item of zipItems) {
        const size = item.files.reduce((n, file) => n + file.base64.length, 0);
        if (
          batch.length >= IMAGES_PER_CHUNK ||
          (batch.length > 0 && batchBytes + size > CHUNK_BYTES_BUDGET)
        ) {
          await flushZipBatch();
        }
        batch.push(item);
        batchBytes += size;
      }
      await flushZipBatch();

      // 4. Audit row for this run.
      await recordImportBatch({
        batchId,
        fileName: preview.fileName,
        imageFileName: preview.imageFileName ?? undefined,
        recordsCreated: created,
        recordsUpdated: updated,
        imagesStored,
        imagesUnmatched: preview.unmatchedImages.length,
      });

      setResult({
        created,
        updated,
        imagesStored,
        imagesUnmatched: preview.unmatchedImages.length,
      });
      toast.success(
        `Catalog import finished: ${created} new, ${updated} updated, ${imagesStored} images stored.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The import failed. Nothing already imported is lost — re-run it.",
      );
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!running) {
          if (!next) reset();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Import licensed product catalog
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Import the licensed Indian pharmaceutical dataset (CSV or XLSX) and,
            if it ships one, the image ZIP. Columns are mapped automatically
            (Product Name, Brand, Manufacturer, Composition, Strength, Form,
            Packaging/Quantity, MRP, Product ID, Image URL/filename, SKU/GTIN),
            images are matched to their exact record only, and nothing is
            published from here — Auto Fill still fills the form, and the
            admin still reviews and saves.
          </p>

          {stats && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
              <p className="font-medium text-foreground">
                Catalog: {stats.total} records — {stats.byStatus.VERIFIED} verified ·{" "}
                {stats.byStatus.NEEDS_IMAGE} needing an image ·{" "}
                {stats.byStatus.NEEDS_REVIEW} needing review
              </p>
              {stats.lastImport && (
                <p className="text-muted-foreground">
                  Last import: {stats.lastImport.recordsCreated} new ·{" "}
                  {stats.lastImport.recordsUpdated} updated ·{" "}
                  {stats.lastImport.imagesStored} images
                  {stats.lastImport.fileName ? ` (${stats.lastImport.fileName})` : ""}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileSpreadsheet className="size-3.5" /> Dataset file (.csv / .xlsx) *
              </Label>
              <Input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx"
                disabled={running}
                onChange={(event) => {
                  setDatasetFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Upload className="size-3.5" /> Image ZIP (optional)
              </Label>
              <Input
                type="file"
                accept=".zip"
                disabled={running}
                onChange={(event) => {
                  setZipFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {preview && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3 text-xs">
              <p className="font-semibold text-foreground">
                Ready to import: {preview.records.length} product records
              </p>
              <p className="text-muted-foreground">
                Columns recognised: {preview.mappedFieldLabels.join(", ")}
                {preview.imageUrlColumns > 0
                  ? ` (including ${preview.imageUrlColumns} image URL column${preview.imageUrlColumns === 1 ? "" : "s"})`
                  : ""}
              </p>
              {preview.imageFileName && (
                <p className="text-muted-foreground">
                  Images: {preview.zipMatches.reduce((n, m) => n + m.filenames.length, 0)}{" "}
                  matched to their exact record · {preview.unmatchedImages.length} not
                  matchable (they will stay unassigned rather than risk a wrong image)
                </p>
              )}
              {preview.urlImageCount > 0 && (
                <p className="text-muted-foreground">
                  {preview.urlImageCount} image URL{preview.urlImageCount === 1 ? "" : "s"} on
                  dataset rows will be downloaded into Kalyan Chemist storage.
                </p>
              )}
            </div>
          )}

          {progress && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {progress}
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <PackageCheck className="size-4 text-emerald-600" /> Import complete
              </p>
              <p className="text-muted-foreground">
                {result.created} new · {result.updated} updated ·{" "}
                {result.imagesStored} images stored
                {result.imagesUnmatched > 0
                  ? ` · ${result.imagesUnmatched} images left unassigned`
                  : ""}.
                Re-importing an updated dataset updates the same records — it never
                creates duplicates.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleParse}
            disabled={parsing || running || !datasetFile}
          >
            {parsing ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Read files
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview || running}
            className="gradient-primary text-white"
          >
            {running ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Import {preview ? preview.records.length : ""} products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
