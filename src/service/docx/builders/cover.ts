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
import { getLang, t } from "./i18n.js";

export function buildCover(
  reportData: any,
  logoBuffer: Buffer | null,
  contentWidthTw: number,
  titleText: string = "Asset Report",
  heroImageBuffer: Buffer | null = null
): Table {
  const lang = getLang(reportData);
  const tr = t(lang);
  const preparedFor =
    (reportData?.client_name as string) ||
    (reportData?.inspector_name as string) ||
    "";
  const reportDate = formatDateUS(
    reportData?.createdAt || new Date().toISOString()
  );
  const coverCellMarginTw = 60;
  const coverInnerWidthTw = contentWidthTw - coverCellMarginTw * 2;

  const coverTop: Paragraph[] = [];

  // Enhanced: Hero image at top (if provided)
  if (heroImageBuffer) {
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new ImageRun({
            data: heroImageBuffer as any,
            transformation: { width: 600, height: 400 },
          } as any),
        ],
      })
    );
  }

  // Logo (larger, professional sizing)
  if (logoBuffer) {
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 500, height: 178 },
          } as any),
        ],
      })
    );
  }
  coverTop.push(
    new Paragraph({
      text: titleText || tr.assetReport,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );
  // Optional middle line: address (Real Estate) or lots/grouping (Assets). Allow suppression.
  const lotsOrAddr = (() => {
    // Real Estate override: show subject address/municipality if provided
    const addr = String((reportData as any)?.property_details?.address || "").trim();
    const muni = String((reportData as any)?.property_details?.municipality || "").trim();
    if (addr) return muni ? `${addr}, ${muni}` : addr;
    // Default: Asset report information (lots and grouping)
    const lotsCount = Array.isArray((reportData as any)?.lots)
      ? (reportData as any).lots.length
      : 0;
    const gm = String((reportData as any)?.grouping_mode || "catalogue");
    const gmLabel =
      gm === "single_lot"
        ? tr.singleLot
        : gm === "per_item"
        ? tr.perItem
        : gm === "per_photo"
        ? tr.perPhoto
        : gm === "catalogue"
        ? tr.assetCatalogue
        : gm === "combined"
        ? tr.combined
        : tr.mixed;
    return `${lotsCount} ${tr.lotsWord} (${gmLabel})`;
  })();
  if (!(reportData as any)?.suppressLotsLine && lotsOrAddr) {
    coverTop.push(
      new Paragraph({
        text: lotsOrAddr,
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      })
    );
  }

  const coverDetails = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      Math.round(coverInnerWidthTw * 0.28),
      Math.round(coverInnerWidthTw * 0.72),
    ],
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
            children: [
              new Paragraph({
                children: [new TextRun({ text: tr.preparedFor, bold: true })],
              }),
            ],
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
            children: [
              new Paragraph({
                children: [new TextRun({ text: tr.reportDate, bold: true })],
              }),
            ],
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
            margins: {
              top: 240,
              bottom: 120,
              left: coverCellMarginTw,
              right: coverCellMarginTw,
            },
            children: coverTop,
          }),
        ],
      }),
      new TableRow({
        height: { value: convertInchesToTwip(1.6), rule: HeightRule.EXACT },
        children: [
          new TableCell({
            margins: {
              top: 120,
              bottom: 120,
              left: coverCellMarginTw,
              right: coverCellMarginTw,
            },
            verticalAlign: VerticalAlign.BOTTOM,
            children: [coverDetails],
          }),
        ],
      }),
    ],
  });
}
