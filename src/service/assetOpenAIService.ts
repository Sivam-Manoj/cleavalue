import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo";

export interface AssetLotAI {
  lot_id: string;
  title: string;
  description: string;
  condition: string;
  estimated_value: string;
  tags?: string[];
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

  // Convert all image URLs to base64
  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const systemPrompt = `
  You are an expert inventory/loss appraisal assistant. Your job is to analyze provided images and group them into "lots" based on the grouping mode.
  
  Grouping modes:
  - single_lot: all images together as ONE lot.
  - per_item: detect unique items across ALL images, group same items together, list all image indexes for that item.
  - per_photo: each image is its own lot.
  
  Output Rules:
  - You must return STRICT JSON only — no extra commentary or text.
  - JSON must have this exact structure:
    {
      "lots": [
        {
          "lot_id": "string (unique ID for the lot, e.g., lot-001)",
          "title": "short but specific title",
          "description": "summary of key details",
          "condition": "string describing the item's condition (e.g., 'Used - Good', 'New', 'Damaged')",
          "estimated_value": "string in Canadian dollars, prefixed with CA$ (e.g., 'CA$150')",
          "tags": ["optional", "keywords"],
          "image_indexes": [array of integers starting at 0]
        }
      ],
      "summary": "string summarizing all lots"
    }
  - All fields except 'tags' are REQUIRED for each lot.
  - 'tags', if included, must be an array of strings.
  - 'estimated_value' must always be in Canadian dollars (CA$), even if estimated.
  - Titles must be concise yet descriptive.
  - 'image_indexes' must exactly match the provided images' order (0-based).
  - Keep lot count reasonable; merge duplicates in per_item mode.
  
  Example Output:
  {
    "lots": [
      {
        "lot_id": "lot-001",
        "title": "Red Mountain Bike",
        "description": "Adult-sized red mountain bike with front suspension and minor scratches.",
        "condition": "Used - Good",
        "estimated_value": "CA$150",
        "tags": ["bike", "red", "mountain"],
        "image_indexes": [0, 2]
      },
      {
        "lot_id": "lot-002",
        "title": "Wooden Dining Table",
        "description": "4-seater oak dining table with light wear on edges.",
        "condition": "Used - Fair",
        "estimated_value": "CA$150",
        "image_indexes": [1]
      }
    ],
    "summary": "2 lots identified: a red mountain bike and a wooden dining table."
  }
  `;

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
