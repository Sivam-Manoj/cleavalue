import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";
import { getAssetSystemPrompt } from "../utils/assetPrompts.js";

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
  const sv = (lot?.serial_no_or_label || lot?.sn_vin || lot?.serial_number || "").trim?.() || "";
  if (!sv) return null;
  return sv;
}

function buildExcelRowsFromLots(lots: AssetLotAI[], defaultContract?: string): ExcelRow[] {
  const rows: ExcelRow[] = [];
  for (const lot of lots || []) {
    const base: ExcelRow = {
      lot_number: (lot as any)?.lot_number ?? null,
      description: (lot as any)?.description ?? null,
      quantity: (lot as any)?.quantity ?? null,
      must_take: (lot as any)?.must_take ?? null,
      contract_number: (lot as any)?.contract_number ?? defaultContract ?? null,
      categories: (lot as any)?.categories ?? null,
      serial_number: extractSerial(lot),
      show_on_website: (lot as any)?.show_on_website ?? null,
      close_date: (lot as any)?.close_date ?? null,
      bid_increment: (lot as any)?.bid_increment ?? null,
      location: (lot as any)?.location ?? null,
      opening_bid: (lot as any)?.opening_bid ?? null,
      latitude: (lot as any)?.latitude ?? null,
      longitude: (lot as any)?.longitude ?? null,
      item_condition: (lot as any)?.item_condition ?? null,
    };
    rows.push(base);
    const items: any[] = Array.isArray((lot as any)?.items) ? (lot as any).items : [];
    for (const it of items) {
      rows.push({
        lot_number: (it as any)?.lot_number ?? (lot as any)?.lot_number ?? null,
        description: (it as any)?.description ?? (lot as any)?.description ?? null,
        quantity: (it as any)?.quantity ?? null,
        must_take: (it as any)?.must_take ?? (lot as any)?.must_take ?? null,
        contract_number: (it as any)?.contract_number ?? (lot as any)?.contract_number ?? defaultContract ?? null,
        categories: (it as any)?.categories ?? (lot as any)?.categories ?? null,
        serial_number: (it as any)?.serial_number ?? (it as any)?.sn_vin ?? extractSerial(it) ?? extractSerial(lot),
        show_on_website: (it as any)?.show_on_website ?? (lot as any)?.show_on_website ?? null,
        close_date: (it as any)?.close_date ?? (lot as any)?.close_date ?? null,
        bid_increment: (it as any)?.bid_increment ?? (lot as any)?.bid_increment ?? null,
        location: (it as any)?.location ?? (lot as any)?.location ?? null,
        opening_bid: (it as any)?.opening_bid ?? (lot as any)?.opening_bid ?? null,
        latitude: (it as any)?.latitude ?? (lot as any)?.latitude ?? null,
        longitude: (it as any)?.longitude ?? (lot as any)?.longitude ?? null,
        item_condition: (it as any)?.item_condition ?? (lot as any)?.item_condition ?? null,
      });
    }
  }
  return rows;
}

