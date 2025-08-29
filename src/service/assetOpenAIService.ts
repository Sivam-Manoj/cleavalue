import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";
import { getAssetSystemPrompt } from "../utils/assetPrompts.js";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo" | "catalogue";

export interface AssetLotAI {
  lot_id: string;
  title: string;
  description: string;
  condition: string;
  estimated_value: string;
  tags?: string[];
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
  }>;
}

export interface AssetAnalysisResult {
  lots: AssetLotAI[];
  summary?: string;
}

async function imageUrlToBase64(url: string): Promise<string> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data as ArrayBuffer);
  return buffer.toString("base64");
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
      model: "gpt-5-mini",
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

export async function analyzeAssetImages(
  imageUrls: string[],
  groupingMode: AssetGroupingMode
): Promise<AssetAnalysisResult> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const systemPrompt = getAssetSystemPrompt(groupingMode);

  // Special handling: per_item should analyze each image individually and include image_url
  if (groupingMode === "per_item") {
    const combinedLots: AssetLotAI[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      // Use base64 to ensure the model can always see the image content
      const b64 = await imageUrlToBase64(url);

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
              image_url: { url: `data:image/jpeg;base64,${b64}` },
            },
            {
              type: "text",
              text: `Original image URL: ${url}`,
            },
          ],
        },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
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
        const fallbackPrompt = getAssetSystemPrompt("per_photo");
        const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: fallbackPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Fallback invoked: per_item returned zero lots. Analyze these images per_photo (one lot per image).`,
              },
              ...base64Images.map((b64) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/jpeg;base64,${b64}` },
              })),
            ],
          },
        ];

        const resp = await openai.chat.completions.create({
          model: "gpt-5",
          messages,
          response_format: { type: "json_object" },
        });
        const content = resp.choices?.[0]?.message?.content?.trim();
        if (content) {
          const parsed = JSON.parse(content) as AssetAnalysisResult;
          const fallbackLots = Array.isArray(parsed?.lots) ? parsed.lots : [];
          return {
            lots: fallbackLots,
            summary: `${fallbackLots.length} items identified via fallback per_photo analysis of ${imageUrls.length} images.`,
          };
        }
      } catch (e) {
        console.error("Fallback per_photo analysis failed:", e);
      }
      // If fallback also fails, return empty
      return {
        lots: [],
        summary: `0 items identified (per_item), fallback failed.`,
      };
    }

    // Deduplicate across images to remove the same physical item
    const dedupedLots = await deduplicateAssetLotsAI(imageUrls, combinedLots);
    const finalLots = dedupedLots.length > 0 ? dedupedLots : combinedLots; // safeguard against over-aggressive dedup

    return {
      lots: finalLots,
      summary: `${finalLots.length} unique items identified from ${imageUrls.length} images (per_item, deduped).`,
    };
  }

  // Default handling for single_lot and per_photo: send all images together (base64 for consistency)
  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Grouping mode: ${groupingMode}. Analyze these images and return the JSON result.`,
        },
        ...base64Images.map((b64) => ({
          type: "image_url" as const,
          image_url: { url: `data:image/jpeg;base64,${b64}` },
        })),
      ],
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages,
    response_format: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");

  try {
    return JSON.parse(content) as AssetAnalysisResult;
  } catch (err) {
    console.error("Invalid JSON from model:", content);
    throw new Error("Failed to parse JSON from AI response.");
  }
}
