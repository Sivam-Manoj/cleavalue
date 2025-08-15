import OpenAI from "openai";
import openai from "../utils/openaiClient.js";
import axios from "axios";

export interface ExtractedHouseDetails {
  bedrooms: number;
  bathrooms_full: number;
  bathrooms_half: number;
  garage_description: string;
  basement_description: string;
  major_features: string[];
  known_issues: string[];
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

export async function analyzeRealEstateImages(
  imageUrls: string[]
): Promise<ExtractedHouseDetails> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }
  const base64Images = await Promise.all(imageUrls.map(imageUrlToBase64));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert real estate analyst. Your task is to analyze the provided images of a property and extract specific details. Respond ONLY with a valid JSON object matching this structure: 
      {
        "garage_description": "string",
        "basement_description": "string",
        "major_features": ["string"],
      }
      If a detail cannot be determined from the images, use a reasonable default (e.g., 0 for counts, "Not visible" for descriptions, or an empty array).`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyze these images and provide the property details in the specified JSON format.",
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

    return JSON.parse(content) as ExtractedHouseDetails;
  } catch (error) {
    console.error("Error analyzing images with OpenAI:", error);
    throw new Error("Failed to analyze images.");
  }
}
