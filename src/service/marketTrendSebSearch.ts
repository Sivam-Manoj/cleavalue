import openai from "../utils/openaiClient.js";

export interface PropertyDetails {
  address: string;
  municipality: string;
}


export interface MarketTrend {
  marketTrends2025: {
    reginaBenchmarkPrice: {
      march: number;
      june: number;
      yearOverYearIncreasePercent: number;
    };
    inventory: {
      monthsOfSupply: number;
      historicalAverageMonths: number;
    };
    salesActivity: {
      comparisonTo10YearAverage: string;
    };
    forecast: {
      lowEstimatePriceGrowthPercent: number;
      highEstimatePriceGrowthPercent: number;
      expectedLate2025AveragePriceCAD: number;
    };
  };
  buyerSellerInsights: {
    marketType: string;
    recommendation: {
      seller: string;
      buyer: string;
    };
  };
  summary: {
    reginaMarket: string;
    lakeridgeMarket: string;
    overallOutlook: string;
  };
}

export async function marketTrendSearch(
  propertyDetails: PropertyDetails,
): Promise<MarketTrend[]> {
  const { address, municipality } = propertyDetails;

  const query = `Find real estate market trend for ${municipality}, near ${address}. 
**CRITICAL CRITERIA**: 
Return the response as a **raw JSON array of objects only**, with no additional text or formatting outside the array.
Each object in the array must follow this **exact flat structure**:
{
  "marketTrends2025": {
    "reginaBenchmarkPrice": {
      "march": 326300,
      "june": 343200,
      "yearOverYearIncreasePercent": 7.9
    },
    "inventory": {
      "monthsOfSupply": 1.8,
      "historicalAverageMonths": 5.5
    },
    "salesActivity": {
      "comparisonTo10YearAverage": "15% to 17% above"
    },
    "forecast": {
      "lowEstimatePriceGrowthPercent": 3,
      "highEstimatePriceGrowthPercent": 9,
      "expectedLate2025AveragePriceCAD": 423000
    }
  },
  "buyerSellerInsights": {
    "marketType": "Seller's market",
    "recommendation": {
      "seller": "Favorable time to list due to high demand and low inventory",
      "buyer": "Move quickly to secure property before further appreciation"
    }
  },
  "summary": {
    "reginaMarket": "Strong growth with tight inventory and increasing prices",
    "lakeridgeMarket": "Healthy pricing around mid-$500K with active buyer interest",
    "overallOutlook": "Positive for both appreciation and selling activity in 2025"
  }
}
If a value is not available, use "Not Found".`;

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
        const parsedJson: MarketTrend[] = JSON.parse(jsonString);
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
    console.error("Error performing web search for market trend:", error);
    throw new Error("Failed to fetch market trend.");
  }
}
