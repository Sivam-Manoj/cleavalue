import axios from "axios";
import openai from "../utils/openaiClient.js";

export type MarketIndicators = {
  bullets: string[];
  sources: { title: string; url: string }[];
  series: { years: number[]; values: number[] };
};

function extractKeywordsFromLots(reportData: any): string[] {
  try {
    const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
    const texts: string[] = [];
    for (const lot of lots) {
      if (typeof lot?.title === "string") texts.push(lot.title);
      if (typeof lot?.description === "string") texts.push(lot.description);
      if (Array.isArray(lot?.tags)) {
        for (const t of lot.tags) if (typeof t === "string") texts.push(t);
      }
      if (Array.isArray(lot?.items)) {
        for (const it of lot.items) {
          if (typeof it?.title === "string") texts.push(it.title);
          if (typeof it?.description === "string") texts.push(it.description);
          if (typeof it?.details === "string") texts.push(it.details);
        }
      }
    }
    const blob = texts.join(" ").toLowerCase();
    const tokens = blob
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && w.length >= 3);
    const counts = new Map<string, number>();
    for (const tk of tokens) counts.set(tk, (counts.get(tk) || 0) + 1);
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([w]) => w);
    return top;
  } catch {
    return [];
  }
}

function deriveIndustryFromReport(reportData: any): { industry: string; keywords: string[] } {
  const explicit = (reportData?.industry && String(reportData.industry)) || "";
  const kws = extractKeywordsFromLots(reportData);
  const has = (list: string[]) => list.some((w) => kws.includes(w));

  // Category heuristics
  if (has(["salvage", "wrecked", "writeoff", "damage"])) {
    return { industry: "Salvage Vehicles", keywords: kws };
  }
  if (has(["car", "cars", "truck", "trucks", "vehicle", "vehicles", "suv", "sedan", "motorcycle", "van"])) {
    return { industry: "Vehicles", keywords: kws };
  }
  if (has(["acre", "realtor", "property", "building", "sq", "residential", "commercial", "land"])) {
    return { industry: "Real Estate", keywords: kws };
  }
  if (has(["excavator", "loader", "bulldozer", "dozer", "tractor", "backhoe", "skidsteer", "grader", "forklift"])) {
    return { industry: "Heavy Equipment", keywords: kws };
  }
  if (explicit) {
    return { industry: explicit, keywords: kws };
  }
  return { industry: "General Assets", keywords: kws };
}

/**
 * Fetch market indicators using OpenAI Responses API with web_search_preview.
 * Falls back to safe, sample values when unavailable or on any errors.
 */
