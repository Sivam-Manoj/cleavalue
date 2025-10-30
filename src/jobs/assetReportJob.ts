import { uploadToR2, uploadBufferToR2 } from "../utils/r2Storage/r2Upload.js";
import { processImageWithLogo } from "../utils/imageProcessing.js";
import AssetReport from "../models/asset.model.js";
import PdfReport from "../models/pdfReport.model.js";
import {
  analyzeAssetImages,
  type AssetAnalysisResult,
} from "../service/assetOpenAIService.js";
import { generateAssetDocxFromReport } from "../service/assetDocxService.js";
import User from "../models/user.model.js";
import { generateAssetPdfFromReport } from "../service/assetPdfService.js";
import { generateAssetXlsxFromReport } from "../service/xlsx/assetXlsxService.js";
import {
  startProgress,
  updateProgress,
  endProgress,
  type StepRec as StoreStepRec,
} from "../utils/progressStore.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";
import axios from "axios";
import { enrichLotsWithVin } from "../service/vehicleApiService.js";

export type AssetGroupingMode =
  | "single_lot"
  | "per_item"
  | "per_photo"
  | "catalogue"
  | "combined"
  | "mixed";

export type AssetJobInput = {
  user: { id: string; email: string; name?: string | null };
  images: Express.Multer.File[];
  videos?: Express.Multer.File[]; // optional: user-provided videos to include in zip only
  details: any;
  progressId?: string;
};

export function queueAssetReportJob(input: AssetJobInput) {
  // Run in background without awaiting response lifecycle
  setImmediate(() =>
    runAssetReportJob(input).catch((e) => {
      if (input.progressId)
        endProgress(input.progressId, false, "Error processing request");
      console.error("Asset job failed:", e);
    })
  );
}

// Background job: generate preview files on submission (non-blocking)
export function queuePreviewFilesJob(reportId: string) {
  setImmediate(() =>
    runPreviewFilesJob(reportId).catch((e) => {
      console.error("[PreviewFilesJob] Failed:", e);
    })
  );
}

export async function runPreviewFilesJob(reportId: string) {
  try {
    console.log(`[PreviewFilesJob] Starting for report ${reportId}`);
    const report = await AssetReport.findById(reportId).populate("user");
    if (!report) throw new Error(`Report ${reportId} not found`);
    if (!report.preview_data)
      throw new Error(`Report ${reportId} missing preview_data`);

    const user = report.user as any;
    const reportData = {
      ...report.toObject(),
      ...report.preview_data,
      inspector_name: user?.name || user?.username || "",
      user_email: user?.email || "",
      user_cv_url: (user as any)?.cvUrl || (report as any)?.user_cv_url,
      user_cv_filename:
        (user as any)?.cvFilename || (report as any)?.user_cv_filename,
    } as any;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`🚀 [PreviewFilesJob] GENERATING DOCX WITH NEW STYLE (CUSTOM COVER + CV MERGE)`);
    console.log(`${"=".repeat(80)}`);
    console.log(`📋 Report ID: ${reportId}`);
    console.log(`👤 User: ${user?.name || user?.username || "Unknown"} (${user?.email})`);
    console.log(`📄 Prepared For: ${reportData.prepared_for || reportData.client_name || "NOT SET"}`);
    console.log(`🎓 CV URL: ${reportData.user_cv_url || "NOT PROVIDED - WILL SKIP CV"}`);
    console.log(`${"=".repeat(80)}\n`);
    
    const docxBuffer = await generateAssetDocxFromReport(reportData);
    
    console.log(`\n✅ [PreviewFilesJob] DOCX GENERATED SUCCESSFULLY!`);
    console.log(`📦 Size: ${(docxBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔗 Will be uploaded to: https://images.sellsnap.store/previews/asset-preview-${reportId}.docx\n`);
    const xlsxBuffer = await generateAssetXlsxFromReport(reportData);
    const allUrls: string[] = Array.isArray((report as any)?.imageUrls)
      ? (report as any).imageUrls
      : [];
    const lotsForNames: any[] = Array.isArray((report as any)?.preview_data?.lots)
      ? (report as any).preview_data.lots
      : [];
    const renameMap: Record<string, string> = {};
    let lotCounter = 0;
    for (const lot of lotsForNames) {
      lotCounter += 1;
      const lotNoSimple = lotCounter; // no padding
      const urls: string[] = [];
      if (Array.isArray(lot?.image_urls)) {
        urls.push(...(lot.image_urls as string[]));
      } else if (Array.isArray(lot?.image_indexes)) {
        urls.push(
          ...(lot.image_indexes as number[])
            .map((i: number) => allUrls[i])
            .filter(Boolean)
        );
      }
      if (Array.isArray(lot?.extra_image_urls)) {
        urls.push(...(lot.extra_image_urls as string[]));
      } else if (Array.isArray(lot?.extra_image_indexes)) {
        urls.push(
          ...(lot.extra_image_indexes as number[])
            .map((i: number) => allUrls[i])
            .filter(Boolean)
        );
      }
      let seq = 0;
      for (const u of urls) {
        if (!u || renameMap[u]) continue;
        seq += 1;
        renameMap[u] = `${lotNoSimple}.${seq}.jpg`;
      }
    }
    const imagesZip = await generateImagesZip(allUrls, renameMap);

    const docxFilename = `asset-preview-${reportId}.docx`;
    const xlsxFilename = `asset-preview-${reportId}.xlsx`;
    const imagesFilename = `asset-preview-images-${reportId}.zip`;

    await Promise.all([
      uploadBufferToR2(
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        process.env.R2_BUCKET_NAME!,
        `previews/${docxFilename}`
      ),
      uploadBufferToR2(
        xlsxBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        process.env.R2_BUCKET_NAME!,
        `previews/${xlsxFilename}`
      ),
      uploadBufferToR2(
        imagesZip,
        "application/zip",
        process.env.R2_BUCKET_NAME!,
        `previews/${imagesFilename}`
      ),
    ]);

    (report as any).preview_files = {
      docx: `https://images.sellsnap.store/previews/${docxFilename}`,
      excel: `https://images.sellsnap.store/previews/${xlsxFilename}`,
      images: `https://images.sellsnap.store/previews/${imagesFilename}`,
    } as any;
    
    // Status should already be 'pending_approval' (set when user clicked submit)
    // Just update the approval_requested_at if not set
    if (!report.approval_requested_at) {
      report.approval_requested_at = new Date();
    }
    await report.save();
    
    console.log(`✅ Files created for report ${reportId} (status: ${report.status})`);

    // IMPORTANT: Send emails ONLY after files are created and status is set
    // This ensures users and admins are notified only when everything is ready
    const { sendPreviewSubmittedEmail, sendAdminApprovalRequestEmail } =
      await import("../service/assetEmailService.js");
    await sendPreviewSubmittedEmail(
      user.email,
      user.name || user.username || "User",
      String(report._id)
    );
    const adminEmail = process.env.ADMIN_EMAIL || "admin@clearvalue.com";
    await sendAdminApprovalRequestEmail(
      adminEmail,
      user.name || user.username || "User",
      user.email,
      String(report._id)
    );

    console.log(`📧 Emails sent to user and admin`);
    console.log(`[PreviewFilesJob] Completed for report ${reportId}`);
  } catch (e) {
    console.error(`[PreviewFilesJob] Error for report ${reportId}:`, e);
    throw e;
  }
}

