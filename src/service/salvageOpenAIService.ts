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
  specialty_data?: {
    client_vehicle: Record<string, string>;
    comparable_1: Record<string, string>;
    adjustments: Record<string, number>;
  };
}

// Helper function to fetch image and convert to Base64
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error(`Failed to download or convert image from ${url}:`, error);
    throw new Error(`Failed to process image URL: ${url}`);
  }
}

export async function analyzeSalvageImages(
  imageUrls: string[],
  language: "en" | "fr" | "es" = "en"
): Promise<ExtractedSalvageDetails> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert salvage analyst. Your task is to analyze the provided images of a salvaged item and extract specific details. Respond ONLY with a valid JSON object matching this structure. JSON keys must remain exactly as specified and in English. For free-text fields (e.g., item_condition, damage_description, inspection_comments, repair_facility, repair_facility_comments, replacement_cost_references), the LANGUAGE for content should be: ${language}. For the field is_repairable, output must be exactly one of: "Yes", "No", or "To Be Determined" (in English). Use numbers (no currency symbols) for numeric fields.
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
        "recommended_reserve": number,
        "specialty_data": {
          "client_vehicle": { "<LABEL>": "<VALUE>", "...": "..." },
          "comparable_1": { "<LABEL>": "<VALUE>", "...": "..." },
          "adjustments": { "<LABEL>": number }
        }
      }
      Rules:
      - Populate specialty_data maps with as many fields as visible. Use UPPERCASE English labels like YEAR, MAKE, MODEL, BODY STYLE, DRIVE TYPE, ENGINE HP, ODOMETER, etc. If not visible, set value to "Not Found". For adjustments use a number (0 if unknown).
      - If a detail cannot be determined, use a reasonable default (e.g., "Not visible" for descriptions, or 0 for numbers). For VIN, if not visible, return exactly "Not Visible".`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze these images and provide the salvage details in the specified JSON format. Use language: ${language} for textual content.`,
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
