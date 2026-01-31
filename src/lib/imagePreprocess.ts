import sharp from 'sharp';

export async function autoCleanImage(input: Buffer) {
  // Deterministic, "safe" pre-processing:
  // - Respect EXIF orientation
  // - Light normalization + gentle denoise/sharpen
  // - Resize down to a sane max to keep inference + payload reasonable
  //
  // Note: we intentionally avoid aggressive edits (content-aware fills, heavy blur, etc.).
  const cleaned = await sharp(input)
    .rotate() // auto-orient
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .normalize()
    .gamma(1.05)
    .modulate({ brightness: 1.03, saturation: 1.03 })
    .median(1)
    .sharpen({ sigma: 1 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return { buffer: cleaned, mimeType: 'image/png' } as const;
}
