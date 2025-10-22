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

interface ValuationMethodData {
  method: "FML" | "TKV" | "OLV" | "FLV";
  fullName: string;
  value: number;
  aiExplanation: string;
  description: string;
  saleConditions: string;
  timeline: string;
  marketContext: string;
  applicationScenarios: string;
  assumptions: string;
}

interface ValuationData {
  baseFMV: number;
  selectedMethod: ValuationMethodData;
}

/**
 * Build valuation comparison table section for DOCX
 */
export async function buildValuationTable(
  reportData: any,
  lang: "en" | "fr" | "es" = "en"
): Promise<any[]> {
  const valuationData = reportData?.valuation_data as ValuationData | undefined;
  
  if (!valuationData || !valuationData.selectedMethod) {
    return [];
  }

  const i18n = {
    en: {
      title: "VALUATION METHOD ANALYSIS",
      subtitle: "Comprehensive Valuation Assessment",
      baseFMV: "Base Fair Market Value",
      method: "Valuation Method",
      value: "Calculated Value",
      timeline: "Expected Timeline",
      explanation: "Professional Analysis & Explanation",
      saleConditions: "Sale Conditions",
      marketContext: "Market Context",
      applicationScenarios: "Application Scenarios",
      assumptions: "Key Assumptions",
      description: "Description",
    },
    fr: {
      title: "ANALYSE DE LA MÉTHODE D'ÉVALUATION",
      subtitle: "Évaluation Complète et Professionnelle",
      baseFMV: "Juste Valeur Marchande de Base",
      method: "Méthode d'Évaluation",
      value: "Valeur Calculée",
      timeline: "Délai Prévu",
      explanation: "Analyse et Explication Professionnelle",
      saleConditions: "Conditions de Vente",
      marketContext: "Contexte du Marché",
      applicationScenarios: "Scénarios d'Application",
      assumptions: "Hypothèses Clés",
      description: "Description",
    },
    es: {
      title: "ANÁLISIS DEL MÉTODO DE VALUACIÓN",
      subtitle: "Evaluación Integral y Profesional",
      baseFMV: "Valor Justo de Mercado Base",
      method: "Método de Valuación",
      value: "Valor Calculado",
      timeline: "Plazo Esperado",
      explanation: "Análisis y Explicación Profesional",
      saleConditions: "Condiciones de Venta",
      marketContext: "Contexto del Mercado",
      applicationScenarios: "Escenarios de Aplicación",
      assumptions: "Supuestos Clave",
      description: "Descripción",
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
          font: "Calibri",
          size: 32,
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
          font: "Calibri",
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
          font: "Calibri",
          size: 24,
          bold: true,
          color: "1F2937",
        }),
        new TextRun({
          text: formatCurrency(valuationData.baseFMV),
          font: "Calibri",
          size: 24,
          bold: true,
          color: "059669",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  const method = valuationData.selectedMethod;

  // Summary table with 4 columns: Method, Value, Timeline, Explanation
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
                  font: "Calibri",
                  size: 20,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "DC2626", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.value,
                  font: "Calibri",
                  size: 20,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "DC2626", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.timeline,
                  font: "Calibri",
                  size: 20,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "DC2626", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.explanation,
                  font: "Calibri",
                  size: 20,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "DC2626", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
      ],
    })
  );

  // Single data row for selected method
  summaryRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: method.method,
                  font: "Calibri",
                  size: 22,
                  bold: true,
                  color: "7F1D1D",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: method.fullName,
                  font: "Calibri",
                  size: 18,
                  color: "6B7280",
                }),
              ],
              spacing: { after: 0 },
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 120, right: 120 },
          shading: { fill: "FEF2F2", type: ShadingType.SOLID },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: formatCurrency(method.value),
                  font: "Calibri",
                  size: 26,
                  bold: true,
                  color: "059669",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 100, right: 100 },
          shading: { fill: "FEF2F2", type: ShadingType.SOLID },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: method.timeline,
                  font: "Calibri",
                  size: 19,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 120, right: 120 },
          shading: { fill: "FEF2F2", type: ShadingType.SOLID },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: method.aiExplanation,
                  font: "Calibri",
                  size: 18,
                  color: "374151",
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 140, right: 140 },
          shading: { fill: "FEF2F2", type: ShadingType.SOLID },
        }),
      ],
    })
  );

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

  // Detailed analysis sections
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Detailed Valuation Analysis",
          font: "Calibri",
          size: 28,
          bold: true,
          color: "1F2937",
        }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );

  // Method description
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.description + ": ",
          font: "Calibri",
          size: 22,
          bold: true,
          color: "7F1D1D",
        }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: method.description,
          font: "Calibri",
          size: 20,
          color: "374151",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Market context
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.marketContext + ": ",
          font: "Calibri",
          size: 22,
          bold: true,
          color: "7F1D1D",
        }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: method.marketContext,
          font: "Calibri",
          size: 20,
          color: "374151",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Sale conditions
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.saleConditions + ": ",
          font: "Calibri",
          size: 22,
          bold: true,
          color: "7F1D1D",
        }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: method.saleConditions,
          font: "Calibri",
          size: 20,
          color: "374151",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Application scenarios
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.applicationScenarios + ": ",
          font: "Calibri",
          size: 22,
          bold: true,
          color: "7F1D1D",
        }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: method.applicationScenarios,
          font: "Calibri",
          size: 20,
          color: "374151",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Key assumptions
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: t.assumptions + ": ",
          font: "Calibri",
          size: 22,
          bold: true,
          color: "7F1D1D",
        }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: method.assumptions,
          font: "Calibri",
          size: 20,
          color: "374151",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  return children;
}
