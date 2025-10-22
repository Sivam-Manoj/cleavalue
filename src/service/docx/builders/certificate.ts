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
} from "docx";
import { goldDivider, formatDateUS } from "./utils.js";
import { getLang, t } from "./i18n.js";

export function buildCertificateOfAppraisal(
  reportData: any,
  contentWidthTw: number,
  reportDate: string
): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];
  const lang = getLang(reportData);
  const tr = t(lang);

  // Modern certificate - no heading, goes straight to the certificate card
  children.push(
    new Paragraph({ text: "", pageBreakBefore: true, spacing: { after: 100 } })
  );

  const totalVal =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
    (reportData?.valuation?.fair_market_value as string) ||
    (reportData?.valuation?.final_estimate_value as string) ||
    undefined;

  const preparedBy = [reportData?.appraiser, reportData?.appraisal_company].filter(Boolean).join(", ");
  const certCellMarginTw = 60;
  const certInnerWidthTw = contentWidthTw - certCellMarginTw * 2;

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

  children.push(
    new Table({
      width: { size: contentWidthTw, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [contentWidthTw],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
        bottom: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
        left: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
        right: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
        insideVertical: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 240, bottom: 240, left: certCellMarginTw, right: certCellMarginTw },
              shading: { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" },
              children: [
                // Modern title with underline
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [new TextRun({ text: tr.certificateTitle, bold: true, size: 52, color: "1F2937" })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 240 },
                  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4AF37" } },
                }),
                // Certification statement
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: tr.certificateBody,
                      color: "374151",
                      size: 24,
                    }),
                  ],
                }),
                // Total value in highlighted box
                new Table({
                  width: { size: Math.round(certInnerWidthTw * 0.7), type: WidthType.DXA },
                  alignment: AlignmentType.CENTER,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "D4AF37" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "D4AF37" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "D4AF37" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "D4AF37" },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          shading: { type: ShadingType.SOLID, fill: "FEF3C7", color: "auto" },
                          margins: { top: 160, bottom: 160, left: 120, right: 120 },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                new TextRun({ text: "Total Appraised Value", size: 20, color: "92400E", bold: true }),
                              ],
                              spacing: { after: 80 },
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                new TextRun({ 
                                  text: totalVal ? String(totalVal) : tr.valueSeeDetails, 
                                  bold: true, 
                                  size: 44,
                                  color: "059669"
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new Paragraph({ text: "", spacing: { after: 240 } }),
                // Modern details table with better styling
                new Table({
                  width: { size: certInnerWidthTw, type: WidthType.DXA },
                  layout: TableLayoutType.FIXED,
                  columnWidths: [Math.round(certInnerWidthTw * 0.34), Math.round(certInnerWidthTw * 0.66)],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          shading: { type: ShadingType.SOLID, fill: "F9FAFB", color: "auto" },
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: tr.client, bold: true, size: 22, color: "1F2937" })] })],
                        }),
                        new TableCell({
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: String(reportData?.client_name || "—"), size: 22, color: "374151" })] })],
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({
                          shading: { type: ShadingType.SOLID, fill: "F9FAFB", color: "auto" },
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: tr.effectiveDate, bold: true, size: 22, color: "1F2937" })] })],
                        }),
                        new TableCell({
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: formatDateUS(reportData?.effective_date) || reportDate || "—", size: 22, color: "374151" })] })],
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({
                          shading: { type: ShadingType.SOLID, fill: "F9FAFB", color: "auto" },
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: tr.purpose, bold: true, size: 22, color: "1F2937" })] })],
                        }),
                        new TableCell({
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: String(reportData?.appraisal_purpose || "—"), size: 22, color: "374151" })] })],
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        new TableCell({
                          shading: { type: ShadingType.SOLID, fill: "F9FAFB", color: "auto" },
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: tr.preparedBy, bold: true, size: 22, color: "1F2937" })] })],
                        }),
                        new TableCell({
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: [new Paragraph({ children: [new TextRun({ text: preparedBy || "—", size: 22, color: "374151" })] })],
                        }),
                      ],
                    }),
                  ],
                }),
                new Paragraph({ text: "", spacing: { before: 240, after: 120 } }),
                // Modern signature section
                new Table({
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
                          margins: { top: 120, bottom: 40, left: 80, right: 80 },
                          children: [
                            new Paragraph({ 
                              border: { top: { style: BorderStyle.DOUBLE, size: 6, color: "1F2937" } }, 
                              spacing: { before: 160, after: 80 } 
                            }),
                            new Paragraph({ 
                              alignment: AlignmentType.CENTER, 
                              children: [new TextRun({ text: tr.appraiserSignature, color: "6B7280", size: 20 })] 
                            }),
                          ],
                        }),
                        new TableCell({
                          margins: { top: 120, bottom: 40, left: 80, right: 80 },
                          children: [
                            new Paragraph({ 
                              border: { top: { style: BorderStyle.DOUBLE, size: 6, color: "1F2937" } }, 
                              spacing: { before: 160, after: 80 } 
                            }),
                            new Paragraph({ 
                              alignment: AlignmentType.CENTER, 
                              children: [new TextRun({ text: `${tr.dateLabel}${reportDate}`, color: "6B7280", size: 20 })] 
                            }),
                          ],
                        }),
                      ],
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

  return children;
}