export async function runAssetReportJob({
  user,
  images,
  videos = [],
  details,
  progressId,
}: AssetJobInput) {
  const processStartedAt = Date.now();
  type StepRec = {
    key: string;
    label: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
  };
  const steps: StepRec[] = [];

  if (progressId) startProgress(progressId);
  const syncStoreSteps = () => {
    if (!progressId) return;
    updateProgress(progressId, { steps: steps as unknown as StoreStepRec[] });
  };
  const setServerProg01 = (v: number) => {
    if (!progressId) return;
    const clamped = Math.max(0, Math.min(1, v));
    updateProgress(progressId, { serverProgress01: clamped });
  };
  const SERVER_WEIGHTS = {
    r2_upload: 0.18,
    ai_analysis: 0.48,
    rename_images_by_lot: 0.04,
    generate_pdf: 0.12,
    generate_docx: 0.12,
    generate_xlsx: 0.06,
    save_pdf_file: 0.02,
    save_docx_file: 0.02,
    save_xlsx_file: 0.01,
    save_images_folder: 0.02,
    zip_images: 0.02,
    create_pdf_record: 0.0,
    create_docx_record: 0.0,
    create_xlsx_record: 0.0,
    create_images_record: 0.0,
    finalize: 0,
  } as const;
  let serverAccum = 0;
  const startStep = (key: string, label: string) => {
    steps.push({ key, label, startedAt: new Date().toISOString() });
    syncStoreSteps();
  };
  const endStep = (key: string) => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.key === key && !s.endedAt) {
        s.endedAt = new Date().toISOString();
        const start = s.startedAt
          ? new Date(s.startedAt).getTime()
          : Date.now();
        s.durationMs = new Date(s.endedAt).getTime() - start;
        break;
      }
    }
    syncStoreSteps();
    if ((SERVER_WEIGHTS as any)[key] != null) {
      serverAccum = Math.min(1, serverAccum + (SERVER_WEIGHTS as any)[key]);
      setServerProg01(serverAccum);
    }
  };

  async function withStep<T>(
    key: string,
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    startStep(key, label);
    try {
      return await fn();
    } finally {
      endStep(key);
    }
  }

  try {
    const groupingMode: AssetGroupingMode =
      details?.grouping_mode === "per_item" ||
      details?.grouping_mode === "per_photo" ||
      details?.grouping_mode === "catalogue" ||
      details?.grouping_mode === "combined" ||
      details?.grouping_mode === "mixed"
        ? details.grouping_mode
        : "single_lot";

    const imageUrls: string[] = [];
    const selectedLanguage: "en" | "fr" | "es" = ((): any => {
      const l = String(details?.language || "").toLowerCase();
      return l === "fr" || l === "es" ? l : "en";
    })();
    const selectedCurrency: string = ((): string => {
      const c = String(details?.currency || "").toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? c : "CAD";
    })();
    if (images?.length) {
      startStep("r2_upload", "Uploading images to storage");
      const total = images.length;
      for (let idx = 0; idx < images.length; idx++) {
        const file = images[idx];
        const timestamp = Date.now();
        // Resolve original buffer robustly
        const anyFile = file as any;
        let inputBuffer: Buffer | null = null;
        if (anyFile?.buffer && Buffer.isBuffer(anyFile.buffer)) {
          inputBuffer = anyFile.buffer as Buffer;
        } else if (typeof anyFile?.path === "string") {
          try {
            inputBuffer = await fs.readFile(anyFile.path);
          } catch {}
        }

        let fileUrl: string;
        if (inputBuffer) {
          // Process: add logo + ensure <=1MB; fallback to original if anything fails
          try {
            const { buffer } = await processImageWithLogo(
              inputBuffer,
              "public/logoNobg.png",
              { maxBytes: 1024 * 1024 }
            );
            const safeBase = String(file.originalname || `image-${idx + 1}`)
              .replace(/[^a-zA-Z0-9._-]/g, "-")
              .replace(/\.[^./\\]+$/, "");
            const fileName = `uploads/asset/${timestamp}-${safeBase}.jpg`;
            await uploadBufferToR2(
              buffer,
              "image/jpeg",
              process.env.R2_BUCKET_NAME!,
              fileName
            );
            fileUrl = `https://images.sellsnap.store/${fileName}`;
            console.log(`✅ Logo added to image ${idx + 1}/${total}`);
          } catch (procErr) {
            console.warn(`⚠️  Logo processing failed for image ${idx + 1}, using original:`, procErr);
            const fileName = `uploads/asset/${timestamp}-${file.originalname}`;
            await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
            fileUrl = `https://images.sellsnap.store/${fileName}`;
          }
        } else {
          // Fallback to original upload method
          const fileName = `uploads/asset/${timestamp}-${file.originalname}`;
          await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
          fileUrl = `https://images.sellsnap.store/${fileName}`;
        }
        imageUrls.push(fileUrl);
        if (progressId) {
          const partial = (idx + 1) / total;
          const current = serverAccum + partial * SERVER_WEIGHTS.r2_upload;
          setServerProg01(current);
        }
      }
      endStep("r2_upload");
    }

    let analysis: any = null;
    let lots: any[] = [];

    if (groupingMode === "catalogue") {
      // Parse mapping from details
      const rawLots: any[] = Array.isArray(details?.catalogue_lots)
        ? details.catalogue_lots
        : [];
      type LotMap = { count: number; cover_index?: number };
      const mappings: LotMap[] = rawLots
        .map((x: any) => ({
          count: Math.max(0, parseInt(String(x?.count ?? 0), 10) || 0),
          cover_index:
            typeof x?.cover_index === "number"
              ? x.cover_index
              : typeof x?.coverIndex === "number"
                ? x.coverIndex
                : 0,
        }))
        .filter((m: LotMap) => Number.isFinite(m.count) && m.count > 0);

      // Fallback: if mapping missing/invalid, treat all as one lot
      const totalImages = imageUrls.length;
      const sum = mappings.reduce((s, m) => s + m.count, 0);
      const useMappings: LotMap[] =
        mappings.length > 0 && sum <= totalImages
          ? mappings
          : totalImages > 0
            ? [{ count: Math.min(20, totalImages), cover_index: 0 }]
            : [];

      // Adjust last mapping to consume remaining images (if any shortfall)
      const mappedSum = useMappings.reduce((s, m) => s + m.count, 0);
      if (mappedSum < totalImages && useMappings.length > 0) {
        useMappings[useMappings.length - 1].count += totalImages - mappedSum;
      }

      // Analyze each lot independently using catalogue prompt
      startStep("ai_analysis", "AI analysis of images (catalogue)");
      let base = 0;
      for (let lotIdx = 0; lotIdx < useMappings.length; lotIdx++) {
        const { count, cover_index } = useMappings[lotIdx];
        // End of this lot in GLOBAL terms must always respect the original count
        const end = Math.min(imageUrls.length, base + Math.max(0, count));

        // For AI, we can limit the number of images to analyze (performance),
        // but we will still assign the FULL range of indexes to the lot below.
        const aiEnd = Math.min(end, base + Math.max(0, Math.min(20, count)));
        const aiLocalIdxs = Array.from(
          { length: Math.max(0, aiEnd - base) },
          (_, i) => base + i
        );
        const subUrls = aiLocalIdxs.map((i) => imageUrls[i]);

        if (subUrls.length === 0) {
          base = end;
          continue;
        }

        try {
          const aiRes = await analyzeAssetImages(
            subUrls,
            "catalogue",
            selectedLanguage,
            selectedCurrency
          );
          if (!analysis) analysis = { per_lot: [] };
          analysis.per_lot.push(aiRes);

          const lotResults = Array.isArray(aiRes?.lots) ? aiRes.lots : [];
          for (const lot of lotResults as any[]) {
            // Build FULL global index range for this lot (not limited by AI subset)
            const mappedIdxs = Array.from(
              { length: Math.max(0, end - base) },
              (_, i) => base + i
            );
            const urlsFromIdx = mappedIdxs
              .map((gi) => imageUrls[gi])
              .filter(Boolean);

            // Determine cover image: client-provided within lot range; default 0
            const coverLocal = Math.max(
              0,
              Math.min(
                Math.max(0, count) - 1,
                typeof cover_index === "number" ? cover_index : 0
              )
            );
            const coverGlobal = base + coverLocal;
            const coverUrl = imageUrls[coverGlobal];

            const urlsSet = new Set<string>([
              ...urlsFromIdx,
              ...(coverUrl ? [coverUrl] : []),
            ]);
            const urls = Array.from(urlsSet);

            // Ensure unique, sequential lot IDs across the whole report
            const uniqueLotId = `lot-${String(lotIdx + 1).padStart(3, "0")}`;

            // Map per-item image references (if provided) from local index -> global index/url
            let itemsOut: any[] | undefined = undefined;
            if (Array.isArray(lot?.items)) {
              itemsOut = (lot.items as any[]).map(
                (it: any, itemIdx: number) => {
                  const {
                    image_local_index,
                    image_url: aiItemUrl,
                    ...rest
                  } = it || {};
                  let globalIdx: number | undefined = undefined;
                  if (Number.isFinite(image_local_index)) {
                    const local = Math.max(0, Math.floor(image_local_index));
                    // image_local_index is relative to subUrls order
                    if (local >= 0 && local < aiLocalIdxs.length) {
                      globalIdx = aiLocalIdxs[local];
                    }
                  }
                  // Fallback: assign a distinct-ish index from the full mapped range
                  if (globalIdx == null && mappedIdxs.length > 0) {
                    // Distribute items across available images in a round-robin fashion
                    globalIdx = mappedIdxs[itemIdx % mappedIdxs.length];
                  }
                  const resolvedUrl: string | undefined =
                    typeof aiItemUrl === "string" && aiItemUrl
                      ? aiItemUrl
                      : globalIdx != null
                        ? imageUrls[globalIdx]
                        : undefined;
                  return {
                    ...rest,
                    image_index: globalIdx,
                    image_url: resolvedUrl,
                  };
                }
              );
            }

            lots.push({
              ...lot,
              lot_id: uniqueLotId,
              image_url: coverUrl || lot?.image_url || urls[0] || undefined,
              image_indexes: mappedIdxs,
              image_urls: urls,
              ...(itemsOut ? { items: itemsOut } : {}),
            });
          }
        } catch (e) {
          console.error(
            `AI analysis failed for catalogue lot #${lotIdx + 1}:`,
            e
          );
        }

        // Partial progress update within AI phase
        if (progressId) {
          const partial = (lotIdx + 1) / useMappings.length;
          const current = serverAccum + partial * SERVER_WEIGHTS.ai_analysis;
          setServerProg01(current);
        }

        // Advance base by the ORIGINAL count to keep subsequent lots aligned
        base = end;
      }
      endStep("ai_analysis");
    } else if (groupingMode === "mixed") {
      // Mixed mode: multiple lots with specified sub-mode each
      type MixedMap = {
        count: number;
        extraCount: number;
        cover_index?: number;
        mode: "single_lot" | "per_item" | "per_photo";
      };
      const rawLots: any[] = Array.isArray(details?.mixed_lots)
        ? details.mixed_lots
        : [];
      const mappings: MixedMap[] = rawLots
        .map((x: any) => {
          const m = String(x?.mode || "").trim();
          const mode =
            m === "per_item" || m === "per_photo" || m === "single_lot"
              ? (m as any)
              : undefined;
          return {
            count: Math.max(0, parseInt(String(x?.count ?? 0), 10) || 0),
            extraCount: Math.max(
              0,
              parseInt(String(x?.extra_count ?? 0), 10) || 0
            ),
            cover_index:
              typeof x?.cover_index === "number"
                ? x.cover_index
                : typeof x?.coverIndex === "number"
                  ? x.coverIndex
                  : 0,
            mode,
          } as MixedMap;
        })
        .filter(
          (m: MixedMap) => Number.isFinite(m.count) && m.count > 0 && !!m.mode
        );

      // Ensure mappings do not exceed available total images
      const totalImages = imageUrls.length;
      let useMappings: MixedMap[] = [...mappings];
      let sum = useMappings.reduce((s, m) => s + m.count, 0);
      let overflow = Math.max(0, sum - totalImages);
      while (overflow > 0 && useMappings.length) {
        const last = useMappings[useMappings.length - 1];
        const reduceBy = Math.min(overflow, last.count);
        last.count -= reduceBy;
        overflow -= reduceBy;
        if (last.count <= 0) useMappings.pop();
      }

      if (useMappings.length > 0)
        startStep("ai_analysis", "AI analysis of images (mixed)");
      let base = 0;
      let lotCounter = 0;
      for (let lotIdx = 0; lotIdx < useMappings.length; lotIdx++) {
        const {
          count,
          extraCount,
          cover_index,
          mode: subMode,
        } = useMappings[lotIdx];
        const end = Math.min(imageUrls.length, base + Math.max(0, count));
        const extraEnd = Math.min(
          imageUrls.length,
          end + Math.max(0, extraCount)
        );

        // For AI cost/perf: analyze up to 30 images per lot (main images only, not extra)
        const aiEnd = Math.min(end, base + Math.max(0, Math.min(30, count)));
        const aiLocalIdxs = Array.from(
          { length: Math.max(0, aiEnd - base) },
          (_, i) => base + i
        );
        const subUrls = aiLocalIdxs.map((i) => imageUrls[i]);

        // Collect extra images (not sent to AI)
        const extraImageIdxs = Array.from(
          { length: Math.max(0, extraEnd - end) },
          (_, i) => end + i
        );
        const extraImageUrls = extraImageIdxs
          .map((i) => imageUrls[i])
          .filter(Boolean);

        if (subUrls.length === 0 || !subMode) {
          base = extraEnd;
          continue;
        }

        try {
          const aiRes = await analyzeAssetImages(
            subUrls,
            subMode,
            selectedLanguage,
            selectedCurrency
          );
          if (!analysis) analysis = { mixed: [] };
          if (!Array.isArray(analysis.mixed)) analysis.mixed = [];
          analysis.mixed.push({ mode: subMode, result: aiRes });

          const lotResults = Array.isArray(aiRes?.lots) ? aiRes.lots : [];
          for (const lot of lotResults as any[]) {
            // Map local image_indexes (0..sub-1) to global indexes via aiLocalIdxs
            const localIdxs: number[] = Array.isArray(lot?.image_indexes)
              ? Array.from(
                  new Set<number>(
                    (lot.image_indexes as any[])
                      .map((n: any) => parseInt(String(n), 10))
                      .filter(
                        (n: number) =>
                          Number.isFinite(n) && n >= 0 && n < aiLocalIdxs.length
                      )
                  )
                )
              : [];
            const mappedIdxs: number[] = localIdxs.map((li) => aiLocalIdxs[li]);

            // Also include inferred global index from direct image_url when present
            const directUrl: string | undefined =
              typeof lot?.image_url === "string" && lot.image_url
                ? lot.image_url
                : undefined;
            if (directUrl) {
              const gi = imageUrls.indexOf(directUrl);
              if (gi >= 0) mappedIdxs.push(gi);
            }
            const idxs = Array.from(new Set(mappedIdxs)).filter(
              (n) => Number.isFinite(n) && n >= 0 && n < imageUrls.length
            );
            const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);

            // Determine cover image within this segment
            const coverLocal = Math.max(
              0,
              Math.min(
                Math.max(0, count) - 1,
                typeof cover_index === "number" ? cover_index : 0
              )
            );
            const coverGlobal = base + coverLocal;
            const coverUrl = imageUrls[coverGlobal];

            const urlsSet = new Set<string>([
              ...urlsFromIdx,
              ...(coverUrl ? [coverUrl] : []),
            ]);
            const urls = Array.from(urlsSet);

            lotCounter += 1;
            const uniqueLotId = `lot-${String(lotCounter).padStart(3, "0")}`;

            // Resolve primary image for this lot
            const primaryIdx =
              Array.isArray(idxs) && idxs.length ? idxs[0] : undefined;
            const primaryFromIdx =
              primaryIdx != null ? imageUrls[primaryIdx] : undefined;
            const primaryUrl =
              directUrl || primaryFromIdx || urls[0] || coverUrl || undefined;

            const out = {
              ...lot,
              lot_id: uniqueLotId,
              image_url:
                subMode === "per_item"
                  ? primaryUrl
                  : coverUrl || directUrl || urls[0] || undefined,
              image_indexes:
                subMode === "per_item"
                  ? ((): number[] => {
                      if (primaryIdx != null && Number.isFinite(primaryIdx))
                        return [primaryIdx];
                      if (directUrl) {
                        const gi = imageUrls.indexOf(directUrl);
                        if (gi >= 0) return [gi];
                      }
                      return [];
                    })()
                  : idxs,
              image_urls:
                subMode === "per_item"
                  ? primaryUrl
                    ? [primaryUrl]
                    : []
                  : urls,
              extra_image_indexes: extraImageIdxs,
              extra_image_urls: extraImageUrls,
              // For traceability, include sub-mode tag
              tags: Array.isArray(lot?.tags)
                ? Array.from(
                    new Set([
                      ...(lot.tags as any[]).map(String),
                      `mode:${subMode}`,
                    ])
                  )
                : [`mode:${subMode}`],
              mixed_group_index: lotIdx + 1,
              sub_mode: subMode,
            } as any;

            if (process.env.DEBUG_PER_ITEM === "1" && subMode === "per_item") {
              try {
                console.log("[PerItemDebug][mixed:lot:final]", {
                  lot_id: out?.lot_id,
                  title: typeof out?.title === "string" ? out.title : undefined,
                  chosenUrl: out?.image_url,
                  image_url_in:
                    typeof lot?.image_url === "string"
                      ? lot.image_url
                      : undefined,
                  mappedIdxs: idxs,
                  primaryIdx,
                  primaryFromIdx,
                  directUrl,
                });
              } catch {}
            }

            lots.push(out);
          }
        } catch (e) {
          console.error(
            `AI analysis failed for mixed lot #${lotIdx + 1} (${subMode}):`,
            e
          );
        }

        // Partial progress update within AI phase
        if (progressId) {
          const partial = (lotIdx + 1) / useMappings.length;
          const current = serverAccum + partial * SERVER_WEIGHTS.ai_analysis;
          setServerProg01(current);
        }

        base = extraEnd; // Advance past both main and extra images
      }
      if (useMappings.length > 0) endStep("ai_analysis");
    } else if (groupingMode === "combined") {
      // Combined mode: run per_item once, then derive per_photo and single_lot views from the SAME items
      const urlsForAI = imageUrls.slice(0, 50); // cap for cost/perf
      if (urlsForAI.length > 0) {
        try {
          startStep(
            "ai_analysis",
            "AI analysis of images (combined -> per_item primary)"
          );
          const perItemRes = await analyzeAssetImages(
            urlsForAI,
            "per_item",
            selectedLanguage,
            selectedCurrency
          );
          endStep("ai_analysis");
          analysis = perItemRes;
          // Normalize items to include a canonical image_index if available (first index)
          const perItemLots: any[] = (perItemRes?.lots || []).map(
            (lot: any) => {
              const firstIdx =
                Array.isArray(lot?.image_indexes) && lot.image_indexes.length
                  ? lot.image_indexes[0]
                  : undefined;
              return {
                ...lot,
                image_index: Number.isFinite(firstIdx) ? firstIdx : undefined,
              };
            }
          );

          // Derive per_photo: one row per original image index, mapping to the first per_item lot referencing that image index
          const perPhotoLots: any[] = [];
          for (let i = 0; i < imageUrls.length; i++) {
            const match = perItemLots.find(
              (l: any) =>
                Array.isArray(l?.image_indexes) && l.image_indexes.includes(i)
            );
            if (match) {
              perPhotoLots.push({
                ...match,
                image_index: i,
              });
            } else {
              // optional: include placeholders for images without detected items
              // per requirements, we can skip unmatched to keep table concise
            }
          }

          // Respect requested combined modes from details
          const rawModes = Array.isArray(details?.combined_modes)
            ? (details.combined_modes as any[])
            : ["single_lot", "per_item", "per_photo"];
          const selectedModes: ("single_lot" | "per_item" | "per_photo")[] =
            Array.from(
              new Set(
                rawModes
                  .map((m) => {
                    const s = String(m);
                    return s === "per_lot" ? "per_photo" : s;
                  })
                  .filter(
                    (m) =>
                      m === "single_lot" ||
                      m === "per_item" ||
                      m === "per_photo"
                  )
              )
            ) as any;
          // Choose primary lots for totals depending on selection
          if (selectedModes.includes("per_item")) {
            lots = perItemLots;
          } else if (selectedModes.includes("single_lot")) {
            lots = perItemLots; // single_lot view is consolidated items
          } else if (selectedModes.includes("per_photo")) {
            lots = perPhotoLots;
          } else {
            lots = perItemLots;
          }

          // Attach a combined payload that builders can use
          (analysis as any).combined = {
            per_item: perItemLots,
            per_photo: perPhotoLots,
            single_lot: perItemLots, // single-lot view as consolidated items
          };
          (analysis as any).combined_modes = selectedModes;
        } catch (e) {
          console.error("Error during combined AI analysis:", e);
          if (progressId) endStep("ai_analysis");
        }
      }
    } else {
      // Existing behavior for single_lot, per_item, per_photo (limit to 10 for AI)
      const urlsForAI = imageUrls.slice(0, 10);
      if (urlsForAI.length > 0) {
        try {
          startStep("ai_analysis", "AI analysis of images");
          analysis = await analyzeAssetImages(
            urlsForAI,
            groupingMode,
            selectedLanguage,
            selectedCurrency
          );
          endStep("ai_analysis");
        } catch (e) {
          console.error("Error during asset AI analysis:", e);
          if (progressId) endStep("ai_analysis");
        }
      }

      lots = (analysis?.lots || []).map((lot: any, idx: number) => {
        const total = imageUrls.length;
        const idxs: number[] = Array.isArray(lot?.image_indexes)
          ? Array.from(
              new Set<number>(
                (lot.image_indexes as any[])
                  .map((n: any) => parseInt(String(n), 10))
                  .filter(
                    (n: number) => Number.isFinite(n) && n >= 0 && n < total
                  )
              )
            )
          : [];
        // In per_item mode, each item should have only its own primary image index
        if (groupingMode === "per_item" && idxs.length > 1) {
          idxs.splice(1); // keep only the first index
        }
        if (groupingMode === "per_photo" && idxs.length === 0 && imageUrls[idx])
          idxs.push(idx);
        const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);
        const directUrl: string | undefined =
          typeof lot?.image_url === "string" && lot.image_url
            ? lot.image_url
            : undefined;
        if (groupingMode === "per_item" && directUrl) {
          const inferred = imageUrls.indexOf(directUrl);
          if (inferred >= 0) {
            if (idxs.length === 0 || idxs[0] !== inferred) {
              idxs.splice(0, idxs.length, inferred);
            }
          }
        }
        if (idxs.length === 0 && directUrl) {
          const inferred = imageUrls.indexOf(directUrl);
          if (inferred >= 0) idxs.push(inferred);
        }
        let urls: string[] = [];
        if (groupingMode === "per_item") {
          const primaryUrl = directUrl || urlsFromIdx[0] || undefined;
          urls = primaryUrl ? [primaryUrl] : [];
        } else {
          const urlsSet = new Set<string>([
            ...urlsFromIdx,
            ...(directUrl ? [directUrl] : []),
          ]);
          urls = Array.from(urlsSet);
        }
        return { ...lot, image_indexes: idxs, image_urls: urls };
      });

      if (process.env.DEBUG_PER_ITEM === "1" && groupingMode === "per_item") {
        try {
          const dbgList = (lots as any[]).map((l: any) => ({
            lot_id: l?.lot_id,
            title: typeof l?.title === "string" ? l.title : undefined,
            image_url:
              typeof l?.image_url === "string" ? l.image_url : undefined,
            image_indexes: Array.isArray(l?.image_indexes)
              ? l.image_indexes
              : [],
            image_urls: Array.isArray(l?.image_urls) ? l.image_urls : [],
          }));
          const previewImageUrls = imageUrls.slice(0, 20);
          console.log("[PerItemDebug][job:final]", {
            imageUrlsCount: imageUrls.length,
            imageUrlsPreviewCount: previewImageUrls.length,
            imageUrlsPreview: previewImageUrls,
            lotsCount: dbgList.length,
            lots: dbgList,
          });
        } catch {}
      }
    }

    // Lot-number ordering (sticker first):
    // If a lot has a visible numeric lot sticker captured as lot_number, sort by that number asc.
    // Lots without a sticker-provided number keep their default relative order and come after.
    if (
      groupingMode === "per_item" ||
      groupingMode === "per_photo" ||
      groupingMode === "single_lot"
    ) {
      try {
        const decorated = (Array.isArray(lots) ? lots : []).map(
          (lot: any, idx: number) => {
            const raw = lot?.lot_number;
            let num: number | null = null;
            if (typeof raw === "number" && Number.isFinite(raw)) num = raw;
            else if (typeof raw === "string") {
              const m = raw.match(/\d+/);
              if (m) {
                const n = parseInt(m[0], 10);
                if (Number.isFinite(n)) num = n;
              }
            }
            return { idx, num, lot };
          }
        );
        const sticker = decorated.filter((d) => d.num != null);
        const others = decorated.filter((d) => d.num == null);
        sticker.sort(
          (a, b) => (a.num as number) - (b.num as number) || a.idx - b.idx
        );
        const merged = [...sticker, ...others];
        lots = merged.map((d) => d.lot);
      } catch {}
    }

    // VIN-based enrichment (uses NHTSA vPIC) — only if we have lots
    if (Array.isArray(lots) && lots.length > 0) {
      try {
        lots = await withStep(
          "vin_enrichment",
          "Enriching lots with VIN data (vPIC)",
          async () => {
            return await enrichLotsWithVin(lots, groupingMode);
          }
        );
      } catch (e) {
        console.error("VIN enrichment failed:", e);
      }
    }

    // Rename images based on lot numbers with mode prefix (e.g., bundle-1.1.jpg, peritem-2.1.jpg)
    if (Array.isArray(lots) && lots.length > 0 && imageUrls.length > 0) {
      try {
        await withStep(
          "rename_images_by_lot",
          "Renaming images based on lot numbers",
          async () => {
            // Build mapping: oldURL -> {newName, lotNumber, imageIndexInLot}
            type ImageRenameInfo = {
              oldUrl: string;
              newName: string; // e.g., "bundle-1.1.jpg"
              lotNumber: string | number;
              imageIndexInLot: number;
              globalIndex: number;
              modePrefix: string;
            };
            const renameMap: ImageRenameInfo[] = [];

            // Assign sequential lot numbers if not present
            for (let lotIdx = 0; lotIdx < lots.length; lotIdx++) {
              const lot = lots[lotIdx];
              let lotNum: string | number = lot?.lot_number;

              // If lot_number is null/undefined, assign sequential number
              if (lotNum == null || String(lotNum).trim() === "") {
                lotNum = lotIdx + 1;
                lot.lot_number = lotNum;
              }

              // Determine mode prefix based on grouping mode
              let modePrefix = "";
              if (groupingMode === "mixed" && lot?.sub_mode) {
                // For mixed mode, use the sub_mode (single_lot, per_item, per_photo)
                const subMode = String(lot.sub_mode).toLowerCase();
                if (subMode === "single_lot") modePrefix = "bundle";
                else if (subMode === "per_item") modePrefix = "peritem";
                else if (subMode === "per_photo") modePrefix = "perphoto";
              } else if (groupingMode === "combined") {
                // For combined mode, could have different lots from different modes
                // Check tags for mode information
                const modeTags = Array.isArray(lot?.tags)
                  ? lot.tags.filter((t: any) => String(t).startsWith("mode:"))
                  : [];
                if (modeTags.length > 0) {
                  const modeTag = String(modeTags[0]).replace("mode:", "");
                  if (modeTag === "single_lot") modePrefix = "bundle";
                  else if (modeTag === "per_item") modePrefix = "peritem";
                  else if (modeTag === "per_photo") modePrefix = "perphoto";
                }
              } else {
                // For single mode reports, use the main grouping mode
                if (groupingMode === "single_lot") modePrefix = "bundle";
                else if (groupingMode === "per_item") modePrefix = "peritem";
                else if (groupingMode === "per_photo") modePrefix = "perphoto";
                else if (groupingMode === "catalogue") modePrefix = "catalogue";
              }

              const lotImages: number[] = Array.isArray(lot?.image_indexes)
                ? lot.image_indexes
                : [];
              const extraLotImages: number[] = Array.isArray(
                (lot as any)?.extra_image_indexes
              )
                ? (lot as any).extra_image_indexes
                : [];
              const combinedIdxs: number[] = [...lotImages, ...extraLotImages];

              // For each image in this lot (including extras), create rename mapping with continuous index
              for (let i = 0; i < combinedIdxs.length; i++) {
                const globalIdx = combinedIdxs[i];
                if (globalIdx >= 0 && globalIdx < imageUrls.length) {
                  const oldUrl = imageUrls[globalIdx];
                  // Format: mode-lotNum.imageNum.jpg (e.g., "bundle-1.1.jpg", "peritem-2.1.jpg")
                  const newName = modePrefix
                    ? `${modePrefix}-${lotNum}.${i + 1}.jpg`
                    : `${lotNum}.${i + 1}.jpg`;
                  renameMap.push({
                    oldUrl,
                    newName,
                    lotNumber: lotNum,
                    imageIndexInLot: i + 1,
                    globalIndex: globalIdx,
                    modePrefix,
                  });
                }
              }
            }

            // Copy images to new names in R2 storage
            const timestamp = Date.now();
            const newImageUrls: string[] = [...imageUrls]; // Clone

            for (const info of renameMap) {
              try {
                // Download old image from R2
                const response = await fetch(info.oldUrl);
                if (!response.ok) {
                  console.warn(
                    `Failed to fetch image for rename: ${info.oldUrl}`
                  );
                  continue;
                }
                const buffer = Buffer.from(await response.arrayBuffer());

                // Upload with new lot-based name
                const newFileName = `uploads/asset/${timestamp}-${info.newName}`;
                await uploadBufferToR2(
                  buffer,
                  "image/jpeg",
                  process.env.R2_BUCKET_NAME!,
                  newFileName
                );
                const newUrl = `https://images.sellsnap.store/${newFileName}`;

                // Update imageUrls array at global index
                newImageUrls[info.globalIndex] = newUrl;

                console.log(
                  `Renamed image: ${info.oldUrl.split("/").pop()} -> ${info.newName}`
                );
              } catch (err) {
                console.error(
                  `Failed to rename image ${info.oldUrl} to ${info.newName}:`,
                  err
                );
              }
            }

            // Update imageUrls array
            imageUrls.length = 0;
            imageUrls.push(...newImageUrls);

            // Update all lots with new image URLs
            for (const lot of lots) {
              if (Array.isArray(lot?.image_indexes)) {
                // Update image_urls array
                lot.image_urls = lot.image_indexes
                  .map((idx: number) => imageUrls[idx])
                  .filter(Boolean);

                // Update single image_url (first image)
                if (lot.image_urls.length > 0) {
                  lot.image_url = lot.image_urls[0];
                }
              }
              // Update extra_image_urls if present
              if (Array.isArray((lot as any)?.extra_image_indexes)) {
                (lot as any).extra_image_urls = (lot as any).extra_image_indexes
                  .map((idx: number) => imageUrls[idx])
                  .filter(Boolean);
              }
              // Update catalogue items if present
              if (Array.isArray(lot?.items)) {
                for (const item of lot.items) {
                  if (typeof item?.image_index === "number") {
                    item.image_url = imageUrls[item.image_index];
                  }
                }
              }
            }

            console.log(
              `Successfully renamed ${renameMap.length} images based on lot numbers`
            );
          }
        );
      } catch (e) {
        console.error("Image renaming failed:", e);
      }
    }

    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

    // Process valuation comparison table if requested (multiple methods)
    let valuationData: any = undefined;
    const includeValuationTable = details?.include_valuation_table === true;
    const valuationMethods = Array.isArray(details?.valuation_methods)
      ? details.valuation_methods
      : [];

    if (includeValuationTable && valuationMethods.length > 0) {
      try {
        await withStep(
          "calculate_valuations",
          "Generating AI valuation comparison table",
          async () => {
            const { generateComparisonTableWithAI } = await import(
              "../service/assetValuationService.js"
            );

            // Calculate total FMV from all lots
            const totalFMV = lots.reduce((sum, lot) => {
              const valStr = String(lot.estimated_value || "0");
              const num = parseFloat(valStr.replace(/[^0-9.-]/g, ""));
              return sum + (isNaN(num) ? 0 : num);
            }, 0);

            if (totalFMV > 0) {
              // Get asset information for AI analysis
              const firstLot = lots[0];
              const assetTitle = firstLot?.title || "General Assets";
              const assetDescription = firstLot?.description || "";
              const assetCondition = firstLot?.condition || "Unknown";
              const industry = details?.industry || "General";

              // Generate comparison table with AI explanations for all selected methods
              valuationData = await generateComparisonTableWithAI(
                totalFMV,
                valuationMethods as any,
                assetTitle,
                assetDescription,
                assetCondition,
                industry
              );

              console.log(
                `Generated valuation comparison table with AI explanations for ${valuationMethods.length} methods, total FMV: $${totalFMV}`
              );
            } else {
              console.warn(
                "Total FMV is 0, skipping valuation table generation"
              );
            }
          }
        );
      } catch (error) {
        console.error("Valuation calculation failed:", error);
        // Continue without valuation data
      }
    }

    const newReport = new AssetReport({
      user: user.id,
      grouping_mode: groupingMode,
      imageUrls: imageUrls,
      lots,
      analysis,
      client_name: details?.client_name,
      effective_date: parseDate(details?.effective_date),
      appraisal_purpose: details?.appraisal_purpose,
      owner_name: details?.owner_name,
      appraiser: details?.appraiser || user?.name || undefined,
      appraisal_company: details?.appraisal_company,
      industry: details?.industry,
      inspection_date: parseDate(details?.inspection_date),
      contract_no: details?.contract_no,
      language: selectedLanguage,
      currency: selectedCurrency,
      include_valuation_table: includeValuationTable,
      valuation_methods: includeValuationTable ? valuationMethods : [],
      valuation_data: valuationData,
      prepared_for: details?.prepared_for,
      factors_age_condition: details?.factors_age_condition,
      factors_quality: details?.factors_quality,
      factors_analysis: details?.factors_analysis,
    });

    await withStep("save_report", "Persisting report to database", async () => {
      await newReport.save();
    });

    const reportObject = newReport.toObject();
    // Generate PDF, DOCX, and XLSX in parallel
    const [pdfBuffer, docxBuffer, xlsxBuffer] = await Promise.all([
      withStep("generate_pdf", "Generating PDF", async () => {
        const t0 = Date.now();
        console.log(
          `[AssetReportJob] PDF generation start for report ${newReport._id} at ${new Date(t0).toISOString()}`
        );
        const buf = await generateAssetPdfFromReport({
          ...reportObject,
          inspector_name: user?.name || "",
          user_email: user?.email || "",
          language: selectedLanguage,
        });
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] PDF generation finished in ${t1 - t0}ms for report ${newReport._id}`
        );
        return buf;
      }),
      withStep("generate_docx", "Generating DOCX", async () => {
        const t0 = Date.now();
        console.log(
          `[AssetReportJob] DOCX generation start for report ${newReport._id} at ${new Date(t0).toISOString()}`
        );
        let userCvUrl: string | undefined;
        let userCvFilename: string | undefined;
        try {
          const u = await User.findById(user.id).select("cvUrl cvFilename");
          userCvUrl = (u as any)?.cvUrl || undefined;
          userCvFilename = (u as any)?.cvFilename || undefined;
        } catch {}
        const buf = await generateAssetDocxFromReport({
          ...reportObject,
          inspector_name: user?.name || "",
          user_email: user?.email || "",
          user_cv_url: userCvUrl,
          user_cv_filename: userCvFilename,
          language: ((): "en" | "fr" | "es" => {
            const l = String(
              (reportObject as any)?.language || details?.language || ""
            ).toLowerCase();
            return l === "fr" || l === "es" ? (l as any) : "en";
          })(),
          ...(groupingMode === "combined" && analysis?.combined
            ? {
                grouping_mode: "combined",
                combined: (analysis as any).combined,
                combined_modes: Array.isArray((analysis as any).combined_modes)
                  ? (analysis as any).combined_modes
                  : undefined,
              }
            : {}),
        });
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] DOCX generation finished in ${t1 - t0}ms for report ${newReport._id}`
        );
        return buf;
      }),
      withStep("generate_xlsx", "Generating Excel", async () => {
        const t0 = Date.now();
        console.log(
          `[AssetReportJob] XLSX generation start for report ${newReport._id} at ${new Date(t0).toISOString()}`
        );
        const buf = await generateAssetXlsxFromReport({
          ...reportObject,
          inspector_name: user?.name || "",
          language:
            (reportObject as any)?.language || details?.language || "en",
        });
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] XLSX generation finished in ${t1 - t0}ms for report ${newReport._id}`
        );
        return buf;
      }),
    ]);

    const reportsDir = path.resolve(process.cwd(), "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    // Build filename base: asset-mixed-<contract>-<YYYYMMDD-HHMMSS>-<uniq>
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "-");
    const cnRaw = String(
      (reportObject as any)?.contract_no || details?.contract_no || "nocn"
    );
    const cn = sanitize(cnRaw.trim() || "nocn");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const uniq = Math.random().toString(36).slice(2, 8);
    const baseName = `asset-mixed-${cn}-${dtStr}-${uniq}`;

    const pdfFilename = `${baseName}.pdf`;
    const docxFilename = `${baseName}.docx`;
    const xlsxFilename = `${baseName}.xlsx`;
    const imagesFolderName = `${baseName}-images`;
    const imagesZipFilename = `${baseName}-images.zip`;

    const pdfPath = path.join(reportsDir, pdfFilename);
    const docxPath = path.join(reportsDir, docxFilename);
    const xlsxPath = path.join(reportsDir, xlsxFilename);
    const imagesDirPath = path.join(reportsDir, imagesFolderName);
    const imagesZipPath = path.join(reportsDir, imagesZipFilename);

    await Promise.all([
      withStep("save_pdf_file", "Saving PDF file", async () => {
        const t0 = Date.now();
        await fs.writeFile(pdfPath, pdfBuffer);
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] PDF saved to ${pdfPath} in ${t1 - t0}ms (size=${pdfBuffer.length} bytes)`
        );
      }),
      withStep("save_docx_file", "Saving DOCX file", async () => {
        const t0 = Date.now();
        await fs.writeFile(docxPath, docxBuffer);
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] DOCX saved to ${docxPath} in ${t1 - t0}ms (size=${docxBuffer.length} bytes)`
        );
      }),
      withStep("save_xlsx_file", "Saving XLSX file", async () => {
        const t0 = Date.now();
        await fs.writeFile(xlsxPath, xlsxBuffer);
        const t1 = Date.now();
        console.log(
          `[AssetReportJob] XLSX saved to ${xlsxPath} in ${t1 - t0}ms (size=${xlsxBuffer.length} bytes)`
        );
      }),
    ]);

    // Save original uploaded media (images + videos) into a folder and zip it
    await withStep(
      "save_images_folder",
      "Saving original images/videos to folder",
      async () => {
        await fs.mkdir(imagesDirPath, { recursive: true });
        const extFromMime = (m?: string) => {
          if (!m) return "";
          if (m.includes("jpeg")) return ".jpg";
          if (m.includes("png")) return ".png";
          if (m.includes("webp")) return ".webp";
          if (m.includes("heic")) return ".heic";
          if (m.includes("heif")) return ".heif";
          if (m.includes("gif")) return ".gif";
          if (m.includes("bmp")) return ".bmp";
          if (m.includes("tiff")) return ".tiff";
          // videos
          if (m.includes("mp4")) return ".mp4";
          if (m.includes("quicktime")) return ".mov";
          if (m.includes("webm")) return ".webm";
          if (m.includes("x-matroska")) return ".mkv";
          if (m.includes("x-msvideo")) return ".avi";
          if (m.includes("x-m4v")) return ".m4v";
          if (m.includes("3gpp")) return ".3gp";
          return "";
        };

        // Build lot-based name mapping with mode prefix: globalImageIndex -> lotBasedName (e.g., "bundle-1.1.jpg")
        const imageLotNames = new Map<number, string>();
        for (let lotIdx = 0; lotIdx < lots.length; lotIdx++) {
          const lot = lots[lotIdx];
          const lotNum = lot?.lot_number ?? lotIdx + 1;

          // Determine mode prefix (same logic as above)
          let modePrefix = "";
          if (groupingMode === "mixed" && lot?.sub_mode) {
            const subMode = String(lot.sub_mode).toLowerCase();
            if (subMode === "single_lot") modePrefix = "bundle";
            else if (subMode === "per_item") modePrefix = "peritem";
            else if (subMode === "per_photo") modePrefix = "perphoto";
          } else if (groupingMode === "combined") {
            const modeTags = Array.isArray(lot?.tags)
              ? lot.tags.filter((t: any) => String(t).startsWith("mode:"))
              : [];
            if (modeTags.length > 0) {
              const modeTag = String(modeTags[0]).replace("mode:", "");
              if (modeTag === "single_lot") modePrefix = "bundle";
              else if (modeTag === "per_item") modePrefix = "peritem";
              else if (modeTag === "per_photo") modePrefix = "perphoto";
            }
          } else {
            if (groupingMode === "single_lot") modePrefix = "bundle";
            else if (groupingMode === "per_item") modePrefix = "peritem";
            else if (groupingMode === "per_photo") modePrefix = "perphoto";
            else if (groupingMode === "catalogue") modePrefix = "catalogue";
          }

          const lotImages: number[] = Array.isArray(lot?.image_indexes)
            ? lot.image_indexes
            : [];
          const extraLotImages: number[] = Array.isArray(
            (lot as any)?.extra_image_indexes
          )
            ? (lot as any).extra_image_indexes
            : [];
          const combinedIdxs: number[] = [...lotImages, ...extraLotImages];

          for (let i = 0; i < combinedIdxs.length; i++) {
            const globalIdx = combinedIdxs[i];
            const fileName = modePrefix
              ? `${modePrefix}-${lotNum}.${i + 1}.jpg`
              : `${lotNum}.${i + 1}.jpg`;
            imageLotNames.set(globalIdx, fileName);
          }
        }

        // Save images with lot-based names (processed with logo, <=1MB)
        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          // Use lot-based name if available, otherwise fallback to sequential
          const lotBasedName = imageLotNames.get(i);
          const finalName =
            lotBasedName || `image-${String(i + 1).padStart(3, "0")}.jpg`;
          const filePath = path.join(imagesDirPath, finalName);

          // Resolve input buffer
          const anyFile = file as any;
          let inputBuffer: Buffer | null = null;
          if (anyFile?.buffer && Buffer.isBuffer(anyFile.buffer)) {
            inputBuffer = anyFile.buffer as Buffer;
          } else if (typeof anyFile?.path === "string") {
            try {
              inputBuffer = await fs.readFile(anyFile.path);
            } catch {}
          }

          if (inputBuffer) {
            try {
              const { buffer } = await processImageWithLogo(
                inputBuffer,
                "public/logoNobg.png",
                { maxBytes: 1024 * 1024 }
              );
              // Use lot-based name
              await fs.writeFile(filePath, buffer);
              continue;
            } catch {}
          }
          // Fallback: write original file with lot-based name
          await fs.writeFile(filePath, file.buffer);
        }
        // Save videos with sanitized names
        const sanitize = (name: string) =>
          name.replace(/[^a-zA-Z0-9._-]/g, "_");
        for (let i = 0; i < videos.length; i++) {
          const file = videos[i];
          const orig = file.originalname || "";
          const fallback = `video-${String(i + 1).padStart(3, "0")}`;
          const ext =
            path.extname(orig) || extFromMime((file as any)?.mimetype) || "";
          const base = sanitize(
            (orig && orig.split("/").pop()!) || fallback + ext
          );
          const filePath = path.join(imagesDirPath, base);
          await fs.writeFile(filePath, file.buffer);
        }
      }
    );

    await withStep("zip_images", "Zipping media folder", async () => {
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(imagesZipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => resolve());
        archive.on("error", (err: any) => reject(err));
        archive.pipe(output);
        archive.directory(imagesDirPath, false);
        archive.finalize();
      });
      console.log(`[AssetReportJob] Media zipped to ${imagesZipPath}`);
    });

    const parseEstimated = (val: unknown): number => {
      if (!val) return 0;
      let s = String(val).trim();
      s = s.replace(/[\u2012\u2013\u2014\u2212]/g, "-");
      const matches = s.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g);
      if (!matches) return 0;
      const nums = matches
        .map((m) => parseFloat(m.replace(/,/g, "")))
        .filter((n) => Number.isFinite(n) && n >= 0);
      if (nums.length === 0) return 0;
      if (nums.length >= 2) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        return (min + max) / 2;
      }
      return nums[0];
    };

    const totalValue = (lots || []).reduce(
      (sum: number, lot: any) => sum + parseEstimated(lot?.estimated_value),
      0
    );
    const fairMarketValue =
      totalValue > 0
        ? `${selectedCurrency} ${Math.round(totalValue).toLocaleString("en-CA")}`
        : "N/A";

    // Create approval records (pending by default)
    const cnLabel = String(
      (reportObject as any)?.contract_no || details?.contract_no || ""
    ).trim();
    const displayAddress = cnLabel ? `Asset - ${cnLabel}` : `Asset`;
    const pdfRec = new PdfReport({
      filename: pdfFilename,
      fileType: "pdf",
      filePath: path.join("reports", pdfFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: displayAddress,
      fairMarketValue,
      contract_no:
        (reportObject as any)?.contract_no || details?.contract_no || "",
      valuation_methods: (reportObject as any)?.valuation_methods,
      valuation_data: (reportObject as any)?.valuation_data,
    });
    const docxRec = new PdfReport({
      filename: docxFilename,
      fileType: "docx",
      filePath: path.join("reports", docxFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: displayAddress,
      fairMarketValue,
      contract_no:
        (reportObject as any)?.contract_no || details?.contract_no || "",
      valuation_methods: (reportObject as any)?.valuation_methods,
      valuation_data: (reportObject as any)?.valuation_data,
    });
    const xlsxRec = new PdfReport({
      filename: xlsxFilename,
      fileType: "xlsx",
      filePath: path.join("reports", xlsxFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: displayAddress,
      fairMarketValue,
      contract_no:
        (reportObject as any)?.contract_no || details?.contract_no || "",
      valuation_methods: (reportObject as any)?.valuation_methods,
      valuation_data: (reportObject as any)?.valuation_data,
    });
    const imagesRec = new PdfReport({
      filename: imagesZipFilename,
      fileType: "images",
      filePath: path.join("reports", imagesZipFilename),
      imagesFolderPath: path.join("reports", imagesFolderName),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: displayAddress,
      fairMarketValue,
      contract_no:
        (reportObject as any)?.contract_no || details?.contract_no || "",
      valuation_methods: (reportObject as any)?.valuation_methods,
      valuation_data: (reportObject as any)?.valuation_data,
    });
    await Promise.all([
      withStep(
        "create_pdf_record",
        "Creating PDF record (pending approval)",
        async () => {
          await pdfRec.save();
        }
      ),
      withStep(
        "create_docx_record",
        "Creating DOCX record (pending approval)",
        async () => {
          await docxRec.save();
        }
      ),
      withStep(
        "create_xlsx_record",
        "Creating XLSX record (pending approval)",
        async () => {
          await xlsxRec.save();
        }
      ),
      withStep(
        "create_images_record",
        "Creating IMAGES record (pending approval)",
        async () => {
          await imagesRec.save();
        }
      ),
    ]);

    if (progressId) {
      setServerProg01(1);
      endProgress(progressId, true, "Completed");
    }

    // Send notification email (submitted for approval)
    const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
    const subject = "Your Asset reports were submitted for approval";
    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Asset Reports Submitted</h2>
        <p>Hello${user?.name ? ` ${user.name}` : ""},</p>
        <p>Your Asset report outputs (PDF, DOCX, Excel, and Images ZIP) have been generated and submitted for admin approval.</p>
        <ul>
          <li>PDF: ${pdfFilename}</li>
          <li>DOCX: ${docxFilename}</li>
          <li>Excel: ${xlsxFilename}</li>
          <li>Images ZIP: ${imagesZipFilename}</li>
        </ul>
        <p>You will receive an email when your reports are approved and ready to download.</p>
        <p><a href="${webUrl}/reports" style="display:inline-block;background:#e11d48;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Go to Reports</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        <p style="font-size:12px;color:#777">ClearValue</p>
      </div>
    `;
    try {
      if (user?.email) {
        await sendEmail(user.email, subject, html);
      }
    } catch (e) {
      console.error("Failed to send completion email:", e);
    }
  } catch (error) {
    console.error("Error processing asset data (bg job):", error);
    if (progressId) endProgress(progressId, false, "Error processing request");
  }
}

