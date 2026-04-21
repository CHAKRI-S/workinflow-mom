"use client";

import imageCompression from "browser-image-compression";

/**
 * Compress JPG/PNG client-side. Leaves PDFs untouched.
 * Target: ~1 MB, max dimension 1920px, auto webworker.
 */
export async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 500 * 1024) return file; // <=500KB: not worth it

  try {
    const compressed: Blob = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      // keep original type (jpeg stays jpeg, png stays png)
      fileType: file.type,
      initialQuality: 0.8,
    });
    // browser-image-compression returns a Blob in some setups; normalize to File
    if (compressed instanceof File) return compressed;
    return new File([compressed], file.name, {
      type: (compressed as Blob).type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    // fall back to original on any error
    return file;
  }
}