export interface AssetAnalysisResult {
  lots: AssetLotAI[];
  summary?: string;
  language?: "en" | "fr" | "es";
  currency?: string;
  excel_rows?: ExcelRow[];
  excel_rows_json?: { rows?: ExcelRow[] };
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

// Use OpenAI to deduplicate lots produced from per-image analysis.
// IMPORTANT: This function ONLY REMOVES duplicate items. It does NOT merge fields, does NOT edit image_indexes, and does NOT change image_url.
// It returns the same JSON structure { lots: AssetLotAI[] } with duplicates filtered out.
async function deduplicateAssetLotsAI(
  imageUrls: string[],
  lots: AssetLotAI[]
): Promise<AssetLotAI[]> {
  if (!Array.isArray(lots) || lots.length === 0) return [];

  const system =
    `You are an expert at deduplicating JSON records of physical assets described as 'lots'.\n\n` +
    `Goal: REMOVE duplicate records that represent the SAME physical item across multiple photos, and return JSON with the SAME SCHEMA.\n\n` +
    `Rules:\n` +
    `- Output strictly valid JSON: { "lots": AssetLot[] }. No extra commentary.\n` +
    `- AssetLot fields: lot_id (string), title (string), description (string), condition (string), estimated_value (string), tags (string[] optional), serial_no_or_label (string|null optional), details (string optional), image_url (string|null optional), image_indexes (number[]).\n` +
    `- Do NOT modify any fields of remaining lots. Do NOT edit image_indexes or image_url. Do NOT merge data across lots.\n` +
    `- Dedup heuristics: identical serial_no_or_label => same item; extremely similar titles + compatible details => likely same.\n` +
    `- When duplicates exist, keep a single representative (prefer one with non-null serial_no_or_label); discard the rest.\n` +
    `- Do not invent new lots. Do not discard genuinely distinct items.\n`;

  const user = {
    imageUrls,
    lots,
  } as const;

  // Example payloads to guide the model (remove-only dedup; no field edits)
  const exampleInput = `{
  "imageUrls": [
    "https://example.com/img-0.jpg",
    "https://example.com/img-1.jpg"
  ],
  "lots": [
    {
      "lot_id": "lot-001",
      "title": "Canon EOS 80D DSLR Camera Body",
      "description": "24MP DSLR camera body; light cosmetic wear.",
      "condition": "Used - Good",
      "estimated_value": "CA$520",
      "tags": ["camera", "dslr", "canon"],
      "serial_no_or_label": "SN: 12345678",
      "details": "Includes battery and strap; shutter count unknown.",
      "image_url": "https://example.com/img-0.jpg",
      "image_indexes": [0]
    },
    {
      "lot_id": "lot-002",
      "title": "Canon EOS 80D DSLR Camera Body",
      "description": "24MP DSLR; similar unit view.",
      "condition": "Used - Good",
      "estimated_value": "CA$520",
      "tags": ["camera", "dslr", "canon"],
      "serial_no_or_label": "SN: 12345678",
      "details": "Same serial as lot-001.",
      "image_url": "https://example.com/img-1.jpg",
      "image_indexes": [1]
    },
    {
      "lot_id": "lot-003",
      "title": "Canon EF-S 18-135mm Lens",
      "description": "Zoom lens; no visible damage.",
      "condition": "Used - Good",
      "estimated_value": "CA$180",
      "tags": ["lens", "canon", "18-135mm"],
      "serial_no_or_label": null,
      "details": "Optical stabilization; standard zoom range.",
      "image_url": "https://example.com/img-0.jpg",
      "image_indexes": [0]
    }
  ]
}`;

  const exampleOutput = `{
  "lots": [
    {
      "lot_id": "lot-001",
      "title": "Canon EOS 80D DSLR Camera Body",
      "description": "24MP DSLR camera body; light cosmetic wear.",
      "condition": "Used - Good",
      "estimated_value": "CA$520",
      "tags": ["camera", "dslr", "canon"],
      "serial_no_or_label": "SN: 12345678",
      "details": "Includes battery and strap; shutter count unknown.",
      "image_url": "https://example.com/img-0.jpg",
      "image_indexes": [0]
    },
    {
      "lot_id": "lot-003",
      "title": "Canon EF-S 18-135mm Lens",
      "description": "Zoom lens; no visible damage.",
      "condition": "Used - Good",
      "estimated_value": "CA$180",
      "tags": ["lens", "canon", "18-135mm"],
      "serial_no_or_label": null,
      "details": "Optical stabilization; standard zoom range.",
      "image_url": "https://example.com/img-0.jpg",
      "image_indexes": [0]
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here are the uploaded image URLs and the lots detected from each image individually. Deduplicate and return the same JSON shape.`,
            },
            {
              type: "text",
              text: `Example Input (with duplicates):`,
            },
            {
              type: "text",
              text: exampleInput,
            },
            {
              type: "text",
              text: `Example Output (duplicates removed; fields/indexes unchanged):`,
            },
            {
              type: "text",
              text: exampleOutput,
            },
            {
              type: "text",
              text: JSON.stringify(user),
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty response from AI dedupe");
    const parsed = JSON.parse(content) as AssetAnalysisResult;
    const resultLots = Array.isArray(parsed?.lots) ? parsed.lots : [];
    // Return as-is (no field/index modifications)
    return resultLots as AssetLotAI[];
  } catch (e) {
    // Fallback: simple heuristic dedupe by serial or (title+details), keeping the first representative intact
    const norm = (s?: string | null) =>
      (s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const out: AssetLotAI[] = [];
    const chosenBySerial = new Map<string, number>();
    const chosenByKey = new Map<string, number>();

    for (const lot of lots) {
      const serialKey = norm(lot.serial_no_or_label || undefined);
      const titleKey = norm(lot.title);
      const detailsKey = norm(lot.details || undefined);
      const key = `${titleKey}|${detailsKey}`;

      let existsIndex: number | undefined = undefined;
      if (serialKey) existsIndex = chosenBySerial.get(serialKey);
      if (existsIndex === undefined) existsIndex = chosenByKey.get(key);

      if (existsIndex === undefined) {
        chosenByKey.set(key, out.length);
        if (serialKey) chosenBySerial.set(serialKey, out.length);
        // push as-is (no modifications)
        out.push(lot);
      } else {
        // already kept a representative; skip this duplicate
      }
    }

    return out;
  }
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
  const systemPrompt = getAssetSystemPrompt(groupingMode as any, lang, ccy);

  // Special handling: per_item should analyze each image individually and include image_url
  if (groupingMode === "per_item") {
    const combinedLots: AssetLotAI[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      // Use base64 to ensure the model can always see the image content
      const { base64: b64, mime } = await imageUrlToBase64WithMime(url);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Grouping mode: per_item. Analyze THIS SINGLE IMAGE and return ALL distinct items visible as separate lots (do not collapse multiple items). If multiple identical units are visible, create separate lots and distinguish titles with "(#1)", "(#2)", etc. For each returned lot, include: (1) the exact original URL provided below in the 'image_url' field (do NOT fabricate), (2) the original image index ${i} in 'image_indexes' (and do NOT include any other index), and (3) 'serial_no_or_label' if visible else null, plus 'details' with concise attributes (color, material, size/dimensions, capacity, model/specs, inclusions/issues).`,
            },
            {
              type: "image_url" as const,
              image_url: { url: `data:${mime};base64,${b64}` },
            },
            {
              type: "text",
              text: `Original image URL: ${url}`,
            },
          ],
        },
      ];

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        messages,
        response_format: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content?.trim();
      if (!content) continue;

      try {
        const parsed = JSON.parse(content) as AssetAnalysisResult;
        const lots = Array.isArray(parsed?.lots) ? parsed.lots : [];

        for (const lot of lots as AssetLotAI[]) {
          // Ensure image index reflects the original index for this image-by-image run
          lot.image_indexes = [i];
          // Ensure image_url is present and accurate
          if (typeof lot.image_url !== "string" || !lot.image_url) {
            lot.image_url = url;
          }
          combinedLots.push(lot);
        }
      } catch (err) {
        console.error("Invalid JSON from model (per_item):", content);
        // Skip this image on parse failure
      }
    }

    // If nothing was extracted in per_item pass, fallback to a per_photo-style analysis (one lot per image)
    if (combinedLots.length === 0) {
      try {
        const fallbackPrompt = getAssetSystemPrompt("per_photo", lang, ccy);
        const imgs = await Promise.all(imageUrls.map(imageUrlToBase64WithMime));
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: fallbackPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Fallback invoked: per_item returned zero lots. Analyze these images per_photo (one lot per image).`,
              },
              {
                type: "text",
                text: `Original image URLs (index -> URL):\n${imageUrls
                  .map((u, idx) => `#${idx}: ${u}`)
                  .join("\n")}`,
              },
              ...imgs.map(({ base64, mime }) => ({
                type: "image_url" as const,
                image_url: { url: `data:${mime};base64,${base64}` },
              })),
            ],
          },
        ];

        const resp = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-5",
          messages,
          response_format: { type: "json_object" },
        });
        const content = resp.choices?.[0]?.message?.content?.trim();
        if (content) {
          const parsed = JSON.parse(content) as AssetAnalysisResult;
          const fallbackLots = addModeTag(Array.isArray(parsed?.lots) ? parsed.lots : [], 'per_photo');
          const excelRowsFromJson = (parsed as any)?.excel_rows_json?.rows;
          const excel_rows = Array.isArray(excelRowsFromJson) && excelRowsFromJson.length
            ? (excelRowsFromJson as ExcelRow[])
            : (Array.isArray((parsed as any)?.excel_rows) && (parsed as any).excel_rows.length
              ? ((parsed as any).excel_rows as ExcelRow[])
              : buildExcelRowsFromLots(fallbackLots, undefined));
          return {
            lots: fallbackLots,
            summary: `${fallbackLots.length} items identified via fallback per_photo analysis of ${imageUrls.length} images.`,
            language: parsed.language || lang,
            currency: parsed.currency || ccy,
            excel_rows,
          };
        }
      } catch (e) {
        console.error("Fallback per_photo analysis failed:", e);
      }
    }

    // Deduplicate across images to remove the same physical item
    const dedupedLots = await deduplicateAssetLotsAI(imageUrls, combinedLots);
    const finalLotsRaw = dedupedLots.length > 0 ? dedupedLots : combinedLots; // safeguard against over-aggressive dedup
    const finalLots = addModeTag(finalLotsRaw, 'per_item');
    const excel_rows = buildExcelRowsFromLots(finalLots, undefined);

    return {
      lots: finalLots,
      summary: `${finalLots.length} unique items identified from ${imageUrls.length} images (per_item, deduped).`,
      language: lang,
      currency: ccy,
      excel_rows,
    };
  }

  // Default handling for single_lot, per_photo, and catalogue: send all images together
  const imgs = await Promise.all(imageUrls.map(imageUrlToBase64WithMime));
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: `Grouping mode: ${groupingMode}. Analyze these images and return valid JSON as instructed.` },
        { type: "text", text: `Original image URLs (index -> URL):\n${imageUrls.map((u, idx) => `#${idx}: ${u}`).join("\n")}` },
        ...imgs.map(({ base64, mime }) => ({
          type: "image_url" as const,
          image_url: { url: `data:${mime};base64,${base64}` },
        })),
      ],
    },
  ];

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5",
    messages,
    response_format: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");

  try {
    console.log("content", content);
    const parsed = JSON.parse(content) as AssetAnalysisResult;
    const lotsTagged = addModeTag(Array.isArray(parsed?.lots) ? parsed.lots : [], groupingMode);
    const excelRowsFromJson = (parsed as any)?.excel_rows_json?.rows;
    const excel_rows = Array.isArray(excelRowsFromJson) && excelRowsFromJson.length
      ? (excelRowsFromJson as ExcelRow[])
      : (Array.isArray(parsed?.excel_rows) && parsed.excel_rows.length
        ? parsed.excel_rows
        : buildExcelRowsFromLots(lotsTagged, undefined));
    return { ...parsed, lots: lotsTagged, excel_rows, language: parsed.language || lang, currency: parsed.currency || ccy };
  } catch (err) {
    console.error("Invalid JSON from model:", content);
    throw new Error("Failed to parse JSON from AI response.");
  }
}
