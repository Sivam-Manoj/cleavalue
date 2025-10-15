import axios from "axios";
import openai from "../../utils/openaiClient.js";
import { getAssetSystemPrompt } from "../../utils/assetPrompts.js";

async function imageUrlToBase64WithMime(url: string): Promise<{ base64: string; mime: string }> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data as ArrayBuffer);
  const mimeHeader = String(response.headers?.["content-type"] || "").split(";")[0];
  const mime = mimeHeader && mimeHeader.startsWith("image/") ? mimeHeader : "image/jpeg";
  return { base64: buffer.toString("base64"), mime };
}

export async function analyzePerItem(
  imageUrls: string[],
  language: "en" | "fr" | "es",
  currency: string
): Promise<{ lots: any[]; language?: "en" | "fr" | "es"; currency?: string }> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { lots: [], language, currency };
  }
  const systemPrompt = getAssetSystemPrompt("per_item" as any, language, currency);
  const combinedLots: any[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const { base64, mime } = await imageUrlToBase64WithMime(url);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Grouping mode: per_item. Analyze THIS SINGLE IMAGE and return ALL distinct items visible as separate lots. ` +
                `For each returned lot, include: the exact original URL below in 'image_url', and the original image index ${i} in 'image_indexes' only. ` +
                `Include 'serial_no_or_label' if visible else null, and concise 'details' attributes.`,
            },
            { type: "image_url" as const, image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: `Original image URL: ${url}` },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as { lots?: any[] };
      const lots = Array.isArray(parsed?.lots) ? parsed.lots : [];
      if (process.env.DEBUG_PER_ITEM === "1") {
        console.log("[PerItemDebug][perItem:image]", { index: i, url, lotsCount: lots.length });
      }
      for (const lot of lots) {
        const preIdxs = Array.isArray(lot?.image_indexes) ? [...lot.image_indexes] : undefined;
        const preUrl = typeof lot?.image_url === "string" ? lot.image_url : undefined;
        lot.image_indexes = [i];
        lot.image_url = url;
        if (process.env.DEBUG_PER_ITEM === "1") {
          console.log("[PerItemDebug][perItem:lot]", {
            index: i,
            url,
            lot_id: lot?.lot_id,
            title: typeof lot?.title === "string" ? lot.title : undefined,
            preIdxs,
            preUrl,
            newIdxs: lot.image_indexes,
            newUrl: lot.image_url,
          });
        }
        combinedLots.push(lot);
      }
    } catch {}
  }

  if (process.env.DEBUG_PER_ITEM === "1") {
    console.log("[PerItemDebug][perItem:done]", { totalLots: combinedLots.length });
  }
  return { lots: combinedLots, language, currency };
}
