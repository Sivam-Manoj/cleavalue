import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export type ValuationMethod = "FML" | "TKV" | "OLV" | "FLV";

export interface ValuationResult {
  method: ValuationMethod;
  fullName: string;
  description: string;
  percentage: number; // Percentage of FMV (e.g., 100, 75, 65, 50)
  value: number;
  saleConditions: string;
  timeline: string;
  useCase: string;
}

export interface ValuationComparisonTable {
  baseFMV: number;
  methods: ValuationResult[];
}

const VALUATION_DEFINITIONS = {
  FML: {
    fullName: "Fair Market Value (FML / FMV In Use)",
    saleConditions: "Installed and operating, open competitive market",
    typicalRange: [95, 100],
    timeline: "Normal market exposure (60-120 days)",
    defaultPercentage: 100,
    description: "Appraised retail value - what the asset would sell for in an open, competitive market between informed buyers and sellers with no pressure to sell.",
    useCase: "Setting reserve prices, insurance valuation, book value, appraisal purposes, establishing loan collateral (top end).",
  },
  TKV: {
    fullName: "Trade Value (TKV / Kelly Value)",
    saleConditions: "Dealer trade-in for quick resale",
    typicalRange: [60, 80],
    timeline: "Immediate dealer acquisition",
    defaultPercentage: 70,
    description: "Dealer in-trade benchmark - what a dealer or reseller would pay to acquire the asset in trade, leaving room for resale profit margin.",
    useCase: "Wholesale comparison, pre-auction liquidation, dealer consignment guarantees, trade-in valuations.",
  },
  OLV: {
    fullName: "Orderly Liquidation Value",
    saleConditions: "Controlled liquidation with marketing period",
    typicalRange: [70, 85],
    timeline: "90-180 days with full marketing",
    defaultPercentage: 77,
    description: "Auction reserve range - expected realizable value when marketed over a reasonable time through a full marketing cycle (email, listing, inspection).",
    useCase: "Secured lending (70-80% LTV), auction reserve pricing, restructuring, voluntary liquidation appraisals.",
  },
  FLV: {
    fullName: "Forced Liquidation Value",
    saleConditions: "Immediate liquidation under distress",
    typicalRange: [40, 65],
    timeline: "10-30 days, minimal marketing",
    defaultPercentage: 52,
    description: "Quick-sale recovery - what could be recovered if the asset must be sold immediately under distress conditions (repossession, bankruptcy, receiver sale).",
    useCase: "Worst-case lender recovery, bankruptcy proceedings, receiver sales, no-reserve auction estimates, risk assessment.",
  },
};

/**
 * Use AI to determine appropriate valuation percentages based on asset characteristics
 */
export async function determineValuationPercentages(
  assetTitle: string,
  assetDescription: string,
  assetCondition: string,
  industry: string,
  baseFMV: number
): Promise<Record<ValuationMethod, number>> {
  try {
    const prompt = `You are an expert appraiser and valuation specialist. Based on the asset details below, determine appropriate valuation percentages for different liquidation scenarios.

**Asset Details:**
- Title: ${assetTitle}
- Description: ${assetDescription || "N/A"}
- Condition: ${assetCondition || "Unknown"}
- Industry: ${industry || "General"}
- Base Fair Market Value (FMV): $${baseFMV.toLocaleString()}

**Valuation Methods to Calculate:**

1. **FML (Fair Market Value)** - Always 100%
2. **TKV (Trade Value)** - Typical range: 60-80% of FMV
3. **OLV (Orderly Liquidation Value)** - Typical range: 70-85% of FMV
4. **FLV (Forced Liquidation Value)** - Typical range: 40-65% of FMV

**Instructions:**
Consider the following factors when determining percentages:
- Asset type and marketability
- Condition and age
- Industry demand
- Liquidity (how quickly it can be sold)
- Specialized vs. general-purpose equipment
- Market conditions

Return ONLY a JSON object with the following structure (no markdown, no explanations):
{
  "FML": 100,
  "TKV": 70,
  "OLV": 77,
  "FLV": 52
}

The percentages must be realistic numbers within the typical ranges specified above.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(content);

    // Validate and apply bounds
    return {
      FML: 100, // Always 100%
      TKV: Math.max(60, Math.min(80, parsed.TKV || 70)),
      OLV: Math.max(70, Math.min(85, parsed.OLV || 77)),
      FLV: Math.max(40, Math.min(65, parsed.FLV || 52)),
    };
  } catch (error) {
    console.error("AI valuation percentage determination failed:", error);
    // Return default percentages
    return {
      FML: 100,
      TKV: 70,
      OLV: 77,
      FLV: 52,
    };
  }
}

/**
 * Generate valuation comparison table
 */
export function generateValuationTable(
  baseFMV: number,
  selectedMethods: ValuationMethod[],
  percentages?: Partial<Record<ValuationMethod, number>>
): ValuationComparisonTable {
  const methods: ValuationResult[] = selectedMethods.map((method) => {
    const def = VALUATION_DEFINITIONS[method];
    const percentage = percentages?.[method] ?? def.defaultPercentage;
    const value = (baseFMV * percentage) / 100;

    return {
      method,
      fullName: def.fullName,
      description: def.description,
      percentage,
      value,
      saleConditions: def.saleConditions,
      timeline: def.timeline,
      useCase: def.useCase,
    };
  });

  return {
    baseFMV,
    methods,
  };
}

/**
 * Format valuation table for display
 */
export function formatValuationTableText(table: ValuationComparisonTable): string {
  let output = `VALUATION COMPARISON TABLE\n`;
  output += `Base Fair Market Value: $${table.baseFMV.toLocaleString()}\n\n`;
  output += `${"Method".padEnd(15)} ${"% of FMV".padEnd(12)} ${"Value".padEnd(15)} Timeline\n`;
  output += `${"-".repeat(70)}\n`;

  for (const m of table.methods) {
    output += `${m.method.padEnd(15)} ${(m.percentage + "%").padEnd(12)} $${m.value.toLocaleString().padEnd(13)} ${m.timeline}\n`;
  }

  return output;
}

/**
 * Get detailed explanation for a valuation method
 */
export function getValuationMethodExplanation(method: ValuationMethod): string {
  const def = VALUATION_DEFINITIONS[method];
  return `
${def.fullName}

Sale Conditions: ${def.saleConditions}
Typical Range: ${def.typicalRange[0]}-${def.typicalRange[1]}% of FMV
Timeline: ${def.timeline}

Description:
${def.description}

Use Cases:
${def.useCase}
  `.trim();
}
