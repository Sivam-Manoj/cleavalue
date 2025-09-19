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

  children.push(
    new Paragraph({ text: tr.certificateOfAppraisal, heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 160 } })
  );
  children.push(goldDivider());

  const totalVal =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
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
              shading: { type: ShadingType.CLEAR, fill: "FFFFFF", color: "auto" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 120 },
                  children: [new TextRun({ text: tr.certificateTitle, bold: true, size: 44 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: tr.certificateBody,
                      color: "374151",
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [new TextRun({ text: totalVal ? String(totalVal) : tr.valueSeeDetails, bold: true, size: 36 })],
                }),
                certDetails,
                new Paragraph({ text: "", spacing: { before: 120, after: 60 } }),
                signatureRow,
              ],
            }),
          ],
        }),
      ],
    })
  );

  return children;
}
