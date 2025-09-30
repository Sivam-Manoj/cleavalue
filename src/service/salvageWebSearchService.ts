import openai from "../utils/openaiClient.js";

export interface SalvageSearchResult {
  title: string;
  link: string;
  price: string;
  price_numeric?: number;
  currency?: string; // ISO code if identifiable
  snippet: string;
  location: string;
  image_url: string;
  details?: Record<string, string>; // e.g., YEAR, MAKE, MODEL, BODY STYLE, CAB TYPE, DRIVE TYPE, TRIM, BODY TYPE, POWER UNIT, etc.
}

export async function findComparableSalvageItems(itemDetails: {
  item_type: string;
  year: string;
  make: string;
  item_model: string;
}): Promise<SalvageSearchResult[]> {
  const { item_type, year, make, item_model } = itemDetails;
  const query = `Find 3 comparable salvage listings for a ${year} ${make} ${item_model} ${item_type}. Focus on for-sale listings in Canada and you can check Kijiji, Iron guides, Marketbook.ca and other salvage websites in Canada.
Return the response as a raw JSON array of objects only (no extra text), where each object follows THIS EXACT structure and key casing:
{
  "title": "<value>",
  "link": "<value>",
  "price": "<value>",
  "price_numeric": <number>,
  "currency": "<ISO or Not Found>",
  "snippet": "<value>",
  "location": "<value>",
  "image_url": "<value>",
  "details": { "<UPPER_LABEL>": "<VALUE>", "...": "..." }
}
Rules:
- Extract as many comparable specs into details as possible using UPPERCASE labels (e.g., YEAR, MAKE, MODEL, BODY STYLE, CAB TYPE, DRIVE TYPE, TRIM, BODY TYPE, POWER UNIT, ENGINE, ODOMETER, VIN, etc.). If unknown, use "Not Found".
- price_numeric must be the numeric amount only (no currency symbol), or 0 if unknown. currency should be ISO code if identifiable (e.g., CAD, USD) else "Not Found".`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5",
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "high",
        },
      ],
      input: query,
    });

    const content = response.output_text;
    const jsonRegex = /\s*(\[[\s\S]*\])/;
    const match = content.match(jsonRegex);

    if (match && match[1]) {
      const jsonString = match[1];
      try {
        const parsedJson = JSON.parse(jsonString);
        return parsedJson;
      } catch (error) {
        console.error("Error parsing extracted JSON from AI response:", error);
        return [];
      }
    } else {
      console.error("Could not find a JSON array in the AI response.");
      return [];
    }
  } catch (error) {
    console.error(
      "Error performing web search for comparable salvage items:",
      error
    );
    throw new Error("Failed to fetch comparable salvage items.");
  }
}
