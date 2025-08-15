import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";

export interface ExtractedSalvageDetails {
  item_type: string;
  year: string;
  make: string;
  item_model: string;
  vin: string;
  item_condition: string;
  damage_description: string;
  inspection_comments: string;
  is_repairable: "Yes" | "No" | "To Be Determined";
  repair_facility: string;
  repair_facility_comments: string;
  repair_estimate: {
    parts: number;
    less_betterment: number;
    labour: number;
    shop_supplies: number;
    miscellaneous: number;
    taxes: number;
    total: number;
  };
  actual_cash_value: number;
  replacement_cost: number;
  replacement_cost_references: string;
  recommended_reserve: number;
}

// Helper function to fetch image and convert to Base64
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error(`Failed to download or convert image from ${url}:`, error);
    throw new Error(`Failed to process image URL: ${url}`);
  }
}

export async function analyzeSalvageImages(
  imageUrls: string[]
): Promise<ExtractedSalvageDetails> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert salvage analyst. Your task is to analyze the provided images of a salvaged item and extract specific details. Respond ONLY with a valid JSON object matching this structure: 
      {
        "item_type": "string",
        "year": "string",
        "make": "string",
        "item_model": "string",
        "vin": "string",
        "item_condition": "string",
        "damage_description": "string",
        "inspection_comments": "string",
        "is_repairable": "Yes" | "No" | "To Be Determined",
        "repair_facility": "string",
        "repair_facility_comments": "string",
        "repair_estimate": {
          "parts": number,
          "less_betterment": number,
          "labour": number,
          "shop_supplies": number,
          "miscellaneous": number,
          "taxes": number,
          "total": number
        },
        "actual_cash_value": number,
        "replacement_cost": number,
        "replacement_cost_references": "string",
        "recommended_reserve": number
      }
      If a detail cannot be determined from the images, use a reasonable default (e.g., "Not visible" for descriptions, or 0 for numbers). For VIN, if not visible, return "Not Visible".`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyze these images and provide the salvage details in the specified JSON format.",
        },
        ...base64Images.map((base64) => ({
          type: "image_url" as const,
          image_url: { url: `data:image/jpeg;base64,${base64}` },
        })),
      ],
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    return JSON.parse(content) as ExtractedSalvageDetails;
  } catch (error) {
    console.error("Error analyzing images with OpenAI:", error);
    throw new Error("Failed to analyze images.");
  }
}
