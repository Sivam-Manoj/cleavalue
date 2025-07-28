import openai from "../utils/openaiClient.js";
import { SearchResult } from "./webSearchService.js";

export interface ValuationResult {
  fair_market_value: string;
  value_source: string;
  adjusted_value_from_comparable: string;
  comparable_used: string;
}

export async function calculateFairMarketValue(
  propertyDetails: any,
  comparableProperties: SearchResult[]
): Promise<ValuationResult> {
  const prompt = `
    Act as a certified real estate appraiser. Your task is to determine the Fair Market Value (FMV) for a subject property using the Direct Comparison Approach.

    **Subject Property Details:**
    - Address: ${propertyDetails.address}, ${propertyDetails.municipality}
    - Type: Residential
    - Size: ${propertyDetails.house_details.square_footage} sqft
    - Bedrooms: ${propertyDetails.house_details.bedrooms}
    - Bathrooms: ${propertyDetails.house_details.bathrooms_full}

    **Comparable Properties Found Online:**
    ${JSON.stringify(comparableProperties, null, 2)}

    **Instructions:**
    1. Analyze the comparable properties and select the most relevant one for comparison.
    2. Make adjustments to the comparable property's sale price to account for differences in size, location, and features compared to the subject property.
    3. Calculate the final Fair Market Value (FMV) for the subject property.
    4. Provide the result ONLY as a valid JSON object with the following exact structure:
    {
      "fair_market_value": "string (e.g., '$850,000 CAD')",
      "value_source": "Direct Comparison Approach",
      "adjusted_value_from_comparable": "string (e.g., '$845,000')",
      "comparable_used": "string (Address of the comparable property used)"
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty valuation response.");
    }

    return JSON.parse(content) as ValuationResult;
  } catch (error) {
    console.error("Error calculating fair market value:", error);
    throw new Error("Failed to calculate fair market value.");
  }
}