/**
 * Helper function to generate a ZIP buffer from image URLs with optional rename map
 */
export async function generateImagesZip(
  imageUrls: string[],
  renameMap?: Record<string, string>
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const archive = archiver("zip", { zlib: { level: 9 } });

      // Collect data chunks
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", (err: any) => reject(err));

      // Track used names to avoid duplicates
      const used = new Set<string>();

      // Download and add each image to the archive
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        try {
          const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
          });
          const imageBuffer = Buffer.from(response.data as ArrayBuffer);

          // Pick filename: prefer mapped name, else derive from URL
          let desired = renameMap?.[imageUrl];
          if (!desired || typeof desired !== "string") {
            const clean = imageUrl.split("?")[0];
            const urlParts = clean.split("/");
            const last = urlParts[urlParts.length - 1] || `image-${i + 1}.jpg`;
            desired = last || `image-${i + 1}.jpg`;
          }
          // Ensure unique within archive
          let filename = desired;
          if (used.has(filename)) {
            const base = filename.replace(/\.[^.]+$/, "");
            const ext = (filename.match(/\.[^.]+$/) || [".jpg"])[0];
            let k = 2;
            while (used.has(`${base} (${k})${ext}`)) k++;
            filename = `${base} (${k})${ext}`;
          }
          used.add(filename);

          archive.append(imageBuffer, { name: filename });
        } catch (err) {
          console.error(
            `[generateImagesZip] Failed to download image ${imageUrl}:`,
            err
          );
          // Continue with other images even if one fails
        }
      }

      // Finalize the archive
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * NEW PREVIEW WORKFLOW: Process images, extract data, store in preview_data
 * Does NOT generate DOCX - that happens after admin approval
 */
