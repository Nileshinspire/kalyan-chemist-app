/**
 * File parsing for the licensed catalog import — CSV, XLSX and image ZIPs.
 *
 * Written against the browser's own APIs (`DecompressionStream`, `DOMParser`,
 * `TextDecoder`) so no new dependency is added to the project. XLSX files are
 * ZIP containers, so the ZIP reader is shared between the spreadsheet path and
 * the image-package path.
 *
 * Nothing here decides product identity — this module only turns bytes into
 * header/row grids and image entries. Identity rules live in
 * `convex/masterCatalogCore.ts` and are applied by the caller.
 */

export type TableData = {
  headers: string[];
  rows: string[][];
};

export type ZipEntry = {
  /** The entry's path inside the archive, exactly as stored. */
  filename: string;
  bytes: Uint8Array;
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export function isImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Detect the delimiter from the header line: comma, semicolon or tab. */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC4180-style CSV parse: quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Drop rows that are entirely empty.
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // handled by the \n branch; a lone \r also ends the row
      if (text[i + 1] !== "\n") pushRow();
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Strip a leading BOM from the first header cell.
  if (rows.length > 0 && rows[0].length > 0) {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  }
  return rows;
}

/** First row becomes the header; every later row is trimmed to its width. */
export function tableFromCells(cells: string[][]): TableData {
  if (cells.length === 0) return { headers: [], rows: [] };
  const headers = cells[0].map((cell) => cell.replace(/^\uFEFF/, "").trim());
  const rows = cells
    .slice(1)
    .filter((row) => row.some((cell) => (cell ?? "").trim().length > 0))
    .map((row) => headers.map((_, index) => (row[index] ?? "").trim()));
  return { headers, rows };
}