export async function fetchMarketIndicators(
  industry: string,
  region?: string,
  contextKeywords: string[] = []
): Promise<MarketIndicators> {
  const fallback: MarketIndicators = {
    bullets: [
      `Sample insight: ${industry} demand has shown steady growth over 5 years in ${region || "target region"}.`,
      "Auction activity and secondary market pricing remain supportive of appraised values.",
      "Capital expenditure cycles and infrastructure investments underpin medium‑term stability.",
    ],
    sources: [
      { title: "Industry overview (sample)", url: "https://www.ritchiebros.com/market-trends" },
      { title: "Equipment market trends (sample)", url: "https://www.statcan.gc.ca/" },
      { title: "Machinery outlook (sample)", url: "https://fred.stlouisfed.org/" },
    ],
    series: { years: [2021, 2022, 2023, 2024, 2025], values: [3.6, 4.0, 4.2, 4.1, 4.3] },
  };

  // Use OpenAI web_search_preview to retrieve sources and insights
  try {
    const yearNow = new Date().getFullYear();
    const prompt = `You are a market analyst. Using web search, produce:
{
  "bullets": ["3-5 concise insights about the ${industry} market${region ? ` in ${region}` : ""}"],
  "sources": [{"title": "string", "url": "https://..."}],
  "series": {"years": [${yearNow - 4}, ${yearNow - 3}, ${yearNow - 2}, ${yearNow - 1}, ${yearNow}], "values": [n1, n2, n3, n4, n5]}
}
Rules:
- Output JSON ONLY with the exact keys and structure above — no prose before or after.
- "values" represent an approximate market size or appraised value proxy in CAD billions with one decimal place.
- Sources must be reputable pages relevant to the query.
Query focus: ${industry} market ${region ? `in ${region}` : "(global or relevant region)"}.
Context terms from the appraisal results (use to refine the search and make insights specific): ${contextKeywords
      .slice(0, 20)
      .join(", ")}.`;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "high",
        },
      ],
      input: prompt,
    });

    const content = (response as any)?.output_text as string | undefined;
    let parsed: any | null = null;
    if (content) {
      // Try direct JSON parse first
      try {
        parsed = JSON.parse(content);
      } catch {
        // Fallback: capture JSON object substring
        const m = content.match(/\{[\s\S]*\}/);
        if (m && m[0]) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            parsed = null;
          }
        }
      }
    }

    if (!parsed) return fallback;

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b: any) => typeof b === "string").slice(0, 5)
      : [];
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources
          .map((s: any) => ({ title: String(s?.title || "Untitled"), url: String(s?.url || "") }))
          .filter((s: any) => s.url)
          .slice(0, 6)
      : [];
    const years = Array.isArray(parsed?.series?.years)
      ? parsed.series.years.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : [];
    const values = Array.isArray(parsed?.series?.values)
      ? parsed.series.values.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : [];

    const seriesOk = years.length === values.length && years.length >= 3;
    return {
      bullets: bullets.length ? bullets : fallback.bullets,
      sources: sources.length ? sources : fallback.sources,
      series: seriesOk ? { years, values } : fallback.series,
    };
  } catch {
    return fallback;
  }
}

/**
 * Generate a line chart image Buffer using QuickChart.
 * No API key required. Returns PNG bytes.
 */
export async function generateTrendChartImage(
  years: number[],
  values: number[],
  title: string,
  width = 1000,
  height = 600
): Promise<Buffer> {
  const config = {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Value (CAD Billions)",
          data: values,
          fill: false,
          borderColor: "#E11D48",
          borderWidth: 3,
          pointBackgroundColor: "#E11D48",
          pointRadius: 3,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: true, text: title },
      },
      scales: {
        y: { title: { display: true, text: "Value (CAD Billions)" } },
        x: { title: { display: true, text: "Year" } },
      },
    },
  };

  const url = `https://quickchart.io/chart?width=${width}&height=${height}&backgroundColor=white&devicePixelRatio=2&c=${encodeURIComponent(
    JSON.stringify(config)
  )}`;

  const resp = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 15000 });
  return Buffer.from(resp.data);
}

/**
 * Generate a bar chart image Buffer using QuickChart.
 * Used for North America highlights.
 */
export async function generateBarChartImage(
  years: number[],
  values: number[],
  title: string,
  width = 1000,
  height = 600
): Promise<Buffer> {
  const config = {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          label: "Value (CAD Billions)",
          data: values,
          backgroundColor: "#065F46",
          borderColor: "#064E3B",
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: true, text: title },
      },
      scales: {
        y: { title: { display: true, text: "Value (CAD Billions)" }, beginAtZero: true },
        x: { title: { display: true, text: "Year" } },
      },
    },
  };

  const url = `https://quickchart.io/chart?width=${width}&height=${height}&backgroundColor=white&devicePixelRatio=2&c=${encodeURIComponent(
    JSON.stringify(config)
  )}`;

  const resp = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 15000 });
  return Buffer.from(resp.data);
}

export async function fetchCanadaAndNorthAmericaIndicators(
  reportData: any
): Promise<{ industry: string; canada: MarketIndicators; northAmerica: MarketIndicators }> {
  const { industry, keywords } = deriveIndustryFromReport(reportData);
  const [canada, northAmerica] = await Promise.all([
    fetchMarketIndicators(industry, "Canada", keywords),
    fetchMarketIndicators(industry, "North America", keywords),
  ]);
  return { industry, canada, northAmerica };
}
