import openai from "../utils/openaiClient.js";

export interface SalvageValuationResult {
  fairMarketValue: string;
  confidence_level: string;
  summary: string;
}

export async function calculateSalvageValue(
  itemDescription: string,
  comparableItems: any[]
): Promise<SalvageValuationResult> {
  const prompt = `
    Act as a salvage valuator. Your task is to estimate the value of a salvaged item based on comparable listings.

    **Subject Item Description:**
    ${itemDescription}

    **Comparable Items Found Online:**
    ${JSON.stringify(comparableItems, null, 2)}

    **Instructions:**
    1. Analyze the comparable items.
    2. Provide an estimated value for the subject item.
    3. Indicate your confidence level in the estimation (e.g., High, Medium, Low).
    4. Write a brief summary explaining your valuation.

    Provide the result ONLY as a valid JSON object with the following structure:
    {
      "fairMarketValue": "<value>",
      "confidence_level": "<High/Medium/Low>",
      "summary": "<Your summary here>"
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty valuation response.");
    }

    return JSON.parse(content) as SalvageValuationResult;
  } catch (error) {
    console.error("Error calculating salvage value:", error);
    throw new Error("Failed to calculate salvage value.");
  }
}
