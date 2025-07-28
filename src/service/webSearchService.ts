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
  
    const query = `Find at least 3 comparable real estate listings currently for sale in ${municipality}, near ${address}, with approximately ${bedrooms} bedrooms, ${bathrooms_full} bathrooms, and around ${square_footage} square feet of space.
  
  Please return the results as a valid **raw JSON array of objects** with no text or formatting outside the array.
  
  Each object in the array must follow this **exact structure**:
  
  {
    "title": "string",
    "link": "string",
    "price": "string (e.g., '$500,000')",
    "address": "string",
    "size": "string (e.g., '2,800 sq ft')",
    "snippet": "string"
  }
  
  Only include listings from reputable sources like Realtor.ca, Zillow, or similar.`;
  
    console.log(`Performing web search with query: "${query}"`);
  
    try {
      const response = await openai.responses.create({
        model: "gpt-4.1",
        tools: [
          {
            type: "web_search_preview",
            search_context_size: "high"
          }
        ],
        input: query
      });
  
      const content = response.output_text;
  
      if (content) {
        const parsedJson = JSON.parse(content);
        return parsedJson;
      }
  
      return [];
    } catch (error) {
      console.error("Error performing web search for comparable properties:", error);
      throw new Error("Failed to fetch comparable properties.");
    }
  }
  