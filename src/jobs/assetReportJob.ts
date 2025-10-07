import { uploadToR2 } from "../utils/r2Storage/r2Upload.js";
import AssetReport from "../models/asset.model.js";
import PdfReport from "../models/pdfReport.model.js";
import {
  analyzeAssetImages,
  type AssetAnalysisResult,
} from "../service/assetOpenAIService.js";
import { generateAssetDocxFromReport } from "../service/assetDocxService.js";
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
    r2_upload: 0.2,
    ai_analysis: 0.5,
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
    const selectedLanguage: 'en' | 'fr' | 'es' = ((): any => {
      const l = String(details?.language || '').toLowerCase();
      return (l === 'fr' || l === 'es') ? l : 'en';
    })();
    const selectedCurrency: string = ((): string => {
      const c = String(details?.currency || '').toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? c : 'CAD';
    })();
    if (images?.length) {
      startStep("r2_upload", "Uploading images to storage");
      const total = images.length;
      for (let idx = 0; idx < images.length; idx++) {
        const file = images[idx];
        const timestamp = Date.now();
        const fileName = `uploads/asset/${timestamp}-${file.originalname}`;
        await uploadToR2(file, process.env.R2_BUCKET_NAME!, fileName);
        const fileUrl = `https://images.sellsnap.store/${fileName}`;
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
          const aiRes = await analyzeAssetImages(subUrls, "catalogue", selectedLanguage, selectedCurrency);
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
        mode: "single_lot" | "per_item" | "per_photo" 
      };
      const rawLots: any[] = Array.isArray(details?.mixed_lots)
        ? details.mixed_lots
        : [];
      const mappings: MixedMap[] = rawLots
        .map((x: any) => {
          const m = String(x?.mode || "").trim();
          const mode = m === "per_item" || m === "per_photo" || m === "single_lot" ? (m as any) : undefined;
          return {
            count: Math.max(0, parseInt(String(x?.count ?? 0), 10) || 0),
            extraCount: Math.max(0, parseInt(String(x?.extra_count ?? 0), 10) || 0),
            cover_index:
              typeof x?.cover_index === "number"
                ? x.cover_index
                : typeof x?.coverIndex === "number"
                  ? x.coverIndex
                  : 0,
            mode,
          } as MixedMap;
        })
        .filter((m: MixedMap) => Number.isFinite(m.count) && m.count > 0 && !!m.mode);

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

      if (useMappings.length > 0) startStep("ai_analysis", "AI analysis of images (mixed)");
      let base = 0;
      let lotCounter = 0;
      for (let lotIdx = 0; lotIdx < useMappings.length; lotIdx++) {
        const { count, extraCount, cover_index, mode: subMode } = useMappings[lotIdx];
        const end = Math.min(imageUrls.length, base + Math.max(0, count));
        const extraEnd = Math.min(imageUrls.length, end + Math.max(0, extraCount));

        // For AI cost/perf: analyze up to 30 images per lot (main images only, not extra)
        const aiEnd = Math.min(end, base + Math.max(0, Math.min(30, count)));
        const aiLocalIdxs = Array.from({ length: Math.max(0, aiEnd - base) }, (_, i) => base + i);
        const subUrls = aiLocalIdxs.map((i) => imageUrls[i]);
        
        // Collect extra images (not sent to AI)
        const extraImageIdxs = Array.from({ length: Math.max(0, extraEnd - end) }, (_, i) => end + i);
        const extraImageUrls = extraImageIdxs.map((i) => imageUrls[i]).filter(Boolean);

        if (subUrls.length === 0 || !subMode) {
          base = extraEnd;
          continue;
        }

        try {
          const aiRes = await analyzeAssetImages(subUrls, subMode, selectedLanguage, selectedCurrency);
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
                      .filter((n: number) => Number.isFinite(n) && n >= 0 && n < aiLocalIdxs.length)
                  )
                )
              : [];
            const mappedIdxs: number[] = localIdxs.map((li) => aiLocalIdxs[li]);

            // Also include inferred global index from direct image_url when present
            const directUrl: string | undefined =
              typeof lot?.image_url === "string" && lot.image_url ? lot.image_url : undefined;
            if (directUrl) {
              const gi = imageUrls.indexOf(directUrl);
              if (gi >= 0) mappedIdxs.push(gi);
            }
            const idxs = Array.from(new Set(mappedIdxs)).filter(
              (n) => Number.isFinite(n) && n >= 0 && n < imageUrls.length
            );
            const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);

            // Determine cover image within this segment
            const coverLocal = Math.max(0, Math.min(Math.max(0, count) - 1, typeof cover_index === "number" ? cover_index : 0));
            const coverGlobal = base + coverLocal;
            const coverUrl = imageUrls[coverGlobal];

            const urlsSet = new Set<string>([...urlsFromIdx, ...(coverUrl ? [coverUrl] : [])]);
            const urls = Array.from(urlsSet);

            lotCounter += 1;
            const uniqueLotId = `lot-${String(lotCounter).padStart(3, "0")}`;

            lots.push({
              ...lot,
              lot_id: uniqueLotId,
              image_url: coverUrl || lot?.image_url || urls[0] || undefined,
              image_indexes: idxs,
              image_urls: urls,
              extra_image_indexes: extraImageIdxs,
              extra_image_urls: extraImageUrls,
              // For traceability, include sub-mode tag
              tags: Array.isArray(lot?.tags)
                ? Array.from(new Set([...(lot.tags as any[]).map(String), `mode:${subMode}`]))
                : [`mode:${subMode}`],
              mixed_group_index: lotIdx + 1,
              sub_mode: subMode,
            });
          }
        } catch (e) {
          console.error(`AI analysis failed for mixed lot #${lotIdx + 1} (${subMode}):`, e);
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
          startStep("ai_analysis", "AI analysis of images (combined -> per_item primary)");
          const perItemRes = await analyzeAssetImages(urlsForAI, "per_item", selectedLanguage, selectedCurrency);
          endStep("ai_analysis");
          analysis = perItemRes;
          // Normalize items to include a canonical image_index if available (first index)
          const perItemLots: any[] = (perItemRes?.lots || []).map((lot: any) => {
            const firstIdx = Array.isArray(lot?.image_indexes) && lot.image_indexes.length
              ? lot.image_indexes[0]
              : undefined;
            return {
              ...lot,
              image_index: Number.isFinite(firstIdx) ? firstIdx : undefined,
            };
          });

          // Derive per_photo: one row per original image index, mapping to the first per_item lot referencing that image index
          const perPhotoLots: any[] = [];
          for (let i = 0; i < imageUrls.length; i++) {
            const match = perItemLots.find((l: any) =>
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
          const selectedModes: ("single_lot" | "per_item" | "per_photo")[] = Array.from(
            new Set(
              rawModes
                .map((m) => {
                  const s = String(m);
                  return s === "per_lot" ? "per_photo" : s;
                })
                .filter((m) => m === "single_lot" || m === "per_item" || m === "per_photo")
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
          analysis = await analyzeAssetImages(urlsForAI, groupingMode, selectedLanguage, selectedCurrency);
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
        if (groupingMode === "per_photo" && idxs.length === 0 && imageUrls[idx])
          idxs.push(idx);
        const urlsFromIdx = idxs.map((i) => imageUrls[i]).filter(Boolean);
        const directUrl: string | undefined =
          typeof lot?.image_url === "string" && lot.image_url
            ? lot.image_url
            : undefined;
        if (idxs.length === 0 && directUrl) {
          const inferred = imageUrls.indexOf(directUrl);
          if (inferred >= 0) idxs.push(inferred);
        }
        const urlsSet = new Set<string>([
          ...urlsFromIdx,
          ...(directUrl ? [directUrl] : []),
        ]);
        const urls = Array.from(urlsSet);
        return { ...lot, image_indexes: idxs, image_urls: urls };
      });
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

    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

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
    });

    await withStep("save_report", "Persisting report to database", async () => {
      await newReport.save();
    });

    const reportObject = newReport.toObject();
    // Generate all outputs concurrently
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
        const buf = await generateAssetDocxFromReport({
          ...reportObject,
          inspector_name: user?.name || "",
          user_email: user?.email || "",
          language: ((): 'en' | 'fr' | 'es' => {
            const l = String((reportObject as any)?.language || details?.language || '').toLowerCase();
            return (l === 'fr' || l === 'es') ? (l as any) : 'en';
          })(),
          ...(groupingMode === "combined" && analysis?.combined
            ? {
                grouping_mode: "combined",
                combined: (analysis as any).combined,
                combined_modes:
                  Array.isArray((analysis as any).combined_modes)
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
          language: (reportObject as any)?.language || details?.language || 'en',
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
    const cnRaw = String((reportObject as any)?.contract_no || details?.contract_no || "nocn");
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
        const sanitize = (name: string) =>
          name.replace(/[^a-zA-Z0-9._-]/g, "_");
        // Save images
        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          const orig = file.originalname || "";
          const fallback = `image-${String(i + 1).padStart(3, "0")}`;
          const ext = path.extname(orig) || extFromMime((file as any)?.mimetype) || "";
          const base = sanitize((orig && orig.split("/").pop()!) || fallback + ext);
          const filePath = path.join(imagesDirPath, base);
          await fs.writeFile(filePath, file.buffer);
        }
        // Save videos
        for (let i = 0; i < videos.length; i++) {
          const file = videos[i];
          const orig = file.originalname || "";
          const fallback = `video-${String(i + 1).padStart(3, "0")}`;
          const ext = path.extname(orig) || extFromMime((file as any)?.mimetype) || "";
          const base = sanitize((orig && orig.split("/").pop()!) || fallback + ext);
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
    const pdfRec = new PdfReport({
      filename: pdfFilename,
      fileType: "pdf",
      filePath: path.join("reports", pdfFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: `Asset Report (${lots.length} lots)`,
      fairMarketValue,
      contract_no: (reportObject as any)?.contract_no || details?.contract_no || '',
    });
    const docxRec = new PdfReport({
      filename: docxFilename,
      fileType: "docx",
      filePath: path.join("reports", docxFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: `Asset Report (${lots.length} lots)`,
      fairMarketValue,
      contract_no: (reportObject as any)?.contract_no || details?.contract_no || '',
    });
    const xlsxRec = new PdfReport({
      filename: xlsxFilename,
      fileType: "xlsx",
      filePath: path.join("reports", xlsxFilename),
      user: user.id,
      report: newReport._id,
      reportType: "Asset",
      reportModel: "AssetReport",
      address: `Asset Report (${lots.length} lots)`,
      fairMarketValue,
      contract_no: (reportObject as any)?.contract_no || details?.contract_no || '',
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
      address: `Asset Report (${lots.length} lots) - Images`,
      fairMarketValue,
      contract_no: (reportObject as any)?.contract_no || details?.contract_no || '',
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
