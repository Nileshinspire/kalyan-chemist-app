/**
 * Download a stored file under its original name. Convex storage URLs are
 * served cross-origin, where browsers often ignore the `download` attribute,
 * so fetch the bytes and save them through a local object URL instead.
 * Falls back to opening the file if the fetch is blocked.
 */
export async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
