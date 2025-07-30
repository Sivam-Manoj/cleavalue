import openai from "../utils/openaiClient.js";

export interface ValuationResult {
  fair_market_value: string;
  value_source: string;
  adjusted_value_from_comparable: string;
  comparable_used: string;
  details: string;
}

export async function calculateFairMarketValue(
  propertyDetails: any,
  comparableProperties: any
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
    ${comparableProperties}

    **Instructions:**
    1. Analyze the comparable properties and select the most relevant one for comparison.
    2. Make adjustments to the comparable property's sale price to account for differences in size, location, and features compared to the subject property.
    3. Calculate the final Fair Market Value (FMV) for the subject property.
    4. Provide the result ONLY as a valid JSON object with the following sample structure below:
    {
      "fair_market_value": "$846,000 CAD",
      "value_source": "Direct Comparison Approach",
      "adjusted_value_from_comparable": "$846,200.00",
      "comparable_used": "4322 Sand Piper Crescent East, Regina, SK",
      "final_adjusted_value": "$846,200.00",
      "final_estimate_summary": "The Direct Comparison Approach to Value produced the following estimate of value for the subject property, 4621 Chuka Drive. The estimate of value by Direct Comparison was based on sales of reasonably similar properties. More weight is given to the Direct Comparison Approach in the final estimate of value, as it more accurately represents the marketplace and the general behaviors of purchasers.",
      "final_estimate_value": "Eight Hundred Forty-Six Thousand ($846,000) Dollars",
      "details": "I have chosen one of the comparable properties as an indicator of value for the subject property. I chose Comparable #3 (4322 Sand Piper Crescent East, Regina, SK) because it required the fewest adjustments and had the smallest total adjustment value. It was adjusted for the following categories: Square Footage, Lot Size, Bedrooms, Bathrooms, Other Features, and Condition. The remaining comparables required adjustments in more categories and had greater total adjustment values."
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