// ── ZIP ──────────────────────────────────────────────────────────────────────

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DecompressionStreamCtor = (
    globalThis as unknown as { DecompressionStream?: typeof DecompressionStream }
  ).DecompressionStream;
  if (!DecompressionStreamCtor) {
    throw new Error(
      "This browser cannot decompress ZIP files. Please re-export the dataset as CSV.",
    );
  }
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStreamCtor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type CentralEntry = {
  filename: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

/** Read the central directory of a ZIP archive (ZIP64 is reported clearly). */
function readCentralDirectory(bytes: Uint8Array): CentralEntry[] {
  // End of central directory: find its signature in the last 64 KiB.
  const minOffset = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That file is not a ZIP archive.");
  const entryCount = u16(bytes, eocd + 10);
  const firstOffset = u32(bytes, eocd + 16);
  if (entryCount === 0xffff || firstOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported. Please re-export the file.");
  }

  const entries: CentralEntry[] = [];
  let cursor = firstOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (u32(bytes, cursor) !== 0x02014b50) break;
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const filename = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    entries.push({ filename, method, compressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Read every file in a ZIP archive, inflating deflated entries. */
export async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const entry of readCentralDirectory(bytes)) {
    if (entry.filename.endsWith("/")) continue;
    if (entry.filename.startsWith("__MACOSX/")) continue;
    const local = entry.localOffset;
    if (u32(bytes, local) !== 0x04034b50) continue;
    const nameLength = u16(bytes, local + 26);
    const extraLength = u16(bytes, local + 28);
    const dataStart = local + 30 + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + entry.compressedSize);
    let content: Uint8Array;
    if (entry.method === 0) {
      content = data;
    } else if (entry.method === 8) {
      content = await inflateRaw(data);
    } else {
      continue; // unsupported compression method: skip the entry
    }
    entries.push({ filename: entry.filename, bytes: content });
  }
  return entries;
}

/** Only the image files of an image-ZIP, ready for matching to records. */
export async function readImageZipEntries(
  bytes: Uint8Array,
): Promise<ZipEntry[]> {
  const entries = await readZipEntries(bytes);
  return entries.filter((entry) => isImageFilename(entry.filename));
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

function xml(entry: ZipEntry | undefined): Document | null {
  if (!entry) return null;
  const text = new TextDecoder().decode(entry.bytes);
  try {
    return new DOMParser().parseFromString(text, "application/xml");
  } catch {
    return null;
  }
}

function findEntry(entries: ZipEntry[], name: string): ZipEntry | undefined {
  const lower = name.toLowerCase();
  return entries.find((entry) => entry.filename.toLowerCase() === lower);
}

/** "BC12" → 0-based column index 54. */
function columnIndexForRef(ref: string): number {
  const letters = (ref.match(/^[A-Za-z]+/) ?? [""])[0].toUpperCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function cellText(cell: Element, shared: string[]): string {
  const type = cell.getAttribute("t");
  if (type === "s") {
    const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
    const index = Number(value);
    return Number.isInteger(index) ? shared[index] ?? "" : "";
  }
  if (type === "inlineStr") {
    const texts = cell.getElementsByTagName("t");
    let text = "";
    for (const node of Array.from(texts)) text += node.textContent ?? "";
    return text;
  }
  return cell.getElementsByTagName("v")[0]?.textContent ?? "";
}

/** Parse the first worksheet of an XLSX workbook into a header/row grid. */
export async function readXlsx(bytes: Uint8Array): Promise<TableData> {
  const entries = await readZipEntries(bytes);

  // Shared strings (text cells point into this table).
  const shared: string[] = [];
  const sharedDoc = xml(findEntry(entries, "xl/sharedStrings.xml"));
  if (sharedDoc) {
    for (const si of Array.from(sharedDoc.getElementsByTagName("si"))) {
      let text = "";
      for (const t of Array.from(si.getElementsByTagName("t"))) {
        text += t.textContent ?? "";
      }
      shared.push(text);
    }
  }

  // Locate the first sheet through the workbook relationships, falling back
  // to the conventional sheet1 path for files that omit them.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = xml(findEntry(entries, "xl/workbook.xml"));
  const rels = xml(findEntry(entries, "xl/_rels/workbook.xml.rels"));
  if (workbook && rels) {
    const sheet = workbook.getElementsByTagName("sheet")[0];
    const relId =
      sheet?.getAttribute("r:id") ??
      sheet?.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      );
    if (relId) {
      const relationship = Array.from(rels.getElementsByTagName("Relationship")).find(
        (rel) => rel.getAttribute("Id") === relId,
      );
      const target = relationship?.getAttribute("Target");
      if (target) {
        sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        if (sheetPath.includes("/./")) sheetPath = sheetPath.replace("/./", "/");
      }
    }
  }
  const sheetDoc = xml(
    findEntry(entries, sheetPath) ?? findEntry(entries, "xl/worksheets/sheet1.xml"),
  );
  if (!sheetDoc) {
    throw new Error(
      "No worksheet found in this XLSX file. Re-save it from Excel, or export CSV.",
    );
  }

  const cells: string[][] = [];
  for (const rowElement of Array.from(sheetDoc.getElementsByTagName("row"))) {
    const row: string[] = [];
    let runningIndex = 0;
    for (const cell of Array.from(rowElement.getElementsByTagName("c"))) {
      const ref = cell.getAttribute("r");
      const index = ref ? columnIndexForRef(ref) : runningIndex;
      runningIndex = index + 1;
      const text = cellText(cell, shared).trim();
      while (row.length < index) row.push("");
      row[index] = text;
    }
    if (row.some((value) => value.length > 0)) cells.push(row);
  }
  if (cells.length === 0) return { headers: [], rows: [] };
  // A header row must be the first non-empty row; numbers-only titles are fine.
  return tableFromCells(cells);
}

// ── Browser entry points ─────────────────────────────────────────────────────

function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

/** Read a dataset file (.csv, .tsv, .txt, .xlsx) into a header/row grid. */
export async function readTableFile(file: File): Promise<TableData> {
  const extension = extensionOf(file.name);
  if (extension === ".xlsx") {
    return await readXlsx(new Uint8Array(await file.arrayBuffer()));
  }
  if (extension === ".xls") {
    throw new Error(
      "Legacy .xls files are not supported. Save the sheet as .xlsx or CSV.",
    );
  }
  if (extension === ".csv" || extension === ".tsv" || extension === ".txt") {
    return tableFromCells(parseCsv(await file.text()));
  }
  // Unknown extension: try CSV text as the safe interpretation.
  try {
    return tableFromCells(parseCsv(await file.text()));
  } catch {
    throw new Error("That file is not a CSV or XLSX dataset.");
  }
}

/** Read the optional licensed image ZIP into image entries. */
export async function readImageZipFile(file: File): Promise<ZipEntry[]> {
  if (extensionOf(file.name) !== ".zip") {
    throw new Error("The image package must be a .zip archive.");
  }
  return await readImageZipEntries(new Uint8Array(await file.arrayBuffer()));
}

/** Base64 for one image, for the chunked upload to Convex storage. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
