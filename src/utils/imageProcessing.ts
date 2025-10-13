import Jimp from "jimp";
import path from "path";
import fs from "fs/promises";

export type ProcessOptions = {
  maxBytes?: number; // default 1MB
  qualityStart?: number; // starting JPEG quality
  qualityMin?: number; // minimum JPEG quality before resizing
  logoScale?: number; // portion of image width (e.g., 0.12 = 12%)
  logoMarginPx?: number; // margin from edges in px
  logoMarginPct?: number; // optional, portion of min(imgW,imgH) for margin (e.g., 0.02 = 2%)
  logoPosition?: "top_right" | "bottom_right"; // default top_right
};

export async function processImageWithLogo(
  inputBuffer: Buffer,
  logoPath: string,
  options: ProcessOptions = {}
): Promise<{ buffer: Buffer; format: "jpeg" }> {
  const maxBytes = options.maxBytes ?? 1 * 1024 * 1024; // 1MB
  const qualityStart = options.qualityStart ?? 82;
  const qualityMin = options.qualityMin ?? 50;
  const logoScale = options.logoScale ?? 0.16;
  const logoMarginPx = options.logoMarginPx ?? 12;
  const logoMarginPct = options.logoMarginPct ?? 0.02; // 2% of smaller side
  const logoPosition = options.logoPosition ?? "bottom_right";

  // Read image (Jimp doesn't auto-rotate EXIF by default in core)
  const image = await Jimp.read(inputBuffer);
  const imgW = image.getWidth();
  const imgH = image.getHeight();

  // Read logo and resize proportionally to image width
  const absLogoPath = path.isAbsolute(logoPath)
    ? logoPath
    : path.resolve(process.cwd(), logoPath);
  const logo = await Jimp.read(await fs.readFile(absLogoPath));
  const logoTargetW = Math.max(24, Math.round(imgW * logoScale));
  logo.resize(logoTargetW, Jimp.AUTO);
  const lw = logo.getWidth();
  const lh = logo.getHeight();

  // Dynamic margin combines pixel and percent-based margins
  const dynMargin = Math.max(
    logoMarginPx,
    Math.round(Math.min(imgW, imgH) * Math.max(0, Math.min(0.1, logoMarginPct)))
  );

  // Position with margin (default: top-right)
  const left = Math.max(0, imgW - lw - dynMargin);
  const top = logoPosition === "bottom_right"
    ? Math.max(0, imgH - lh - dynMargin)
    : Math.max(0, dynMargin);

  // Composite logo
  const composed = image.clone().composite(logo, left, top, {
    mode: Jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1,
  });

  // 1) Quality ramp-down
  let q = qualityStart;
  let out = await composed.clone().quality(q).getBufferAsync(Jimp.MIME_JPEG);
  while (out.length > maxBytes && q > qualityMin) {
    q = Math.max(qualityMin, q - 6);
    out = await composed.clone().quality(q).getBufferAsync(Jimp.MIME_JPEG);
  }
  if (out.length <= maxBytes) {
    return { buffer: out, format: "jpeg" };
  }

  // 2) Resize down progressively if still too big
  let width = imgW;
  let attempts = 0;
  const minWidth = 600;
  let scaled = composed.clone();
  while (attempts < 4 && out.length > maxBytes && width > minWidth) {
    const ratio = Math.sqrt(maxBytes / out.length) * 0.98; // bias down a little
    const targetW = Math.max(minWidth, Math.floor(width * Math.min(0.95, Math.max(0.5, ratio))));
    scaled = composed.clone().resize(targetW, Jimp.AUTO);
    out = await scaled.clone().quality(Math.max(qualityMin, Math.min(75, q))).getBufferAsync(Jimp.MIME_JPEG);
    width = targetW;
    attempts += 1;
  }

  return { buffer: out, format: "jpeg" };
}
