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
  console.log("Property Details:", propertyDetails);
  console.log(
    "Comparable Properties:",
    JSON.stringify(comparableProperties, null, 2)
  );

  const prompt = `
  Act as a certified real estate appraiser. Your task is to determine the Fair Market Value (FMV) for a subject property using the Direct Comparison Approach.

  **Subject Property Details:**
  - Address: \${propertyDetails.address}, \${propertyDetails.municipality}
  - Type: Residential
  - Size: \${propertyDetails.house_details.square_footage} sqft
  - Bedrooms: \${propertyDetails.house_details.bedrooms}
  - Bathrooms: \${propertyDetails.house_details.bathrooms_full}

  **Comparable Properties Found Online:**
  \${JSON.stringify(comparableProperties, null, 2)}

  **Instructions:**
  1. From the 'Comparable Properties Found Online', identify the single property that is the **best match** for the 'Subject Property Details'. The primary selection criteria is the property with the **closest square footage**.
  2. Always calculate the Fair Market Value (FMV) using this formula:
     - price_per_sqft = comparable.listPrice ÷ comparable.squareFootage
     - fair_market_value = price_per_sqft × subject.squareFootage
  3. The calculated \`fair_market_value\` must be used in the JSON output.
  4. Still include the comparable property’s \`listPrice\` and other details in the JSON for transparency.
  5. In the \`details\` and \`final_estimate_summary\` fields, always explain:
     - Which comparable was chosen and why
     - The price per sqft calculation (show the full formula)
     - How the final FMV was derived from that calculation

  Important:
  - Do not invent or assume any new data.
  - The only calculation you must perform is the per-square-foot FMV calculation described above.
  - Output must be a valid JSON object in the following structure:

  {
    "fair_market_value": "$50,000 CAD",
    "value_source": "Direct Comparison Approach (Price per Sqft)",
    "comparable_list_price": "$100,000 CAD",
    "comparable_used": "123 Example Street, Sample City, SK",
    "final_estimate_summary": "The Direct Comparison Approach produced an FMV for the subject property at 250 sqft. The best comparable was 123 Example Street at 500 sqft with a list price of $100,000. Using price per square foot ($100,000 ÷ 500 = $200/sqft), the subject's estimated FMV is 250 × $200 = $50,000 CAD.",
    "final_estimate_value": "Fifty Thousand ($50,000) Dollars",
    "details": "Comparable chosen: 123 Example Street, Sample City, SK. Price per sqft = 100,000 ÷ 500 sqft = 200/sqft. Subject size = 250 sqft. Final FMV = 200 × 250 = 50,000 CAD. This ensures the value reflects the proportional relationship between the comparable and the subject property."
  }
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5",
      input: prompt, // your appraisal prompt here
      reasoning: { effort: "high" },
      text: {
        format: {
          type: "json_schema",
          name: "real_estate_appraisal",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fair_market_value: { type: "string" },
              value_source: { type: "string" },
              comparable_list_price: { type: "string" },
              comparable_used: { type: "string" },
              final_estimate_summary: { type: "string" },
              final_estimate_value: { type: "string" },
              details: { type: "string" },
            },
            required: [
              "fair_market_value",
              "value_source",
              "comparable_list_price",
              "comparable_used",
              "final_estimate_summary",
              "final_estimate_value",
              "details",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("OpenAI returned an empty valuation response.");
    }

    return JSON.parse(content) as ValuationResult;
  } catch (error) {
    console.error("Error calculating fair market value:", error);
    throw new Error("Failed to calculate fair market value.");
  }
}