export async function runAssetPreviewJob({
  user,
  images,
  videos = [],
  details,
  progressId,
}: AssetJobInput) {
  try {
    if (progressId) startProgress(progressId);

    // Phase 1: Upload images to R2
    console.log(
      `[PreviewJob] Uploading ${images.length} images for user ${user.id}`
    );

    const uploadedImageUrls: string[] = await (async () => {
      const concurrency = 6;
      const out: string[] = new Array(images.length);
      let idx = 0;
      async function uploadOne(i: number) {
        const img = images[i] as any;
        if (!img) return;
        const sanitizedName = String(img.originalname || `image-${i + 1}.jpg`)
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/--+/g, "-")
          .replace(/^-|-$/g, "");
        const safeBase = sanitizedName.replace(/\.[^./\\]+$/, "");
        const jpgFile = `uploads/asset/${Date.now()}-${i + 1}-${safeBase}.jpg`;
        try {
          const { buffer } = await processImageWithLogo(
            img.buffer,
            "public/logoNobg.png",
            { maxBytes: 1024 * 1024 }
          );
          await uploadBufferToR2(
            buffer,
            "image/jpeg",
            process.env.R2_BUCKET_NAME!,
            jpgFile
          );
          out[i] = `https://images.sellsnap.store/${jpgFile}`;
        } catch (e) {
          // Fallback: upload original buffer as-is
          const fallbackName = `uploads/asset/${Date.now()}-${i + 1}-${sanitizedName}`;
          await uploadBufferToR2(
            img.buffer,
            img.mimetype || "image/jpeg",
            process.env.R2_BUCKET_NAME!,
            fallbackName
          );
          out[i] = `https://images.sellsnap.store/${fallbackName}`;
        }
      }
      const workers: Promise<void>[] = [];
      for (let w = 0; w < Math.min(concurrency, images.length); w++) {
        workers.push(
          (async function run() {
            while (true) {
              const i = idx++;
              if (i >= images.length) break;
              await uploadOne(i);
            }
          })()
        );
      }
      await Promise.all(workers);
      return out.filter(Boolean);
    })();

    // Phase 2: AI Processing
    console.log(`[PreviewJob] Starting AI analysis`);
    const groupingMode: AssetGroupingMode =
      (details.grouping_mode as any) || "mixed";
    const selectedLanguage = details.language || "en";
    const selectedCurrency = details.currency || "CAD";
    let lots: any[] = [];
    let analysis: any = null;
    const imageUrls = uploadedImageUrls;

    if (groupingMode === "mixed") {
      type MixedMap = {
        count: number;
        extraCount: number;
        cover_index?: number;
        mode: "single_lot" | "per_item" | "per_photo";
      };
      const rawLots: any[] = Array.isArray(details?.mixed_lots)
        ? details.mixed_lots
        : [];
      const mappings: MixedMap[] = rawLots
        .map((x: any) => {
          const m = String(x?.mode || "").trim();
          const mode =
            m === "per_item" || m === "per_photo" || m === "single_lot"
              ? (m as any)
              : undefined;
          return {
            count: Math.max(0, parseInt(String(x?.count ?? 0), 10) || 0),
            extraCount: Math.max(
              0,
              parseInt(String(x?.extra_count ?? 0), 10) || 0
            ),
            cover_index:
              typeof x?.cover_index === "number"
                ? x.cover_index
                : typeof x?.coverIndex === "number"
                  ? x.coverIndex
                  : 0,
            mode,
          } as MixedMap;
        })
        .filter(
          (m: MixedMap) => Number.isFinite(m.count) && m.count > 0 && !!m.mode
        );

      // Clamp to total images
      const totalImages = imageUrls.length;
      let useMappings: MixedMap[] = [...mappings];
      let sum = useMappings.reduce((s, m) => s + m.count, 0);
      let overflow = Math.max(0, sum - totalImages);
      while (overflow > 0 && useMappings.length) {
        const last = useMappings[useMappings.length - 1];
        const reduceBy = Math.min(overflow, last.count);
        last.count -= reduceBy;
        overflow -= reduceBy;
        if (last.count <= 0) useMappings.pop();
      }

      let base = 0;
      let lotCounter = 0;
      const mixedTrace: any[] = [];
      for (let lotIdx = 0; lotIdx < useMappings.length; lotIdx++) {
        const {
          count,
          extraCount,
          cover_index,
          mode: subMode,
        } = useMappings[lotIdx];
        const end = Math.min(imageUrls.length, base + Math.max(0, count));
        const extraEnd = Math.min(
          imageUrls.length,
          end + Math.max(0, extraCount)
        );
        const aiEnd = Math.min(end, base + Math.max(0, Math.min(30, count)));
        const aiLocalIdxs = Array.from(
          { length: Math.max(0, aiEnd - base) },
          (_, i) => base + i
        );
        const subUrls = aiLocalIdxs.map((i) => imageUrls[i]);
        const extraImageIdxs = Array.from(
          { length: Math.max(0, extraEnd - end) },
          (_, i) => end + i
        );
        const extraImageUrls = extraImageIdxs
          .map((i) => imageUrls[i])
          .filter(Boolean);
        if (subUrls.length === 0 || !subMode) {
          base = extraEnd;
          continue;
        }
        try {
          const aiRes = await analyzeAssetImages(
            subUrls,
            subMode,
            selectedLanguage,
            selectedCurrency
          );
          if (!analysis) analysis = { mixed: [] };
          if (!Array.isArray(analysis.mixed)) analysis.mixed = [];
          mixedTrace.push({ mode: subMode, result: aiRes });
          const lotResults = Array.isArray(aiRes?.lots) ? aiRes.lots : [];
          for (const lot of lotResults as any[]) {
            const localIdxs: number[] = Array.isArray(lot?.image_indexes)
              ? Array.from(
                  new Set<number>(
                    (lot.image_indexes as any[])
                      .map((n: any) => parseInt(String(n), 10))
                      .filter(
                        (n: number) =>
                          Number.isFinite(n) && n >= 0 && n < aiLocalIdxs.length
                      )
                  )
                )
              : [];
            const mappedIdxs: number[] = localIdxs.map((li) => aiLocalIdxs[li]);
            const directUrl: string | undefined =
              typeof lot?.image_url === "string" && lot.image_url
                ? lot.image_url
                : undefined;
            if (directUrl) {
              const gi = imageUrls.indexOf(directUrl);
              if (gi >= 0) mappedIdxs.push(gi);
            }
            const idxs = Array.from(new Set(mappedIdxs)).filter(
              (n) => Number.isFinite(n) && n >= 0 && n < imageUrls.length
            );
            const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);
            const coverLocal = Math.max(
              0,
              Math.min(
                Math.max(0, count) - 1,
                typeof cover_index === "number" ? cover_index : 0
              )
            );
            const coverGlobal = base + coverLocal;
            const coverUrl = imageUrls[coverGlobal];
            const urlsSet = new Set<string>([
              ...urlsFromIdx,
              ...(coverUrl ? [coverUrl] : []),
            ]);
            const urls = Array.from(urlsSet);
            // For per_photo, split into one lot per image index
            if (subMode === "per_photo" && idxs.length > 0) {
              for (const idx of idxs) {
                const photoUrl = imageUrls[idx];
                lotCounter += 1;
                const splitLotId = `lot-${String(lotCounter).padStart(3, "0")}`;
                const out = {
                  ...lot,
                  lot_id: splitLotId,
                  image_url: photoUrl,
                  image_indexes: [idx],
                  image_urls: [photoUrl],
                  extra_image_indexes: [],
                  extra_image_urls: [],
                  tags: Array.isArray(lot?.tags)
                    ? Array.from(
                        new Set([
                          ...(lot.tags as any[]).map(String),
                          `mode:${subMode}`,
                        ])
                      )
                    : [`mode:${subMode}`],
                  mixed_group_index: lotIdx + 1,
                  sub_mode: subMode,
                } as any;
                lots.push(out);
              }
            } else {
              lotCounter += 1;
              const uniqueLotId = `lot-${String(lotCounter).padStart(3, "0")}`;
              const primaryIdx =
                Array.isArray(idxs) && idxs.length ? idxs[0] : undefined;
              const primaryFromIdx =
                primaryIdx != null ? imageUrls[primaryIdx] : undefined;
              const primaryUrl =
                directUrl || primaryFromIdx || urls[0] || coverUrl || undefined;
              const out = {
                ...lot,
                lot_id: uniqueLotId,
                image_url:
                  subMode === "per_item"
                    ? primaryUrl
                    : coverUrl || directUrl || urls[0] || undefined,
                image_indexes:
                  subMode === "per_item"
                    ? ((): number[] => {
                        if (primaryIdx != null && Number.isFinite(primaryIdx))
                          return [primaryIdx];
                        if (directUrl) {
                          const gi = imageUrls.indexOf(directUrl);
                          if (gi >= 0) return [gi];
                        }
                        return [];
                      })()
                    : idxs,
                image_urls:
                  subMode === "per_item"
                    ? primaryUrl
                      ? [primaryUrl]
                      : []
                    : urls,
                extra_image_indexes: extraImageIdxs,
                extra_image_urls: extraImageUrls,
                tags: Array.isArray(lot?.tags)
                  ? Array.from(
                      new Set([
                        ...(lot.tags as any[]).map(String),
                        `mode:${subMode}`,
                      ])
                    )
                  : [`mode:${subMode}`],
                mixed_group_index: lotIdx + 1,
                sub_mode: subMode,
              } as any;
              lots.push(out);
            }
          }
        } catch (e) {
          console.error(
            `[PreviewJob] AI analysis failed for mixed lot #${lotIdx + 1} (${subMode}):`,
            e
          );
        }
        base = extraEnd;
      }
      analysis = { ...(analysis || {}), mixed: mixedTrace };
    } else if (groupingMode === "combined") {
      const urlsForAI = imageUrls.slice(0, 50);
      if (urlsForAI.length > 0) {
        try {
          const perItemRes = await analyzeAssetImages(
            urlsForAI,
            "per_item",
            selectedLanguage,
            selectedCurrency
          );
          analysis = perItemRes;
          const perItemLots: any[] = (perItemRes?.lots || []).map(
            (lot: any) => {
              const firstIdx =
                Array.isArray(lot?.image_indexes) && lot.image_indexes.length
                  ? lot.image_indexes[0]
                  : undefined;
              return {
                ...lot,
                image_index: Number.isFinite(firstIdx) ? firstIdx : undefined,
              };
            }
          );
          const perPhotoLots: any[] = [];
          for (let i = 0; i < imageUrls.length; i++) {
            const match = perItemLots.find(
              (l: any) =>
                Array.isArray(l?.image_indexes) && l.image_indexes.includes(i)
            );
            if (match) perPhotoLots.push({ ...match, image_index: i });
          }
          lots = perItemLots;
          (analysis as any).combined = {
            per_item: perItemLots,
            per_photo: perPhotoLots,
            single_lot: perItemLots,
          };
          (analysis as any).combined_modes = [
            "single_lot",
            "per_item",
            "per_photo",
          ];
        } catch (e) {
          console.error("[PreviewJob] Error during combined AI analysis:", e);
        }
      }
    } else {
      const urlsForAI = imageUrls.slice(0, 10);
      if (urlsForAI.length > 0) {
        try {
          const baseRes = await analyzeAssetImages(
            urlsForAI,
            groupingMode,
            selectedLanguage,
            selectedCurrency
          );
          analysis = baseRes;
          lots = (baseRes?.lots || []).map((lot: any) => {
            const total = imageUrls.length;
            const idxs: number[] = Array.isArray(lot?.image_indexes)
              ? Array.from(
                  new Set<number>(
                    (lot.image_indexes as any[])
                      .map((n: any) => parseInt(String(n), 10))
                      .filter(
                        (n: number) => Number.isFinite(n) && n >= 0 && n < total
                      )
                  )
                )
              : [];
            const directUrl: string | undefined =
              typeof lot?.image_url === "string" && lot.image_url
                ? lot.image_url
                : undefined;
            if (groupingMode === "per_item" && directUrl) {
              const inferred = imageUrls.indexOf(directUrl);
              if (inferred >= 0) {
                if (idxs.length === 0 || idxs[0] !== inferred)
                  idxs.splice(0, idxs.length, inferred);
              }
            }
            if (idxs.length === 0 && directUrl) {
              const inferred = imageUrls.indexOf(directUrl);
              if (inferred >= 0) idxs.push(inferred);
            }
            let urls: string[] = [];
            if (groupingMode === "per_item") {
              const primaryUrl =
                directUrl || (idxs[0] != null ? imageUrls[idxs[0]] : undefined);
              urls = primaryUrl ? [primaryUrl] : [];
            } else {
              const urlsSet = new Set<string>([
                ...idxs.map((i) => imageUrls[i]).filter(Boolean),
                ...(directUrl ? [directUrl] : []),
              ]);
              urls = Array.from(urlsSet);
            }
            return { ...lot, image_indexes: idxs, image_urls: urls };
          });
        } catch (e) {
          console.error("[PreviewJob] Error during asset AI analysis:", e);
        }
      }
    }

    // Enrich with VIN data if applicable
    if (Array.isArray(lots) && lots.length) {
      try {
        await enrichLotsWithVin(lots);
      } catch (e) {
        console.error("[PreviewJob] VIN enrichment failed:", e);
      }
    }

    // Phase 3: Calculate valuation data if requested
    let valuationData = null;
    if (
      details.include_valuation_table &&
      details.valuation_methods?.length > 0
    ) {
      const { generateComparisonTableWithAI } = await import(
        "../service/assetValuationService.js"
      );

      // Calculate total FMV
      const totalFMV = (lots || []).reduce((sum, lot) => {
        const value = lot.estimated_value?.replace(/[^0-9.-]+/g, "") || "0";
        return sum + parseFloat(value);
      }, 0);

      valuationData = await generateComparisonTableWithAI(
        totalFMV,
        details.valuation_methods,
        (lots?.[0]?.title as any) || "Asset",
        (lots?.[0]?.description as any) || "",
        (lots?.[0]?.condition as any) || "Good",
        details.industry || "General"
      );
    }

    // Phase 4: Create AssetReport with preview_data
    const sumFromLots = (lots || []).reduce((sum: number, lot: any) => {
      const raw =
        typeof lot?.estimated_value === "string" ? lot.estimated_value : "";
      const num = parseFloat(String(raw).replace(/[^0-9.-]+/g, ""));
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    const newReport = new AssetReport({
      user: user.id,
      grouping_mode: details.grouping_mode || "mixed",
      imageUrls: uploadedImageUrls,
      lots,
      status: "preview", // NEW: Set to preview status
      prepared_for: details.prepared_for,
      factors_age_condition: details.factors_age_condition,
      factors_quality: details.factors_quality,
      factors_analysis: details.factors_analysis,
      preview_data: {
        lots,
        client_name: details.client_name,
        contract_no: details.contract_no,
        effective_date: details.effective_date,
        appraisal_purpose: details.appraisal_purpose,
        owner_name: details.owner_name,
        appraiser: details.appraiser,
        appraisal_company: details.appraisal_company,
        industry: details.industry,
        inspection_date: details.inspection_date,
        currency: details.currency || "CAD",
        language: details.language || "en",
        include_valuation_table: details.include_valuation_table,
        valuation_methods: details.valuation_methods,
        valuation_data: valuationData,
        // New cover + factors fields
        prepared_for: details.prepared_for,
        factors_age_condition: details.factors_age_condition,
        factors_quality: details.factors_quality,
        factors_analysis: details.factors_analysis,
        total_appraised_value: sumFromLots,
        total_value: sumFromLots,
        // Narrative fields (if provided by AI)
        ...(analysis && typeof analysis === "object"
          ? {
              market_overview: (analysis as any).market_overview,
              comparable_sales: (analysis as any).comparable_sales,
              valuation_explanation: (analysis as any).valuation_explanation,
              condition_notes: (analysis as any).condition_notes,
              recommendations: (analysis as any).recommendations,
            }
          : {}),
      },
      // Store original metadata
      client_name: details.client_name,
      effective_date: details.effective_date,
      appraisal_purpose: details.appraisal_purpose,
      owner_name: details.owner_name,
      appraiser: details.appraiser,
      appraisal_company: details.appraisal_company,
      industry: details.industry,
      currency: details.currency || "CAD",
      language: details.language || "en",
      include_valuation_table: details.include_valuation_table,
      valuation_methods: details.valuation_methods,
      valuation_data: valuationData,
      analysis,
    });

    await newReport.save();
    console.log(
      `[PreviewJob] Report saved with ID: ${newReport._id}, Status: preview`
    );

    // Phase 5 removed: Files are generated at submit-for-approval, not here.

    // Phase 6: Send "Preview Ready" email
    console.log(`[PreviewJob] Sending preview ready email to ${user.email}...`);
    try {
      const { sendPreviewReadyEmail } = await import(
        "../service/assetEmailService.js"
      );
      await sendPreviewReadyEmail(
        user.email,
        user.name || "User",
        String(newReport._id)
      );
      console.log(`📧 Preview ready email sent to ${user.email}`);
    } catch (emailError) {
      console.error(`[PreviewJob] Failed to send preview ready email:`, emailError);
      // Continue even if email fails - don't block the workflow
    }

    if (progressId) {
      endProgress(progressId, true, "Preview ready");
    }

    console.log(
      `[PreviewJob] Completed successfully for report ${newReport._id}`
    );
  } catch (error) {
    console.error("[PreviewJob] Error:", error);
    if (progressId) endProgress(progressId, false, "Error processing request");
    throw error;
  }
}

