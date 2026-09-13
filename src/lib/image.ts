/**
 * Client-side image compression. A phone photo is 3–8 MB; the evidence we
 * store needs to be a few hundred KB at most, and it never needs to be larger
 * than a screen. Re-encodes as JPEG on a canvas — no dependencies.
 */
export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate encoded size in bytes. */
  bytes: number;
}

export const MAX_PHOTO_DATA_URL_CHARS = 2_000_000; // ≈1.5 MB decoded

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

export async function compressImage(
  file: File,
  { maxEdge = 1280, quality = 0.82 }: { maxEdge?: number; quality?: number } = {}
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG or HEIC).");
  }
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  // base64 → bytes: 3/4 of the payload, minus the header.
  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  return { dataUrl, width, height, bytes };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
