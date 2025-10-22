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
import { generateCoverPageImage } from "../../htmlToImage.js";

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

  // Generate beautiful cover page image from HTML
  let coverImageBuffer: Buffer | null = null;
  try {
    coverImageBuffer = await generateCoverPageImage({
      companyName: "McDougall Auctioneers",
      title: titleText || tr.assetReport,
      subtitle: "Professional Valuation Report",
      clientName: preparedFor || "—",
      reportDate: reportDate || "—",
      additionalInfo: lotsOrAddr || "",
    }, logoBuffer);
  } catch (error) {
    console.error("Failed to generate cover page image:", error);
  }

  // If image generation succeeded, use it as full-page cover
  if (coverImageBuffer) {
    // Full page letter size: 8.5 x 11 inches
    // At standard DPI this should completely fill the page
    const pageWidth = 8.5 * 72; // 612 points
    const pageHeight = 11 * 72; // 792 points
    
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          height: { value: convertInchesToTwip(11), rule: HeightRule.EXACT },
          children: [
            new TableCell({
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: coverImageBuffer as any,
                      transformation: {
                        width: pageWidth,
                        height: pageHeight,
                      },
                    } as any),
                  ],
                  spacing: { before: 0, after: 0 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  // Fallback to DOCX-based cover if image generation fails
  console.warn("Using fallback DOCX-based cover page");

  const coverTop: Paragraph[] = [];

  // Spacer for top section
  coverTop.push(
    new Paragraph({
      text: "",
      spacing: { after: 200 },
    })
  );

  // Modern logo section with gradient-inspired styling
  if (logoBuffer) {
    // Logo with modern framing
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 450, height: 160 },
          } as any),
        ],
      })
    );
  } else {
    // Modern company name display
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: "McDougall",
            size: 56,
            bold: true,
            color: "1F2937",
          }),
        ],
      })
    );
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: "Auctioneers",
            size: 44,
            bold: false,
            color: "6B7280",
          }),
        ],
      })
    );
  }

  // Decorative elements using tables for gradient effect simulation
  const decorativeLine = new Table({
    width: { size: Math.round(coverInnerWidthTw * 0.6), type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        height: { value: 60, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { fill: "E5E7EB", type: ShadingType.SOLID },
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
            shading: { fill: "D4AF37", type: ShadingType.SOLID },
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
            shading: { fill: "E5E7EB", type: ShadingType.SOLID },
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

  // Main title with modern gradient-inspired design
  const titleBox = new Table({
    width: { size: coverInnerWidthTw, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: "D4AF37" },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: "D4AF37" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F9FAFB", type: ShadingType.SOLID },
            margins: { top: 200, bottom: 200, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: titleText || tr.assetReport,
                    size: 64,
                    bold: true,
                    color: "1F2937",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Professional Valuation Report",
                    size: 26,
                    color: "6B7280",
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
            margins: { top: 120, bottom: 120, left: 80, right: 80 },
            shading: { fill: "F3F4F6", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: "D4AF37" },
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
                    size: 20,
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
                    size: 26,
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
            shading: { fill: "F3F4F6", type: ShadingType.SOLID },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: "D4AF37" },
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
                    size: 20,
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
                    size: 26,
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
