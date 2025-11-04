import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
  ImageRun,
} from "docx";
import { goldDivider, formatDateUS } from "./utils.js";
import { getLang, t } from "./i18n.js";
import { generateCertificateImage } from "../../htmlToImage.js";

/**
 * Format currency value with symbol and comma separators
 */
function formatCurrencyValue(value: string | number | undefined, currency: string = "CAD"): string | undefined {
  if (!value) return undefined;
  
  // Parse numeric value
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  
  if (isNaN(numericValue)) return undefined;
  
  // Currency symbols mapping
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'CAD': 'CA$',
    'EUR': '€',
    'GBP': '£',
    'AUD': 'A$',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
  };
  
  const symbol = currencySymbols[currency.toUpperCase()] || currency.toUpperCase() + ' ';
  
  // Format with comma separators
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
  
  return `${symbol}${formattedNumber}`;
}

export async function buildCertificateOfAppraisal(
  reportData: any,
  contentWidthTw: number,
  reportDate: string
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const lang = getLang(reportData);
  const tr = t(lang);

  // Modern certificate - no heading, goes straight to the certificate card
  children.push(
    new Paragraph({ text: "", pageBreakBefore: true, spacing: { after: 0 } })
  );

  const totalVal =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
    (reportData?.valuation?.fair_market_value as string) ||
    (reportData?.valuation?.final_estimate_value as string) ||
    undefined;

  const currency = reportData?.currency || "CAD";
  const formattedTotalValue = formatCurrencyValue(totalVal, currency);

  const preparedBy = [reportData?.appraiser, reportData?.appraisal_company].filter(Boolean).join(", ");
  const certCellMarginTw = 120;
  const certInnerWidthTw = contentWidthTw - certCellMarginTw * 2;
  const valueBoxWidthTw = Math.round(certInnerWidthTw * 0.75);

  // Generate beautiful certificate image from HTML
  let certificateImageBuffer: Buffer | null = null;
  try {
    certificateImageBuffer = await generateCertificateImage({
      title: tr.certificateTitle,
      clientName: String(reportData?.client_name || ""),
      effectiveDate: formatDateUS(reportData?.effective_date) || reportDate || "",
      purpose: String(reportData?.appraisal_purpose || ""),
      preparedBy: preparedBy || "",
      totalValue: formattedTotalValue,
      reportDate: reportDate || "",
    });
  } catch (error) {
    console.error("Failed to generate certificate image:", error);
  }

  // If image generation succeeded, use it
  if (certificateImageBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: certificateImageBuffer as any,
            transformation: {
              width: 595,  // A4 page width in points (8.27" at 72 DPI)
              height: 842, // A4 page height in points (11.69" at 72 DPI)
            },
          } as any),
        ],
        spacing: { before: 0, after: 0 },
      })
    );

    return children;
  }

  // Fallback to text-based certificate if image generation fails
  console.warn("Using fallback text-based certificate");

  const certDetails = new Table({
    width: { size: certInnerWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [Math.round(certInnerWidthTw * 0.34), Math.round(certInnerWidthTw * 0.66)],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: tr.client, bold: true })] })],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph(String(reportData?.client_name || "—"))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: tr.effectiveDate, bold: true })] })],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph(formatDateUS(reportData?.effective_date) || reportDate || "—")],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: tr.purpose, bold: true })] })],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph(String(reportData?.appraisal_purpose || "—"))],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: tr.preparedBy, bold: true })] })],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph(preparedBy || "—")],
          }),
        ],
      }),
    ],
  });

  const signatureRow = new Table({
    width: { size: certInnerWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [Math.round(certInnerWidthTw / 2), Math.round(certInnerWidthTw / 2)],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 20, left: 100, right: 100 },
            children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "A3A3A3" } }, spacing: { before: 120, after: 60 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tr.appraiserSignature, color: "6B7280" })] }),
            ],
          }),
          new TableCell({
            margins: { top: 80, bottom: 20, left: 100, right: 100 },
            children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "A3A3A3" } }, spacing: { before: 120, after: 60 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${tr.dateLabel}${reportDate}`, color: "6B7280" })] }),
            ],
          }),
        ],
      }),
    ],
  });

  // Certificate border container
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 300 },
      border: {
        top: { style: BorderStyle.DOUBLE, size: 20, color: "D4AF37" },
      },
    })
  );

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: tr.certificateTitle,
          bold: true,
          size: 54,
          color: "1F2937",
        }),
      ],
    })
  );

  // Gold underline
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: "D4AF37" },
      },
    })
  );

  // Certification statement
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280, before: 40 },
      children: [
        new TextRun({
          text: tr.certificateBody,
          color: "374151",
          size: 24,
        }),
      ],
    })
  );

  // Value box (simplified, not nested)
  children.push(
    new Table({
      width: { size: valueBoxWidthTw, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { style: BorderStyle.DOUBLE, size: 8, color: "D4AF37" },
        bottom: { style: BorderStyle.DOUBLE, size: 8, color: "D4AF37" },
        left: { style: BorderStyle.DOUBLE, size: 8, color: "D4AF37" },
        right: { style: BorderStyle.DOUBLE, size: 8, color: "D4AF37" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, fill: "FEF3C7", color: "auto" },
              margins: { top: 200, bottom: 200, left: 160, right: 160 },
              width: { size: 100, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Total Appraised Value",
                      size: 22,
                      color: "92400E",
                      bold: true,
                    }),
                  ],
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: formattedTotalValue || tr.valueSeeDetails,
                      bold: true,
                      size: 48,
                      color: "059669",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: "", spacing: { after: 300 } }));

  // Details table (flatter structure)
  children.push(
    new Table({
      width: { size: certInnerWidthTw, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      layout: TableLayoutType.FIXED,
      columnWidths: [
        Math.round(certInnerWidthTw * 0.35),
        Math.round(certInnerWidthTw * 0.65),
      ],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        left: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        right: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, fill: "F3F4F6", color: "auto" },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              width: { size: 35, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: tr.client, bold: true, size: 22, color: "1F2937" }),
                  ],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(reportData?.client_name || "—"),
                      size: 22,
                      color: "374151",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, fill: "F3F4F6", color: "auto" },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: tr.effectiveDate,
                      bold: true,
                      size: 22,
                      color: "1F2937",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatDateUS(reportData?.effective_date) || reportDate || "—",
                      size: 22,
                      color: "374151",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, fill: "F3F4F6", color: "auto" },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: tr.purpose, bold: true, size: 22, color: "1F2937" }),
                  ],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(reportData?.appraisal_purpose || "—"),
                      size: 22,
                      color: "374151",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, fill: "F3F4F6", color: "auto" },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: tr.preparedBy,
                      bold: true,
                      size: 22,
                      color: "1F2937",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: preparedBy || "—", size: 22, color: "374151" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: "", spacing: { after: 300 } }));

  // Signature section (simplified)
  children.push(
    new Table({
      width: { size: certInnerWidthTw, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      layout: TableLayoutType.FIXED,
      columnWidths: [
        Math.round(certInnerWidthTw / 2),
        Math.round(certInnerWidthTw / 2),
      ],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 160, bottom: 60, left: 100, right: 100 },
              borders: {
                top: { style: BorderStyle.DOUBLE, size: 6, color: "1F2937" },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: tr.appraiserSignature,
                      color: "6B7280",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 160, bottom: 60, left: 100, right: 100 },
              borders: {
                top: { style: BorderStyle.DOUBLE, size: 6, color: "1F2937" },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: `${tr.dateLabel}${reportDate}`,
                      color: "6B7280",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Bottom border
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 0 },
      border: {
        bottom: { style: BorderStyle.DOUBLE, size: 20, color: "D4AF37" },
      },
    })
  );

  return children;
}

// Keep old function signature for backwards compatibility
export function buildCertificateOfAppraisalSync(
  reportData: any,
  contentWidthTw: number,
  reportDate: string
): Array<Paragraph | Table> {
  // This is a sync fallback that returns a simple placeholder
  return [
    new Paragraph({ 
      text: "Certificate of Appraisal", 
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ 
      text: "Loading certificate...", 
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  ];
}
