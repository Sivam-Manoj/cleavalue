import openai from "../utils/openaiClient.js";

interface PropertyDetails {
  address: string;
  municipality: string;
}

interface HouseDetails {
  square_footage: string;
  bedrooms: number;
  bathrooms_full: number;
}

export interface SearchResult {
  title: string;
  link: string;
  price: string;
  address: string;
  size: string;
  snippet: string;
}

export async function findComparableProperties(
  propertyDetails: PropertyDetails,
  houseDetails: HouseDetails
): Promise<SearchResult[]> {
  const { address, municipality } = propertyDetails;
  const { square_footage, bedrooms, bathrooms_full } = houseDetails;

  const query = `Find 3 comparable real estate listings in ${municipality}, near ${address}. 
**CRITICAL CRITERIA**: 
- Square footage MUST be close to ${square_footage} sq ft .
- Must have at least ${bedrooms} bedrooms and ${bathrooms_full} bathrooms.
Return the response as a **raw JSON array of objects only**, with no additional text or formatting outside the array.
Each object in the array must follow this **exact flat structure**:
{
  "name": "Comparable #[Number]",
  "address": "<value>",
  "listPrice": "<value>",
  "squareFootage": "<value>",
  "lotSize": "<value>",
  "bedrooms": "<value>",
  "bathrooms": "<value>",
  "garage": "<value>",
  "basement": "<value>",
  "otherFeatures": "<value>",
  "condition": "<value>",
  "adjustedValue": "<value>" // this should a last price(or listPrice)
}
If a value is not available, use "Not Found".`;

  console.log(`Performing web search with query: "${query}"`);

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1",
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "high",
        },
      ],
      input: query,
    });

    const content = response.output_text;
    // Use a regex to find the JSON array. This is more robust.
    const jsonRegex = /\s*(\[[\s\S]*\])/;
    const match = content.match(jsonRegex);

    if (match && match[1]) {
      const jsonString = match[1];
      try {
        const parsedJson = JSON.parse(jsonString);
        return parsedJson;
      } catch (error) {
        console.error("Error parsing extracted JSON from AI response:", error);
        console.error("Problematic JSON string:", jsonString);
      }
    } else {
      console.error("Could not find a JSON array in the AI response.");
      console.error("Full response content:", content);
    }

    return [];
  } catch (error) {
    console.error(
      "Error performing web search for comparable properties:",
      error
    );
    throw new Error("Failed to fetch comparable properties.");
  }
}
