/**
 * Export an array of objects as a CSV file download.
 */
export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[],
): void {
  if (data.length === 0) return;

  // Use provided columns or auto-detect from first row
  const cols = columns || Object.keys(data[0]).map((key) => ({
    key: key as keyof T,
    header: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
  }));

  const headerRow = cols.map((c) => escapeCsvField(c.header));

  const rows = data.map((row) =>
    cols.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return "";
      if (typeof val === "number") return String(val);
      return escapeCsvField(String(val));
    }),
  );

  const csv = [headerRow.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
