import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
  ShadingType,
  HeightRule,
} from "docx";
import { formatDateUS, goldDivider } from "./utils.js";

export function buildCover(
  reportData: any,
  logoBuffer: Buffer | null,
  contentWidthTw: number,
  titleText: string = "Asset Report"
): Table {
  const preparedFor =
    (reportData?.client_name as string) ||
    (reportData?.inspector_name as string) ||
    "";
  const reportDate = formatDateUS(reportData?.createdAt || new Date().toISOString());
  const coverCellMarginTw = 60;
  const coverInnerWidthTw = contentWidthTw - coverCellMarginTw * 2;

  const coverTop: Paragraph[] = [];
  if (logoBuffer) {
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({ data: logoBuffer as any, transformation: { width: 540, height: 192 } } as any),
        ],
      })
    );
  }
  coverTop.push(
    new Paragraph({
      text: titleText,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );
  coverTop.push(
    new Paragraph({
      text: `${(Array.isArray(reportData?.lots) ? reportData.lots.length : 0)} Lots (${reportData?.grouping_mode || "catalogue"})`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  const coverDetails = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [Math.round(coverInnerWidthTw * 0.28), Math.round(coverInnerWidthTw * 0.72)],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: { type: ShadingType.CLEAR, fill: "F9FAFB", color: "auto" },
            children: [new Paragraph({ children: [new TextRun({ text: "Prepared For", bold: true })] })],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph(preparedFor || "—")],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: { type: ShadingType.CLEAR, fill: "F9FAFB", color: "auto" },
            children: [new Paragraph({ children: [new TextRun({ text: "Report Date", bold: true })] })],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph(reportDate || "—")],
          }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [contentWidthTw],
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
        height: { value: convertInchesToTwip(6.2), rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            margins: { top: 240, bottom: 120, left: coverCellMarginTw, right: coverCellMarginTw },
            children: coverTop,
          }),
        ],
      }),
      new TableRow({
        height: { value: convertInchesToTwip(1.6), rule: HeightRule.EXACT },
        children: [
          new TableCell({
            margins: { top: 120, bottom: 120, left: coverCellMarginTw, right: coverCellMarginTw },
            verticalAlign: VerticalAlign.BOTTOM,
            children: [coverDetails],
          }),
        ],
      }),
    ],
  });
}
