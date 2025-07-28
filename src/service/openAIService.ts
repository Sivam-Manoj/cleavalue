import OpenAI from "openai";
import openai from "../utils/openaiClient.js";

export interface ExtractedHouseDetails {
  bedrooms: number;
  bathrooms_full: number;
  bathrooms_half: number;
  garage_description: string;
  basement_description: string;
  major_features: string[];
  known_issues: string[];
}

export async function analyzeRealEstateImages(
  imageUrls: string[]
): Promise<ExtractedHouseDetails> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("No image URLs provided for analysis.");
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert real estate analyst. Your task is to analyze the provided images of a property and extract specific details. Respond ONLY with a valid JSON object matching this structure: 
      {
        "bedrooms": number,
        "bathrooms_full": number,
        "bathrooms_half": number,
        "garage_description": "string",
        "basement_description": "string",
        "major_features": ["string"],
        "known_issues": ["string"]
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
        ...imageUrls.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ],
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
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
