import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";

export interface RepairItem {
  name: string;
  sku?: string;
  oem_or_aftermarket?: "OEM" | "Aftermarket" | "Unknown";
  quantity: number;
  unit_price: number;
  line_total: number;
  vendor?: string;
  vendor_link?: string;
  lead_time_days?: number;
  notes?: string;
}

export interface LabourTask {
  task: string;
  hours: number;
  rate_per_hour?: number;
  line_total: number;
  notes?: string;
}

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
    parts_items?: RepairItem[];
    labour_breakdown?: LabourTask[];
    labour_rate_default?: number;
    parts_subtotal?: number;
    labour_total?: number;
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
  procurement_notes?: string;
  assumptions?: string;
  safety_concerns?: string;
  priority_level?: "High" | "Medium" | "Low";
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
  language: "en" | "fr" | "es" = "en",
  currency?: string
): Promise<ExtractedSalvageDetails> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert salvage analyst. Analyze provided images and output ONLY a valid JSON object with the schema below. Keys must match exactly and be in English.
Language: For free-text fields (e.g., item_condition, damage_description, inspection_comments, repair_facility, repair_facility_comments, replacement_cost_references), use: ${language}.
Currency: Assume ISO currency code: ${(currency || 'CAD')}. All monetary values in the JSON represent this currency. Always return numbers ONLY (no symbols, codes, or text) for numeric fields.
For is_repairable, output must be exactly one of: "Yes", "No", or "To Be Determined".
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
    "total": number,
    "parts_items": [
      { "name": "string", "sku": "string", "oem_or_aftermarket": "OEM" | "Aftermarket" | "Unknown", "quantity": number, "unit_price": number, "line_total": number, "vendor": "string", "vendor_link": "string", "lead_time_days": number, "notes": "string" }
    ],
    "labour_breakdown": [
      { "task": "string", "hours": number, "rate_per_hour": number, "line_total": number, "notes": "string" }
    ],
    "labour_rate_default": number,
    "parts_subtotal": number,
    "labour_total": number
  },
  "actual_cash_value": number,
  "replacement_cost": number,
  "replacement_cost_references": "string",
  "recommended_reserve": number,
  "specialty_data": {
    "client_vehicle": { "<LABEL>": "<VALUE>", "...": "..." },
    "comparable_1": { "<LABEL>": "<VALUE>", "...": "..." },
    "adjustments": { "<LABEL>": number }
  },
  "procurement_notes": "string",
  "assumptions": "string",
  "safety_concerns": "string",
  "priority_level": "High" | "Medium" | "Low"
}
Rules:
- Populate specialty_data maps with as many fields as visible. Use UPPERCASE English labels like YEAR, MAKE, MODEL, BODY STYLE, DRIVE TYPE, ENGINE HP, ODOMETER, etc.; if not visible, set value to "Not Found". For adjustments use a number (0 if unknown).
- Itemize parts in parts_items (with quantity × unit_price = line_total). Use realistic placeholders if exact price is unknown and set unit_price = 0 in that case.
- Provide labour_breakdown with tasks and hours; if rate_per_hour is not visible, use labour_rate_default. Ensure line_total = hours × rate.
- Calculate parts_subtotal = sum(parts_items.line_total). Calculate labour_total = sum(labour_breakdown.line_total). Ensure total = parts_subtotal + labour_total + shop_supplies + miscellaneous + taxes - less_betterment.
- If a detail cannot be determined, use a reasonable default (e.g., "Not visible" for text, 0 for numbers). For VIN, if not visible, return exactly "Not Visible".`,
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
