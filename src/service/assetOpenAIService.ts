import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";
import { getAssetSystemPrompt } from "../utils/assetPrompts.js";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo";

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
              image_url: { url },
            },
            {
              type: "text",
              text: `Original image URL: ${url}`,
            },
          ],
        },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-5",
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

    return {
      lots: combinedLots,
      summary: `${combinedLots.length} items identified from ${imageUrls.length} images (per item).`,
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
