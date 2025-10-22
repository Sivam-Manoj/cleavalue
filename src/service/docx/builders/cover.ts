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

  // Modern header section with company branding
  coverTop.push(
    new Paragraph({
      text: "",
      spacing: { after: 400 },
    })
  );

  // Professional logo (optimized sizing)
  if (logoBuffer) {
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 400, height: 142 },
          } as any),
        ],
      })
    );
  } else {
    // Fallback: Company name in large text
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: "McDougall Auctioneers",
            size: 48,
            bold: true,
            color: "1F2937",
          }),
        ],
      })
    );
  }
  // Professional divider line
  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: {
          color: "D4AF37",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 24,
        },
      },
    })
  );

  // Main title with professional styling
  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: titleText || tr.assetReport,
          size: 56,
          bold: true,
          color: "1F2937",
        }),
      ],
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
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        height: { value: convertInchesToTwip(5.5), rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            margins: {
              top: 400,
              bottom: 200,
              left: coverCellMarginTw,
              right: coverCellMarginTw,
            },
            children: coverTop,
          }),
        ],
      }),
      new TableRow({
        height: { value: convertInchesToTwip(2.0), rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            margins: {
              top: 200,
              bottom: 200,
              left: coverCellMarginTw,
              right: coverCellMarginTw,
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [coverDetails],
          }),
        ],
      }),
    ],
  });
}
