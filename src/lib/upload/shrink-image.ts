/**
 * Photos prises au téléphone (souvent 3 à 8 Mo) : réduites dans le navigateur avant l'envoi,
 * pour passer sous la limite d'envoi du serveur. Côté largeur, 2 400 px suffisent au site.
 * Un fichier déjà léger, un PDF ou un format non lisible par le navigateur est laissé tel quel.
 */
export const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2400;

export function needsShrink(file: { type: string; size: number }): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type) && file.size > TARGET_BYTES;
}

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function shrinkImage(file: File): Promise<File> {
  if (!needsShrink(file) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    // WebP si le navigateur sait l'écrire, sinon JPEG (jamais de PNG géant).
    let blob = await encode("image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", 0.85);
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
