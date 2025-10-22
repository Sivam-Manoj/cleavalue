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

interface ValuationMethod {
  method: string;
  fullName: string;
  description: string;
  percentage: number;
  value: number;
  saleConditions: string;
  timeline: string;
  useCase: string;
}

interface ValuationData {
  baseFMV: number;
  methods: ValuationMethod[];
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
      subtitle: "Multiple Valuation Methods Analysis",
      baseFMV: "Base Fair Market Value",
      method: "Valuation Method",
      percentage: "% of FMV",
      value: "Calculated Value",
      timeline: "Timeline",
      saleConditions: "Sale Conditions",
      useCase: "Primary Use Cases",
      description: "Description",
    },
    fr: {
      title: "TABLEAU COMPARATIF D'ÉVALUATION",
      subtitle: "Analyse de Plusieurs Méthodes d'Évaluation",
      baseFMV: "Juste Valeur Marchande de Base",
      method: "Méthode d'Évaluation",
      percentage: "% de JVM",
      value: "Valeur Calculée",
      timeline: "Délai",
      saleConditions: "Conditions de Vente",
      useCase: "Cas d'Utilisation Principaux",
      description: "Description",
    },
    es: {
      title: "TABLA COMPARATIVA DE VALUACIÓN",
      subtitle: "Análisis de Múltiples Métodos de Valuación",
      baseFMV: "Valor Justo de Mercado Base",
      method: "Método de Valuación",
      percentage: "% del VJM",
      value: "Valor Calculado",
      timeline: "Plazo",
      saleConditions: "Condiciones de Venta",
      useCase: "Casos de Uso Principales",
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

  // Summary table
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
                  size: 22,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "1F2937", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: t.percentage,
                  font: "Calibri",
                  size: 22,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "1F2937", type: ShadingType.SOLID },
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
                  size: 22,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "1F2937", type: ShadingType.SOLID },
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
                  size: 22,
                  bold: true,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: "1F2937", type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
        }),
      ],
    })
  );

  // Data rows with alternating shading
  for (let i = 0; i < valuationData.methods.length; i++) {
    const method = valuationData.methods[i];
    const isEven = i % 2 === 0;
    
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
                    color: "1F2937",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.fullName,
                    font: "Calibri",
                    size: 19,
                    color: "6B7280",
                  }),
                ],
                spacing: { after: 0 },
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            shading: isEven ? { fill: "FFFFFF", type: ShadingType.SOLID } : { fill: "F9FAFB", type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${method.percentage}%`,
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    color: "1F2937",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            shading: isEven ? { fill: "FFFFFF", type: ShadingType.SOLID } : { fill: "F9FAFB", type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatCurrency(method.value),
                    font: "Calibri",
                    size: 24,
                    bold: true,
                    color: "059669",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            shading: isEven ? { fill: "FFFFFF", type: ShadingType.SOLID } : { fill: "F9FAFB", type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: method.timeline,
                    font: "Calibri",
                    size: 20,
                    color: "1F2937",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            shading: isEven ? { fill: "FFFFFF", type: ShadingType.SOLID } : { fill: "F9FAFB", type: ShadingType.SOLID },
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
        Math.round(tableWidthTw * 0.28),  // Method column
        Math.round(tableWidthTw * 0.15),  // Percentage column
        Math.round(tableWidthTw * 0.27),  // Value column
        Math.round(tableWidthTw * 0.30),  // Timeline column
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

  // Detailed descriptions
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Method Descriptions and Use Cases",
          font: "Calibri",
          size: 28,
          bold: true,
          color: "1F2937",
        }),
      ],
      spacing: { before: 200, after: 200 },
    })
  );

  for (const method of valuationData.methods) {
    // Method header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${method.method} - ${method.fullName}`,
            font: "Calibri",
            size: 24,
            bold: true,
            color: "1F2937",
          }),
        ],
        spacing: { before: 300, after: 100 },
      })
    );

    // Sale conditions
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${t.saleConditions}: `,
            font: "Calibri",
            size: 20,
            bold: true,
            color: "6B7280",
          }),
          new TextRun({
            text: method.saleConditions,
            font: "Calibri",
            size: 20,
            color: "1F2937",
          }),
        ],
        spacing: { after: 100 },
      })
    );

    // Description
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
        spacing: { after: 100 },
      })
    );

    // Use cases
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${t.useCase}: `,
            font: "Calibri",
            size: 20,
            bold: true,
            color: "6B7280",
          }),
          new TextRun({
            text: method.useCase,
            font: "Calibri",
            size: 20,
            color: "1F2937",
          }),
        ],
        spacing: { after: 150 },
      })
    );
  }

  return children;
}
