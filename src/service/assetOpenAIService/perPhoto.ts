import axios from "axios";
import openai from "../../utils/openaiClient.js";
import { getAssetSystemPrompt } from "../../utils/assetPrompts.js";

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

export async function analyzePerPhoto(
  imageUrls: string[],
  language: "en" | "fr" | "es",
  currency: string
): Promise<{
  lots: any[];
  language?: "en" | "fr" | "es";
  currency?: string;
  summary?: string;
}> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { lots: [], language, currency };
  }
  const systemPrompt = getAssetSystemPrompt(
    "per_photo" as any,
    language,
    currency
  );
  const imgs = await Promise.all(imageUrls.map(imageUrlToBase64WithMime));

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Grouping mode: per_photo. Analyze these images and return valid JSON as instructed.`,
          },
          {
            type: "text",
            text: `Original image URLs (index -> URL):\n${imageUrls.map((u, idx) => `#${idx}: ${u}`).join("\n")}`,
          },
          {
            type: "text",
            text: `Annotation Priority (if red boxes/ROIs are present): If red-outline boxes are present, only identify and return the item within boxes for that image.`,
          },
          ...imgs.map(({ base64, mime }) => ({
            type: "image_url" as const,
            image_url: { url: `data:${mime};base64,${base64}` },
          })),
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) return { lots: [], language, currency };
  const parsed = JSON.parse(content) as {
    lots?: any[];
    language?: any;
    currency?: any;
    summary?: string;
  };
  const lots = Array.isArray(parsed?.lots) ? parsed.lots : [];
  return {
    lots,
    summary: parsed?.summary,
    language: (parsed?.language as any) || language,
    currency: (parsed?.currency as any) || currency,
  };
}
