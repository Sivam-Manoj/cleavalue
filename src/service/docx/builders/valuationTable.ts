import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  ShadingType,
  TableLayoutType,
} from "docx";
import { goldDivider } from "./utils.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface ValuationMethod {
  method: string;
  fullName: string;
  description: string;
  percentage: number;
  value: number;
  saleConditions: string;
  timeline: string;
  useCase: string;
  aiExplanation?: string;
}

interface ValuationData {
  baseFMV: number;
  methods: ValuationMethod[];
}

/**
 * Generate AI recommendation for best valuation approach
 */
async function generateRecommendation(
  valuationData: ValuationData,
  reportData: any
): Promise<string> {
  try {
    const methodsSummary = valuationData.methods
      .map(m => `${m.method}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: reportData?.currency || "CAD", minimumFractionDigits: 0 }).format(m.value)}`)
      .join(", ");

    const prompt = `You are an expert appraiser. Based on the valuation methods below, recommend the most appropriate approach for this asset.

**Available Valuations:**
${methodsSummary}

**Asset Context:**
- Industry: ${reportData?.industry || "General"}
- Condition: ${reportData?.lots?.[0]?.condition || "Unknown"}

Provide a 2-3 sentence professional recommendation on which valuation method is most appropriate for this asset and why. Be specific and actionable for client decision-making.

Return ONLY the recommendation text (no labels, no JSON).`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || 
      `Based on the asset characteristics and market conditions, consider the valuation method that best aligns with your intended use case and timeline requirements.`;
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return `Based on the asset characteristics and market conditions, consider the valuation method that best aligns with your intended use case and timeline requirements.`;
  }
}

/**
 * Build valuation comparison table section for DOCX
 */
export async function buildValuationTable(
  reportData: any,
  lang: "en" | "fr" | "es" = "en"
): Promise<any[]> {
  const valuationData = reportData?.valuation_data as ValuationData | undefined;
  
  if (!valuationData || !valuationData.methods || valuationData.methods.length === 0) {
    return [];
  }

  const i18n = {
    en: {
      title: "VALUATION COMPARISON TABLE",
      subtitle: "Multiple Valuation Methods with Software Analysis",
      baseFMV: "Base Fair Market Value",
      method: "Method",
      value: "Value",
      timeline: "Timeline",
      explanation: "Software Explanation",
    },
    fr: {
      title: "TABLEAU COMPARATIF D'ÉVALUATION",
      subtitle: "Plusieurs Méthodes avec Analyse Logicielle",
      baseFMV: "Juste Valeur Marchande de Base",
      method: "Méthode",
      value: "Valeur",
      timeline: "Délai",
      explanation: "Explication Logicielle",
    },
    es: {
      title: "TABLA COMPARATIVA DE VALUACIÓN",
      subtitle: "Múltiples Métodos con Análisis de Software",
      baseFMV: "Valor Justo de Mercado Base",
      method: "Método",
      value: "Valor",
      timeline: "Plazo",
      explanation: "Explicación de Software",
    },
  };

  const t = i18n[lang] || i18n.en;
  const currency = reportData?.currency || "CAD";

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const children: any[] = [];

  // Page break before section
  children.push(
    new Paragraph({
      text: "",
      pageBreakBefore: true,
    })
  );

  // Section title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.title,
          size: 28,
          bold: true,
          color: "1F2937",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.subtitle,
          size: 22,
          color: "6B7280",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Gold divider
  children.push(goldDivider());

  // Base FMV display
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.baseFMV}: `,
          size: 22,
          bold: true,
          color: "1F2937",
        }),
        new TextRun({
          text: formatCurrency(valuationData.baseFMV),
          size: 22,
          bold: true,
          color: "059669",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Comparison table with 4 columns: Method, Value, Timeline, AI Explanation
  const summaryRows: TableRow[] = [];

  // Header row
  summaryRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.method,
                  size: 22,
                  bold: true,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "E5E7EB", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.value,
                  size: 22,
                  bold: true,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "E5E7EB", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.timeline,
                  size: 22,
                  bold: true,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "E5E7EB", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.explanation,
                  size: 22,
                  bold: true,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "E5E7EB", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
      ],
    })
  );

  // Data rows for each selected method with alternating shading
  for (let i = 0; i < valuationData.methods.length; i++) {
    const method = valuationData.methods[i];
    const isEven = i % 2 === 0;
    const bgColor = isEven ? "FFFFFF" : "F9FAFB";
    
    summaryRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.method,
                    size: 22,
                    bold: true,
                    color: "DC2626",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.fullName,
                    size: 22,
                    color: "6B7280",
                  }),
                ],
                spacing: { after: 0 },
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 120, right: 120 },
            shading: { fill: bgColor, type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatCurrency(method.value),
                    size: 22,
                    bold: true,
                    color: "059669",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 100, right: 100 },
            shading: { fill: bgColor, type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.timeline,
                    size: 22,
                    color: "1F2937",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 120, right: 120 },
            shading: { fill: bgColor, type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.aiExplanation || method.description,
                    size: 22,
                    color: "374151",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            shading: { fill: bgColor, type: ShadingType.SOLID },
          }),
        ],
      })
    );
  }

  const tableWidthTw = 9360; // 6.5 inches
  
  children.push(
    new Table({
      rows: summaryRows,
      width: { size: tableWidthTw, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [
        Math.round(tableWidthTw * 0.20),  // Method column
        Math.round(tableWidthTw * 0.18),  // Value column
        Math.round(tableWidthTw * 0.17),  // Timeline column
        Math.round(tableWidthTw * 0.45),  // Explanation column (larger for detailed text)
      ],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        left: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        right: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      },
    })
  );

  children.push(new Paragraph({ text: "", spacing: { after: 400 } }));

  // Recommendation section
  const recommendationText = await generateRecommendation(valuationData, reportData);
  
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Recommendation: ",
          size: 22,
          bold: true,
          color: "DC2626",
        }),
        new TextRun({
          text: recommendationText,
          size: 22,
          color: "1F2937",
        }),
      ],
      spacing: { before: 300, after: 200 },
    })
  );

  return children;
}
