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

  // Spacer for top section
  coverTop.push(
    new Paragraph({
      text: "",
      spacing: { after: 200 },
    })
  );

  // Modern logo section with enhanced styling
  if (logoBuffer) {
    // Logo with elegant presentation
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 480, height: 170 },
          } as any),
        ],
      })
    );
  } else {
    // Elegant company name display
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: "McDOUGALL",
            size: 64,
            bold: true,
            color: "DC2626",
            allCaps: true,
          }),
        ],
      })
    );
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: "AUCTIONEERS",
            size: 48,
            bold: false,
            color: "991B1B",
            allCaps: true,
          }),
        ],
      })
    );
  }

  // Decorative elements with red theme
  const decorativeLine = new Table({
    width: { size: Math.round(coverInnerWidthTw * 0.7), type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        height: { value: 80, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { fill: "FEE2E2", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph("")],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: "DC2626", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph("")],
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { fill: "FEE2E2", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph("")],
          }),
        ],
      }),
    ],
  });

  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [],
    })
  );

  // Main title with elegant red theme design
  const titleBox = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "DC2626" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "DC2626" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "FFFBFB", type: ShadingType.SOLID },
            margins: { top: 240, bottom: 240, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: titleText || tr.assetReport,
                    size: 72,
                    bold: true,
                    color: "7F1D1D",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Professional Valuation Report",
                    size: 28,
                    color: "DC2626",
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  coverTop.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [],
    })
  );
  if (!(reportData as any)?.suppressLotsLine && lotsOrAddr) {
    coverTop.push(
      new Paragraph({
        text: lotsOrAddr,
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      })
    );
  }

  // Modern details section with cards
  const coverDetails = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
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
            margins: { top: 140, bottom: 140, left: 100, right: 100 },
            shading: { fill: "FEF2F2", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: "DC2626" },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: tr.preparedFor.toUpperCase(),
                    size: 22,
                    bold: true,
                    color: "991B1B",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: preparedFor || "—",
                    size: 28,
                    bold: true,
                    color: "7F1D1D",
                  }),
                ],
              }),
            ],
          }),
          // Date card
          new TableCell({
            margins: { top: 140, bottom: 140, left: 100, right: 100 },
            shading: { fill: "FEF2F2", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: "DC2626" },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: tr.reportDate.toUpperCase(),
                    size: 22,
                    bold: true,
                    color: "991B1B",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: reportDate || "—",
                    size: 28,
                    bold: true,
                    color: "7F1D1D",
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
            shading: { fill: "FFFFFF", type: ShadingType.SOLID },
            children: [...coverTop, decorativeLine, titleBox],
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
