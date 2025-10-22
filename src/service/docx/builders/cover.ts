import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { formatDateUS } from "./utils.js";
import { getLang, t } from "./i18n.js";

export async function buildCover(
  reportData: any,
  logoBuffer: Buffer | null,
  contentWidthTw: number,
  titleText: string = "Asset Report",
  heroImageBuffer: Buffer | null = null
): Promise<Table> {
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

  // Calculate additional info line
  const lotsOrAddr = (() => {
    const addr = String(
      (reportData as any)?.property_details?.address || ""
    ).trim();
    const muni = String(
      (reportData as any)?.property_details?.municipality || ""
    ).trim();
    if (addr) return muni ? `${addr}, ${muni}` : addr;
    const lotsCount = Array.isArray((reportData as any)?.lots)
      ? (reportData as any).lots.length
      : 0;
    const gm = String((reportData as any)?.grouping_mode || "catalogue");
    if (!lotsCount) return "";
    const lotSuffix = lotsCount > 1 ? "Lots" : "Lot";
    const gmDisplay =
      gm === "catalogue"
        ? "Catalogue Format"
        : gm === "per_item"
          ? "Per-Item Format"
          : gm === "per_photo"
            ? "Per-Photo Format"
            : gm === "single_lot"
              ? "Single Lot Format"
              : "";
    return `${lotsCount} ${lotSuffix}${gmDisplay ? ` • ${gmDisplay}` : ""}`;
  })();

  // Use pure DOCX-based cover page for better compatibility
  const coverTop: Paragraph[] = [];

  // Top spacer
  coverTop.push(
    new Paragraph({
      text: "",
      spacing: { after: 400 },
    })
  );

  // Logo section
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
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: "McDougall Auctioneers",
            size: 52,
            bold: true,
            color: "DC2626",
          }),
        ],
      })
    );
  }


  // Main title section
  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: titleText || tr.assetReport,
          size: 60,
          bold: true,
          color: "1F2937",
        }),
      ],
    })
  );

  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Professional Valuation Report",
          size: 24,
          color: "DC2626",
          italics: true,
        }),
      ],
      border: {
        bottom: {
          color: "DC2626",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 12,
        },
      },
    })
  );

  // Additional info
  if (!(reportData as any)?.suppressLotsLine && lotsOrAddr) {
    coverTop.push(
      new Paragraph({
        text: lotsOrAddr,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200, before: 200 },
        children: [
          new TextRun({
            text: lotsOrAddr,
            size: 22,
            color: "6B7280",
          }),
        ],
      })
    );
  } else {
    coverTop.push(
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      })
    );
  }

  // Modern details section with cards
  const coverDetails = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    columnWidths: [
      Math.round(coverInnerWidthTw * 0.5),
      Math.round(coverInnerWidthTw * 0.5),
    ],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.SINGLE, size: 20, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          // Client card
          new TableCell({
            margins: { top: 120, bottom: 120, left: 80, right: 80 },
            shading: { fill: "F9FAFB", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "DC2626" },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: tr.preparedFor.toUpperCase(),
                    size: 18,
                    bold: true,
                    color: "6B7280",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: preparedFor || "—",
                    size: 24,
                    bold: true,
                    color: "1F2937",
                  }),
                ],
              }),
            ],
          }),
          // Date card
          new TableCell({
            margins: { top: 120, bottom: 120, left: 80, right: 80 },
            shading: { fill: "F9FAFB", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "DC2626" },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: tr.reportDate.toUpperCase(),
                    size: 18,
                    bold: true,
                    color: "6B7280",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: reportDate || "—",
                    size: 24,
                    bold: true,
                    color: "1F2937",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
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
        height: { value: convertInchesToTwip(6.5), rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            margins: {
              top: 300,
              bottom: 160,
              left: coverCellMarginTw,
              right: coverCellMarginTw,
            },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "FFFFFF", type: ShadingType.SOLID },
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