/**
 * Generate DOCX/PDF after admin approval
 */
export async function queueDocxGenerationJob(reportId: string) {
  setImmediate(() =>
    runDocxGenerationJob(reportId).catch((e) => {
      console.error("[DocxGenJob] Failed:", e);
    })
  );
}

export async function runDocxGenerationJob(reportId: string) {
  try {
    console.log(`\n⚠️  [DocxGenJob] CALLED FOR REPORT ${reportId}`);
    console.log(`📍 Call stack trace:`, new Error().stack);

    const report = await AssetReport.findById(reportId).populate("user");
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    console.log(`📊 [DocxGenJob] Report status: ${report.status}`);
    
    if (report.status !== "approved") {
      console.error(`❌ [DocxGenJob] REJECTED - Report ${reportId} status is '${report.status}', expected 'approved'`);
      throw new Error(
        `Report ${reportId} status is ${report.status}, expected 'approved'`
      );
    }
    
    console.log(`✅ [DocxGenJob] Status check passed, proceeding with file generation...`);

    const user = report.user as any;

    // Use preview_data (user-edited) for generation
    const reportData = {
      ...report.toObject(),
      ...report.preview_data, // Override with user-edited data
      inspector_name: user?.name || "",
      user_email: user?.email || "",
      user_cv_url: (user as any)?.cvUrl || (report as any)?.user_cv_url,
      user_cv_filename:
        (user as any)?.cvFilename || (report as any)?.user_cv_filename,
    };

    // Promote preview files - Download from R2 and save locally for user downloads
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📥 [DocxGenJob] PROMOTING PREVIEW FILES TO APPROVED STATUS`);
    console.log(`${"=".repeat(80)}`);
    
    const docxFilename = `asset-report-${reportId}.docx`;
    const xlsxFilename = `asset-report-${reportId}.xlsx`;
    const imagesZipFilename = `asset-report-images-${reportId}.zip`;
    const previewDocxUrl: string | undefined = (report as any)?.preview_files
      ?.docx;
    const previewXlsxUrl: string | undefined =
      (report as any)?.preview_files?.excel ||
      (report as any)?.preview_files?.xlsx;
    const previewImagesUrl: string | undefined = (report as any)?.preview_files
      ?.images;
    
    console.log(`🔗 Preview DOCX URL: ${previewDocxUrl || "MISSING!"}`);
    console.log(`🔗 Preview XLSX URL: ${previewXlsxUrl || "MISSING!"}`);
    console.log(`🔗 Preview Images URL: ${previewImagesUrl || "MISSING!"}`);
    
    if (!previewDocxUrl || !previewXlsxUrl || !previewImagesUrl) {
      throw new Error(
        `[DocxGenJob] Missing preview_files URLs for report ${reportId}`
      );
    }
    let docxBuffer: Buffer | undefined;
    let xlsxBuffer: Buffer | undefined;
    let imagesZipBuffer: Buffer | undefined;
    try {
      console.log(`\n⬇️ Downloading preview files from R2...`);
      const [docxRes, xlsxRes, imagesRes] = await Promise.all([
        axios.get(previewDocxUrl, { responseType: "arraybuffer" }),
        axios.get(previewXlsxUrl, { responseType: "arraybuffer" }),
        axios.get(previewImagesUrl, { responseType: "arraybuffer" }),
      ]);
      docxBuffer = Buffer.from(docxRes.data as ArrayBuffer);
      xlsxBuffer = Buffer.from(xlsxRes.data as ArrayBuffer);
      imagesZipBuffer = Buffer.from(imagesRes.data as ArrayBuffer);
      
      console.log(`✅ Downloaded DOCX: ${(docxBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`✅ Downloaded XLSX: ${(xlsxBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`✅ Downloaded Images: ${(imagesZipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      console.error(
        "❌ [DocxGenJob] Failed to download one or more preview files",
        e
      );
      throw e;
    }

    // Save local copies for user download API
    console.log(`\n💾 Saving files locally for user download API...`);
    const localDir = path.resolve(process.cwd(), "reports", String(user._id));
    try {
      await fs.mkdir(localDir, { recursive: true });
    } catch {}
    const localDocxPath = path.join(localDir, docxFilename);
    const localXlsxPath = path.join(localDir, xlsxFilename);
    const localImagesZipPath = path.join(localDir, imagesZipFilename);
    await Promise.all([
      fs.writeFile(localDocxPath, docxBuffer as Buffer),
      fs.writeFile(localXlsxPath, xlsxBuffer as Buffer),
      fs.writeFile(localImagesZipPath, imagesZipBuffer as Buffer),
    ]);
    
    console.log(`✅ Saved to local filesystem:`);
    console.log(`   📄 ${localDocxPath}`);
    console.log(`   📊 ${localXlsxPath}`);
    console.log(`   📦 ${localImagesZipPath}`);

    // Prepare common fields required by PdfReport schema
    const addressStr = String(
      (report as any)?.client_name ||
        (report as any)?.preview_data?.client_name ||
        "Asset Report"
    );
    const currency = String(
      (report as any)?.preview_data?.currency ||
        (report as any)?.currency ||
        "CAD"
    );
    const rawTotal =
      (report as any)?.preview_data?.total_value ??
      (report as any)?.preview_data?.total_appraised_value;
    const totalNum =
      typeof rawTotal === "number"
        ? rawTotal
        : parseFloat(String(rawTotal || "0").replace(/[^0-9.-]+/g, ""));
    const fairMarketValueStr = Number.isFinite(totalNum)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(totalNum)
      : currency;
    const contractNo =
      (report as any)?.contract_no ||
      (report as any)?.preview_data?.contract_no ||
      undefined;

    const docxRec = new PdfReport({
      user: user._id,
      report: reportId,
      reportType: "Asset",
      reportModel: "AssetReport",
      fileType: "docx",
      filePath: path.relative(process.cwd(), localDocxPath),
      filename: docxFilename,
      approvalStatus: "approved",
      address: addressStr,
      fairMarketValue: fairMarketValueStr,
      contract_no: contractNo,
      valuation_methods: (report as any)?.valuation_methods,
      valuation_data: (report as any)?.valuation_data,
    });

    const xlsxRec = new PdfReport({
      user: user._id,
      report: reportId,
      reportType: "Asset",
      reportModel: "AssetReport",
      fileType: "xlsx",
      filePath: path.relative(process.cwd(), localXlsxPath),
      filename: xlsxFilename,
      approvalStatus: "approved",
      address: addressStr,
      fairMarketValue: fairMarketValueStr,
      contract_no: contractNo,
      valuation_methods: (report as any)?.valuation_methods,
      valuation_data: (report as any)?.valuation_data,
    });

    const imagesRec = new PdfReport({
      user: user._id,
      report: reportId,
      reportType: "Asset",
      reportModel: "AssetReport",
      fileType: "images",
      filePath: path.relative(process.cwd(), localImagesZipPath),
      filename: imagesZipFilename,
      approvalStatus: "approved",
      address: addressStr,
      fairMarketValue: fairMarketValueStr,
      contract_no: contractNo,
      valuation_methods: (report as any)?.valuation_methods,
      valuation_data: (report as any)?.valuation_data,
    });

    await Promise.all([docxRec.save(), xlsxRec.save(), imagesRec.save()]);

    console.log(`[DocxGenJob] Completed successfully for report ${reportId}`);
  } catch (error) {
    console.error(`[DocxGenJob] Error for report ${reportId}:`, error);
    throw error;
  }
}
