import axios from "axios";
import { analyzePerItem } from "./assetOpenAIService/perItem.js";
import { analyzePerPhoto } from "./assetOpenAIService/perPhoto.js";
import { analyzeBundle } from "./assetOpenAIService/bundle.js";
import { deduplicateAssetLotsAI } from "./assetOpenAIService/duplicate.js";

export type AssetGroupingMode =
  | "single_lot"
  | "per_item"
  | "per_photo"
  | "catalogue";

export interface AssetLotAI {
  lot_id: string;
  title: string;
  description: string;
  condition: string;
  estimated_value: string;
  tags?: string[];
  // Excel-related fields
  lot_number?: string | number | null; // maps to "Lot #"
  quantity?: number | null; // default 1
  must_take?: boolean | null; // true/false
  contract_number?: string | null; // maps to "Contract #"
  categories?: string | null; // one of predefined list provided in system prompt
  show_on_website?: boolean | null; // true/false
  close_date?: string | null; // ISO date YYYY-MM-DD
  bid_increment?: number | null; // numeric amount (no currency symbol)
  location?: string | null; // free text location
  opening_bid?: number | null; // numeric amount (no currency symbol)
  latitude?: number | null;
  longitude?: number | null;
  item_condition?: string | null; // may mirror 'condition'
  // Optional fields used primarily for per_item mode
  serial_no_or_label?: string | null;
  details?: string;
  image_url?: string | null;
  image_indexes: number[]; // 0-based indexes
  // Optional nested items for catalogue mode
  items?: Array<{
    title: string;
    sn_vin: string;
    description: string;
    details: string;
    estimated_value: string;
    // Preferred per-item image reference relative to the provided images for this catalogue segment
    image_local_index?: number | null;
    // Optional direct URL if known by the model (rare when using base64)
    image_url?: string | null;
    // Excel-related fields for item rows as well
    lot_number?: string | number | null;
    quantity?: number | null;
    must_take?: boolean | null;
    contract_number?: string | null;
    categories?: string | null;
    show_on_website?: boolean | null;
    close_date?: string | null;
    bid_increment?: number | null;
    location?: string | null;
    opening_bid?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    item_condition?: string | null;
  }>;
}

function extractSerial(lot: any): string | null {
  const sv =
    (
      lot?.serial_no_or_label ||
      lot?.sn_vin ||
      lot?.serial_number ||
      ""
    ).trim?.() || "";
  if (!sv) return null;
  return sv;
}

export interface AssetAnalysisResult {
  lots: AssetLotAI[];
  summary?: string;
  language?: "en" | "fr" | "es";
  currency?: string;
}

export interface ExcelRow {
  lot_number?: string | number | null;
  description?: string | null;
  quantity?: number | null;
  must_take?: boolean | null;
  contract_number?: string | null;
  categories?: string | null;
  serial_number?: string | null; // 'VIN: <VIN>' or other SN; if unknown, omit
  show_on_website?: boolean | null;
  close_date?: string | null; // YYYY-MM-DD
  bid_increment?: number | null;
  location?: string | null;
  opening_bid?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  item_condition?: string | null;
}

async function imageUrlToBase64WithMime(
  url: string
): Promise<{ base64: string; mime: string }> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data as ArrayBuffer);
  const mimeHeader = String(response.headers?.["content-type"] || "").split(
    ";"
  )[0];
  const mime =
    mimeHeader && mimeHeader.startsWith("image/") ? mimeHeader : "image/jpeg";
  return { base64: buffer.toString("base64"), mime };
}

function addModeTag(lots: AssetLotAI[], mode: AssetGroupingMode): AssetLotAI[] {
  return (lots || []).map((lot) => {
    const tags = Array.isArray(lot.tags) ? [...lot.tags] : [];
    if (!tags.some((t) => typeof t === "string" && t.startsWith("mode:"))) {
      tags.push(`mode:${mode}`);
    }
    lot.tags = tags;
    return lot;
  });
}

