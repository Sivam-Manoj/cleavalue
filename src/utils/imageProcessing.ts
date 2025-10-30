import {Jimp} from "jimp";
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
  targetWidth?: number; // default 1200
  targetHeight?: number; // default 900
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
  const targetW = Math.max(1, Math.floor(options.targetWidth ?? 1200));
  const targetH = Math.max(1, Math.floor(options.targetHeight ?? 900));

  // Read image and resize to exact target using a 'cover' crop
  const image = await Jimp.read(inputBuffer);
  const imgW = image.width;
  const imgH = image.height;
  const s = Math.max(targetW / Math.max(1, imgW), targetH / Math.max(1, imgH));
  const resized = image.clone().resize({ w: Math.ceil(imgW * s) });
  const rw = resized.width;
  const rh = resized.height;
  const cropX = Math.max(0, Math.floor((rw - targetW) / 2));
  const cropY = Math.max(0, Math.floor((rh - targetH) / 2));
  const base = resized.crop({ x: cropX, y: cropY, w: targetW, h: targetH });

  // Read logo and resize proportionally to image width
  const absLogoPath = path.isAbsolute(logoPath)
    ? logoPath
    : path.resolve(process.cwd(), logoPath);
  const logo = await Jimp.read(await fs.readFile(absLogoPath));
  const logoTargetW = Math.max(24, Math.round(targetW * logoScale));
  logo.resize({ w: logoTargetW });
  const lw = logo.width;
  const lh = logo.height;

  // Dynamic margin combines pixel and percent-based margins
  const dynMargin = Math.max(
    logoMarginPx,
    Math.round(Math.min(targetW, targetH) * Math.max(0, Math.min(0.1, logoMarginPct)))
  );

  // Position with margin (default: top-right)
  const left = Math.max(0, targetW - lw - dynMargin);
  const top = logoPosition === "bottom_right"
    ? Math.max(0, targetH - lh - dynMargin)
    : Math.max(0, dynMargin);

  // Composite logo
  const composed = base.clone().composite(logo, left, top);

  // Quality ramp-down only (preserve exact 1200x900 dimensions)
  // In modern Jimp, quality is set via encoder options
  let q = qualityStart;
  let out = await composed.getBuffer("image/jpeg", { quality: q });
  
  while (out.length > maxBytes && q > qualityMin) {
    q = Math.max(qualityMin, q - 6);
    out = await composed.getBuffer("image/jpeg", { quality: q });
  }
  return { buffer: out, format: "jpeg" };
}