function normalizePerItemLotsImageMapping(
  lots: AssetLotAI[],
  imageUrls: string[]
): AssetLotAI[] {
  if (!Array.isArray(lots)) return [] as any;
  const total = Array.isArray(imageUrls) ? imageUrls.length : 0;
  return lots.map((lot: any) => {
    const urlIdx =
      typeof lot?.image_url === "string" && lot.image_url
        ? imageUrls.indexOf(lot.image_url)
        : -1;
    let idxFromIndexes: number | undefined = undefined;
    if (Array.isArray(lot?.image_indexes) && lot.image_indexes.length > 0) {
      const n = parseInt(String(lot.image_indexes[0]), 10);
      if (Number.isFinite(n) && n >= 0 && n < total) idxFromIndexes = n;
    }
    const resolvedIdx = urlIdx >= 0 ? urlIdx : idxFromIndexes;
    if (resolvedIdx !== undefined) {
      lot.image_indexes = [resolvedIdx];
      lot.image_url = imageUrls[resolvedIdx] || lot.image_url;
    }
    // Ensure image_urls aligns to the primary URL for per_item display paths
    if (typeof lot?.image_url === "string" && lot.image_url) {
      lot.image_urls = [lot.image_url];
    } else if (Array.isArray(lot?.image_urls) && lot.image_urls.length > 0) {
      lot.image_urls = [lot.image_urls[0]];
    }
    return lot;
  });
}

export async function analyzeAssetImages(
  imageUrls: string[],
  groupingMode: AssetGroupingMode,
  language?: "en" | "fr" | "es",
  currency?: string
): Promise<AssetAnalysisResult> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const lang: "en" | "fr" | "es" = ((): any => {
    const l = String(language || "").toLowerCase();
    return l === "fr" || l === "es" ? l : "en";
  })();
  const ccy = ((): string => {
    const c = String(currency || "").toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : process.env.DEFAULT_CURRENCY || "CAD";
  })();
  // Modular handling by mode
  if (groupingMode === "per_item") {
    const { lots: rawLots } = await analyzePerItem(imageUrls, lang, ccy);

    if (!rawLots || rawLots.length === 0) {
      // Fallback to per_photo
      const fallback = await analyzePerPhoto(imageUrls, lang, ccy);
      const fallbackLots = addModeTag(
        Array.isArray(fallback.lots) ? fallback.lots : [],
        "per_photo"
      );
      return {
        lots: fallbackLots,
        summary: `${fallbackLots.length} items identified via fallback per_photo analysis of ${imageUrls.length} images.`,
        language: fallback.language || lang,
        currency: fallback.currency || ccy,
      };
    }

    if (process.env.DEBUG_PER_ITEM === "1") {
      try {
        const dbgList = (rawLots as any[]).map((l: any) => ({
          lot_id: l?.lot_id,
          title: typeof l?.title === "string" ? l.title : undefined,
          image_url: typeof l?.image_url === "string" ? l.image_url : undefined,
          image_indexes: Array.isArray(l?.image_indexes) ? l.image_indexes : [],
        }));
        console.log("[PerItemDebug][per_item:raw]", { count: dbgList.length, list: dbgList });
      } catch {}
    }

    // Deduplicate across images to remove the same physical item
    const dedupedLots = await deduplicateAssetLotsAI(imageUrls, rawLots as any);
    const finalLotsRaw =
      dedupedLots && dedupedLots.length > 0 ? dedupedLots : (rawLots as any);
    const normalized = normalizePerItemLotsImageMapping(finalLotsRaw as any, imageUrls);
    if (process.env.DEBUG_PER_ITEM === "1") {
      try {
        const dbgList = (normalized as any[]).map((l: any) => ({
          lot_id: l?.lot_id,
          title: typeof l?.title === "string" ? l.title : undefined,
          image_url: typeof l?.image_url === "string" ? l.image_url : undefined,
          image_indexes: Array.isArray(l?.image_indexes) ? l.image_indexes : [],
        }));
        console.log("[PerItemDebug][normalize:after]", { count: dbgList.length, list: dbgList });
      } catch {}
    }
    const finalLots = addModeTag(normalized as any, "per_item");
    return {
      lots: finalLots,
      summary: `${finalLots.length} unique items identified from ${imageUrls.length} images (per_item, deduped).`,
      language: lang,
      currency: ccy,
    };
  }

  if (groupingMode === "per_photo") {
    const res = await analyzePerPhoto(imageUrls, lang, ccy);
    const lotsTagged = addModeTag(
      Array.isArray(res.lots) ? res.lots : [],
      "per_photo"
    );
    return {
      lots: lotsTagged,
      summary: res.summary,
      language: res.language || lang,
      currency: res.currency || ccy,
    };
  }

  // Default handling for single_lot and catalogue
  const mode: any = groupingMode === "catalogue" ? "catalogue" : "single_lot";
  const bundleRes = await analyzeBundle(imageUrls, mode, lang, ccy);
  const lotsTagged = addModeTag(
    Array.isArray(bundleRes.lots) ? bundleRes.lots : [],
    mode
  );
  return {
    lots: lotsTagged,
    summary: bundleRes.summary,
    language: bundleRes.language || lang,
    currency: bundleRes.currency || ccy,
  };
}
