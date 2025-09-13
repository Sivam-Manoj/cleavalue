import fs from "fs/promises";
import path from "path";
import axios from "axios";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
  TableLayoutType,
  ShadingType,
  VerticalAlign,
  HeightRule,
  TableOfContents,
  Header,
  PageNumber,
} from "docx";
import {
  fetchCanadaAndNorthAmericaIndicators,
  generateTrendChartImage,
} from "../marketIntelService.js";

function formatDateUS(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Visual divider for major sections
function goldDivider(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 16, color: "D4AF37" },
    },
    spacing: { before: 120, after: 160 },
  });
}

function formatMonthYear(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function dataUrlToBuffer(dataUrl: string): Promise<Buffer> {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!m) throw new Error("Invalid data URL");
  return Buffer.from(m[2], "base64");
}

async function fetchImageBuffer(url?: string | null): Promise<Buffer | null> {
  try {
    if (!url) return null;
    if (url.startsWith("data:")) return await dataUrlToBuffer(url);
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
    });
    return Buffer.from(resp.data);
  } catch {
    return null;
  }
}

function buildKeyValueTable(
  rows: Array<{ label: string; value?: string }>
): Table {
  return new Table({
    width: { size: convertInchesToTwip(6.5), type: WidthType.DXA },
    columnWidths: [
      Math.round(convertInchesToTwip(6.5) * 0.32),
      Math.round(convertInchesToTwip(6.5) * 0.68),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              shading: {
                type: ShadingType.CLEAR,
                fill: "F9FAFB",
                color: "auto",
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: r.label, bold: true })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [
                new Paragraph(r.value && r.value.trim() ? r.value : "—"),
              ],
            }),
          ],
        })
    ),
  });
}

export async function generateCatalogueDocx(reportData: any): Promise<Buffer> {
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const rootImageUrls: string[] = Array.isArray(reportData?.imageUrls)
    ? reportData.imageUrls
    : [];
  const contentWidthTw = convertInchesToTwip(6.5);

  // Load logo from public
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    logoBuffer = await fs.readFile(logoPath);
  } catch {
    logoBuffer = null;
  }

  // Header: left (logo + contact), right (page number)
  const headerLeftChildren: Paragraph[] = [];
  if (logoBuffer) {
    headerLeftChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 120, height: 42 },
          } as any),
        ],
        spacing: { after: 40 },
      })
    );
  }
  headerLeftChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "P.O. Box 3081 Regina, SK S4P 3G7",
          size: 20,
          color: "6B7280",
        }),
      ],
      spacing: { after: 20 },
    })
  );

  headerLeftChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "www.McDougallBay.com  (306)757-1747  johnwwilliams24@gmail.com",
          size: 20,
          color: "6B7280",
        }),
      ],
      spacing: { after: 0 },
    })
  );

  const headerTable = new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      Math.round(contentWidthTw * 0.7),
      Math.round(contentWidthTw * 0.3),
    ],
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
            margins: { top: 80, bottom: 40, left: 80, right: 80 },
            children: headerLeftChildren,
          }),
          new TableCell({
            margins: { top: 80, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  PageNumber.CURRENT as any,
                  new TextRun({ text: " | P a g e" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: Array<Paragraph | Table> = [];

  // Cover
  const preparedFor =
    (reportData?.client_name as string) ||
    (reportData?.inspector_name as string) ||
    "";
  const reportDate = formatDateUS(
    reportData?.createdAt || new Date().toISOString()
  );
  const coverCellMarginTw = 60; // reduce side padding so content can span wider
  const coverInnerWidthTw = contentWidthTw - coverCellMarginTw * 2;
  // Top hero content
  const coverTop: Paragraph[] = [];
  if (logoBuffer) {
    coverTop.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            data: logoBuffer as any,
            transformation: { width: 540, height: 192 },
          } as any),
        ],
      })
    );
  }
  coverTop.push(
    new Paragraph({
      text: "Asset Catalogue",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  // Contents page (after cover)
  children.push(
    new Paragraph({
      text: "Contents",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new TableOfContents("", {
      hyperlink: true,
      headingStyleRange: "1-5",
    })
  );

  coverTop.push(
    new Paragraph({
      text: `${lots.length} Lots (${reportData?.grouping_mode || "catalogue"})`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );
  // Bottom-aligned details
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
                children: [new TextRun({ text: "Prepared For", bold: true })],
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
                children: [new TextRun({ text: "Report Date", bold: true })],
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
  children.push(
    new Table({
      width: { size: contentWidthTw, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [contentWidthTw],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: "FFFFFF",
        },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          height: { value: convertInchesToTwip(6.5), rule: HeightRule.ATLEAST },
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
          height: { value: convertInchesToTwip(2.0), rule: HeightRule.EXACT },
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
    })
  );

  // Certification of Inspection and Appraisal (after Certificate of Appraisal)
  {
    const appraiserName = String(reportData?.appraiser || "John Williams");
    const companyName = String(
      reportData?.appraisal_company || "McDougall Auctioneers Ltd."
    );
    const inspectedMY =
      formatMonthYear(reportData?.inspection_date) || "February 2024";

    children.push(
      new Paragraph({
        text: "CERTIFICATION OF INSPECTION AND APPRAISAL",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );
    children.push(goldDivider());
    children.push(
      new Paragraph({
        style: "BodyLarge",
        children: [
          new TextRun({ text: "I do hereby certify that:", bold: true }),
        ],
        spacing: { after: 120 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "The statement of fact contained in this appraisal report, upon which the analysis, opinions and conclusions expressed herein are based, are true and accurate.",
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "The reported analyses, opinions and conclusions are limited only by the reported assumptions and limiting conditions and are our personal, unbiased professional analyses, opinions and conclusions.",
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "We have no present or prospective interest in the subject property or assets which are the subject of this report, and we have no personal interest or bias with respect to the parties involved.",
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: `${appraiserName} of ${companyName} has successfully completed the personal property appraiser certification program with the Certified Personal Property Appraisers’ Group of Canada and is a member in good standing. This report was prepared in accordance with the standards and practices of the Certified Personal Property Appraisers Group, which has review authority of this report.`,
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "Our engagement was not contingent upon developing or reporting predetermined results.",
        spacing: { after: 60 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "Our compensation was not contingent upon the reporting of a predetermined value, the amount of the value opinion, the attainment of a stipulated result, or the occurrence of a subsequent event directly related to the intended use of this appraisal.",
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: `An inspection of the assets included in this report was made by ${appraiserName} in ${inspectedMY}.`,
        spacing: { after: 100 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: `No one other than the undersigned and any listed personnel provided significant appraisal assistance in the preparation, analysis, opinions, and conclusions concerning the property that is set forth in this appraisal report. ${appraiserName} conducted the site visits and research. ${appraiserName} examined and compared asking prices on the assets appraised.`,
        spacing: { after: 160 },
        keepLines: true,
        keepNext: true,
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: "Sincerely:",
        spacing: { after: 120 },
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: appraiserName,
        spacing: { after: 80 },
      })
    );
    children.push(
      new Paragraph({
        style: "BodyLarge",
        children: [new TextRun({ text: companyName, bold: true })],
      })
    );
  }

  // Transmittal Letter (one page, clear spacing, large text)
  const tlBodySize = 28; // ~14pt to help fit on one page
  const clientName = String(reportData?.client_name || "XYZ Ltd");
  const exclusiveUseBy = String(
    (reportData as any)?.exclusive_use_by || "Borger Group of Companies"
  );
  const attentionName = String(
    (reportData as any)?.attention || (reportData as any)?.contact_name || "LLL"
  );
  children.push(
    new Paragraph({
      text: "TRANSMITTAL LETTER",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: reportDate })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: clientName, bold: true })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `Attention: ${attentionName}` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `Re: ${clientName} – Asset Appraisal` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: "Dear Sirs," })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 100 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text:
            `At your request, we have prepared an appraisal of certain equipment owned by ${clientName}, a copy of which is enclosed. ` +
            `This appraisal report is intended for exclusive use by ${exclusiveUseBy} and is intended only for establishing values of the listed equipment.`,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "The subject assets were appraised under the premise of Orderly Liquidation Value for internal consideration.",
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "The cost and market approaches to value have been considered for this appraisal and have either been utilized where necessary or deemed inappropriate for the value conclusions found therein.",
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: `After a thorough analysis of the assets and information made available to us, it is our opinion that as of the Effective Date, these assets have an Orderly Liquidation Value in Canadian Funds as shown on the certificate that we have prepared.`,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "We certify that neither we nor any of our employees have any present or future interest in the appraised property. The fee charged for this appraisal was not contingent on the values reported. As such, the results stated in this letter of transmittal cannot be fully understood without the accompanying report and this letter should not be separated from the report.",
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "If you require any additional information, please feel free to contact me at your convenience.",
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: "Sincerely," })],
      keepLines: true,
      keepNext: true,
      spacing: { before: 60, after: 120 },
    })
  );
  const appraiserLine = `${reportData?.appraiser || "Certified Appraiser"}`;
  const companyLine = `${reportData?.appraisal_company || "McDougall Auctioneers Ltd."}`;
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: appraiserLine })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: companyLine, bold: true })],
    })
  );

  // Certificate of Appraisal
  children.push(
    new Paragraph({
      text: "Certificate of Appraisal",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  const totalVal =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
    undefined;
  const preparedBy = [reportData?.appraiser, reportData?.appraisal_company]
    .filter(Boolean)
    .join(", ");
  // Certificate inner width based on cell side margins
  const certCellMarginTw = 60;
  const certInnerWidthTw = contentWidthTw - certCellMarginTw * 2;

  // Certificate block: bordered container with content
  const certDetails = new Table({
    width: { size: certInnerWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      Math.round(certInnerWidthTw * 0.34),
      Math.round(certInnerWidthTw * 0.66),
    ],
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
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Client", bold: true })],
              }),
            ],
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
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Effective Date", bold: true })],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph(
                formatDateUS(reportData?.effective_date) || reportDate || "—"
              ),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Purpose", bold: true })],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph(String(reportData?.appraisal_purpose || "—")),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Prepared By", bold: true })],
              }),
            ],
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
    columnWidths: [
      Math.round(certInnerWidthTw / 2),
      Math.round(certInnerWidthTw / 2),
    ],
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
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "A3A3A3" },
                },
                spacing: { before: 120, after: 60 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Appraiser Signature", color: "6B7280" }),
                ],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 80, bottom: 20, left: 100, right: 100 },
            children: [
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "A3A3A3" },
                },
                spacing: { before: 120, after: 60 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Date: ${reportDate}`, color: "6B7280" }),
                ],
              }),
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
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          size: 16,
          color: "D4AF37",
        },
        insideVertical: {
          style: BorderStyle.SINGLE,
          size: 16,
          color: "D4AF37",
        },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: {
                top: 240,
                bottom: 240,
                left: certCellMarginTw,
                right: certCellMarginTw,
              },
              shading: {
                type: ShadingType.CLEAR,
                fill: "FFFFFF",
                color: "auto",
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: "CERTIFICATE OF APPRAISAL",
                      bold: true,
                      size: 44,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: "This is to certify that the assets described herein have been appraised in accordance with accepted professional standards.",
                      color: "374151",
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: totalVal ? String(totalVal) : "Value: see details",
                      bold: true,
                      size: 36,
                    }),
                  ],
                }),
                certDetails,
                new Paragraph({
                  text: "",
                  spacing: { before: 120, after: 60 },
                }),
                signatureRow,
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Report Summary
  children.push(
    new Paragraph({
      text: "Report Summary",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    buildKeyValueTable([
      {
        label: "Grouping Mode",
        value: String(reportData?.grouping_mode || "catalogue"),
      },
      { label: "Total Lots", value: String(lots.length) },
      {
        label: "Total Images",
        value: String(
          Array.isArray(reportData?.imageUrls) ? reportData.imageUrls.length : 0
        ),
      },
    ])
  );
  if (reportData?.analysis?.summary)
    children.push(
      new Paragraph({
        style: "BodyLarge",
        text: String(reportData.analysis.summary),
      })
    );

  // Report Details
  children.push(
    new Paragraph({
      text: "Report Details",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    buildKeyValueTable([
      { label: "Client Name", value: reportData?.client_name },
      {
        label: "Effective Date",
        value: formatDateUS(reportData?.effective_date),
      },
      { label: "Appraisal Purpose", value: reportData?.appraisal_purpose },
      { label: "Owner Name", value: reportData?.owner_name },
      { label: "Appraiser", value: reportData?.appraiser },
      { label: "Appraisal Company", value: reportData?.appraisal_company },
      { label: "Industry", value: reportData?.industry },
      {
        label: "Inspection Date",
        value: formatDateUS(reportData?.inspection_date),
      },
    ])
  );

  // Conditions of Appraisal
  children.push(
    new Paragraph({
      text: "Conditions of Appraisal",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 120 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "The value stated in this appraisal report is based on the best judgment of the appraiser, given the facts and conditions available at the date of valuation. The use of this report is limited to the purpose of determining the value of the assets. This report is to be used in its entirety only.",
    })
  );

  // Purpose of This Report
  const purposeClient = String(reportData?.client_name || "XYZ Ltd");
  children.push(
    new Paragraph({
      text: "Purpose of This Report",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `The purpose of this appraisal report is to provide an opinion of value of the subject for internal consideration and to assist ${purposeClient} and the specified personnel within their corporation in establishing a current Orderly Liquidation Value (OLV) for financial considerations. This report is not intended to be used for any other purpose. Based on the purpose of the appraisal, we have valued the subject assets under the premise of OLV.`,
    })
  );

  // Summary of Value Conclusions
  const totalAppraised =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
    undefined;
  children.push(
    new Paragraph({
      text: "Summary of Value Conclusions",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: totalAppraised
        ? `Based upon our analysis and methodology, we estimate the Orderly Liquidation Value at ${String(totalAppraised)} as of ${
            formatDateUS(reportData?.effective_date) || "the effective date"
          }.`
        : `Based upon our analysis and methodology, we estimate the Orderly Liquidation Value as of ${
            formatDateUS(reportData?.effective_date) || "the effective date"
          }.`,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `The scope of work included examination of information supplied by the client. In our analysis, we considered the cost, sales comparison (market), and income approaches. The appropriate approaches were utilized and the resulting value conclusions reconciled. The value opinions expressed in this appraisal are contingent upon the analysis, facts, and conditions presented in the accompanying appraisal report. The appraiser understands that this valuation is prepared for internal consideration within ${purposeClient}.`,
    })
  );

  // Identification of Assets Appraised
  children.push(
    new Paragraph({
      text: "Identification of Assets Appraised",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "As set out in the attached Schedule, the assets appraised within this engagement include: Construction & Transportation Equipment.",
    })
  );

  // Scope of Work
  children.push(
    new Paragraph({
      text: "Scope of Work",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 100 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "Valuation process and methodology — the appraiser employed the following procedures to determine the value conclusions rendered herein:",
      spacing: { after: 60 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "Review and analysis of asset records and other informational materials.",
      bullet: { level: 0 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `Inspection and analysis of assets and equipment at the client location(s).`,
      bullet: { level: 0 },
    })
  );

  // Market Overview and Recent Trends (placeholder)
  children.push(
    new Paragraph({
      text: "Market Overview and Recent Trends",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "This section is informed by the Market Overview pages in this report, which incorporate current market indicators and recent trends for Canada and North America.",
    })
  );

  // Observations and Comments
  children.push(
    new Paragraph({
      text: "Observations and Comments",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 60 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "Available data and market comparables utilized were up to 120 days old. Increased weighting was given to recent regionally specific comparables when available.",
    })
  );

  // Intended Users
  children.push(
    new Paragraph({
      text: "Intended Users",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 60 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "This appraisal is not intended to be reproduced or used for any purpose other than that outlined in this appraisal and is for the internal use of the client.",
    })
  );

  // Value Terminology — OLV
  children.push(
    new Paragraph({
      text: "Value Terminology",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 60 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: "Orderly Liquidation Value (OLV)",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 40 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "The estimated amount, expressed in terms of cash in Canadian dollars, that could typically be realized from a liquidation sale, with the seller being compelled to sell on an 'as-is condition, where-is location' basis, as of a specific date and over a 120 day period.",
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "For the purpose of this appraisal, we have considered a properly advertised and professionally managed privately negotiated sale scenario, over a period of 120 days, during normal business operations or while winding down operations, with the buyer responsible for dismantling and removal at their own risk and expense.",
    })
  );

  // Definitions and Obsolescence
  children.push(
    new Paragraph({
      text: "Definitions and Obsolescence",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: "Physical Deterioration",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A form of depreciation where the loss in value or usefulness of a property is due to the using up or expiration of its useful life caused by wear and tear, deterioration, exposure to various elements, physical stresses, and similar factors.",
    })
  );
  children.push(
    new Paragraph({
      text: "Functional Obsolescence",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A form of depreciation in which the loss in value or usefulness is caused by inefficiencies or inadequacies of the asset itself when compared to a more efficient or less costly replacement that newer technology has developed.",
    })
  );
  children.push(
    new Paragraph({
      text: "Economic Obsolescence",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A form of depreciation or loss in value caused by external factors such as industry economics, availability of financing, legislation, increased cost of inputs without offsetting price increases, reduced demand, increased competition, inflation, or high interest rates.",
    })
  );
  children.push(
    new Paragraph({ text: "Depreciation", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "The actual loss in value or worth of a property from all causes including physical deterioration, functional obsolescence, and economic obsolescence.",
    })
  );

  // Limiting Conditions and Critical Assumptions
  children.push(
    new Paragraph({
      text: "Limiting Conditions and Critical Assumptions",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({ text: "Asset Conditions", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `Certain information was provided to the appraiser regarding repairs, engines, undercarriages, and upgrades. These were considered when appraising and comparing the subject assets with market comparables. Some assets may have extended warranties.`,
    })
  );
  children.push(
    new Paragraph({
      text: "Title to the Assets",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "No investigation has been made of, and no responsibility is assumed for, legal matters including title or encumbrances. Title is assumed to be good and marketable unless otherwise stated.",
    })
  );
  children.push(
    new Paragraph({
      text: "Responsible Ownership",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "It is assumed that the subject assets are under responsible ownership and competent management.",
    })
  );
  children.push(
    new Paragraph({ text: "Stated Purpose", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "This appraisal and report have been made only for the stated purpose and cannot be used for any other purpose.",
    })
  );
  children.push(
    new Paragraph({ text: "Valuation Date", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `The valuation date is ${formatDateUS(reportData?.effective_date) || "the effective date"}; values are in Canadian dollars as of that date.`,
    })
  );
  children.push(
    new Paragraph({ text: "Inspection", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `The subject assets were inspected ${formatMonthYear(reportData?.inspection_date) ? `in ${formatMonthYear(reportData?.inspection_date)}` : "as noted in the report"}. When the inspection date differs from the valuation date, no material change is assumed unless otherwise stated.`,
    })
  );
  children.push(
    new Paragraph({
      text: "Hazardous Substances",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "No allowance has been made for potential environmental problems. The value estimate assumes full compliance with applicable regulations and the absence of hazardous materials unless stated.",
    })
  );
  children.push(
    new Paragraph({
      text: "Change in Market Conditions",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "We are not responsible for changes in market conditions after the valuation date and have no obligation to revise the report for subsequent events.",
    })
  );
  children.push(
    new Paragraph({
      text: "Unexpected Conditions",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "It is assumed there are no hidden or non-apparent conditions that would affect value. No responsibility is assumed for such conditions.",
    })
  );

  // Company, Subject Asset Description
  children.push(
    new Paragraph({
      text: "Company, Subject Asset Description",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: "Company Discussion",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `${purposeClient} operates across multiple divisions and locations. The subject engagement focuses on relevant operating divisions connected to the subject assets.`,
    })
  );
  children.push(
    new Paragraph({
      text: "Subject Assets Discussion",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "The major subject assets include Construction and Transportation equipment. Overall, these were found to be in good to excellent condition, subject to the assumptions and limiting conditions.",
    })
  );

  // Approaches to Value
  children.push(
    new Paragraph({
      text: "Approaches to Value",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({ text: "Cost Approach", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A set of procedures in which an appraiser derives a value indication by estimating the current cost to reproduce or replace the assets, deducting for all depreciation, including physical deterioration, functional obsolescence, and external or economic obsolescence.",
    })
  );
  children.push(
    new Paragraph({
      text: "Sales Comparison (Market) Approach",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A set of procedures in which an appraiser derives a value indication by comparing the assets being appraised with similar assets that have been sold recently and making appropriate adjustments.",
    })
  );
  children.push(
    new Paragraph({
      text: "Income Capitalization Approach",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "A set of procedures in which an appraiser derives a value indication for income-producing assets by converting anticipated benefits into value via capitalization or discounting of cash flows.",
    })
  );
  children.push(
    new Paragraph({
      text: "Alternate Use & Appropriate Market Approach",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "We considered the appropriate market and level of trade, availability of reliable market data, market conditions as of the valuation date, and a marketing period consistent with the intended use identified.",
    })
  );
  children.push(
    new Paragraph({
      text: "Reconciliation of Valuation Approaches",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "The Cost and Market approaches were utilized and reconciled. The Income approach was considered but not applied for reasons discussed within this report.",
    })
  );
  children.push(
    new Paragraph({
      text: "Highest and Best Use",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "We considered the highest and best use of the subject assets, including what is legally permissible, physically possible, financially feasible, and maximally productive.",
    })
  );

  // Valuation Process and Methodology
  children.push(
    new Paragraph({
      text: "Valuation Process and Methodology",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({ text: "Data Collection", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: `Site visits were performed ${formatMonthYear(reportData?.inspection_date) ? `in ${formatMonthYear(reportData?.inspection_date)}` : "as required"}. Discussions with client personnel informed our understanding of operations and maintenance policies.`,
    })
  );
  children.push(
    new Paragraph({
      text: "Valuation Process",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "We considered the income, sales comparison, and cost approaches and concluded on the appropriate methods given the asset types and available data.",
    })
  );
  children.push(
    new Paragraph({
      text: "Research Methodology",
      heading: HeadingLevel.HEADING_2,
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: "Research included auction and dealer results, OEM data, used equipment marketplaces, and current market/geographic conditions for similar assets.",
    })
  );

  // Code of Ethics
  children.push(
    new Paragraph({
      text: "Code of Ethics",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({ text: "Competency", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      text: "The appraiser has the appropriate knowledge and experience to develop credible results for the purpose and use outlined in this report.",
      style: "BodyLarge",
    })
  );
  children.push(
    new Paragraph({ text: "Confidentiality", heading: HeadingLevel.HEADING_2 })
  );
  children.push(
    new Paragraph({
      text: "This report and supporting file documentation are confidential. Distribution to parties other than the client requires prior written consent.",
      style: "BodyLarge",
    })
  );

  // Market Overview (Canada & North America)
  try {
    const industry = String(reportData?.industry || "Construction Equipment");
    const { canada, northAmerica } =
      await fetchCanadaAndNorthAmericaIndicators(industry);

    children.push(
      new Paragraph({
        text: "Market Overview",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );

    // Canada Highlights
    if (Array.isArray(canada?.bullets) && canada.bullets.length) {
      children.push(
        new Paragraph({
          text: "Canada Highlights",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );
      for (const b of canada.bullets) {
        children.push(
          new Paragraph({
            text: String(b),
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
    // Canada Chart (separate chart)
    const caChart = await generateTrendChartImage(
      canada.series.years,
      canada.series.values,
      `${industry} – Canada (5-Year Trend)`,
      1000,
      600
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            data: caChart as any,
            transformation: { width: 640, height: 384 },
          } as any),
        ],
      })
    );

    // North America Highlights
    if (Array.isArray(northAmerica?.bullets) && northAmerica.bullets.length) {
      children.push(
        new Paragraph({
          text: "North America Highlights",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );
      for (const b of northAmerica.bullets) {
        children.push(
          new Paragraph({
            text: String(b),
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
    // North America Chart (separate chart)
    const naChart = await generateTrendChartImage(
      northAmerica.series.years,
      northAmerica.series.values,
      `${industry} – North America (5-Year Trend)`,
      1000,
      600
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            data: naChart as any,
            transformation: { width: 640, height: 384 },
          } as any),
        ],
      })
    );

    // References (combined unique by URL)
    const combined = [
      ...(Array.isArray(canada?.sources) ? canada.sources : []),
      ...(Array.isArray(northAmerica?.sources) ? northAmerica.sources : []),
    ];
    const seen = new Set<string>();
    const uniqueRefs = combined.filter((s) => {
      const key = (s?.url || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (uniqueRefs.length) {
      children.push(
        new Paragraph({
          text: "References",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 80, after: 120 },
        })
      );
      children.push(goldDivider());
      for (const s of uniqueRefs) {
        children.push(
          new Paragraph({
            text: `${s.title} — ${s.url}`,
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
  } catch {
    // Non-fatal: continue without market page on error
  }

  // Scope & Methodology
  children.push(
    new Paragraph({
      text: "Scope & Methodology",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: "We considered the Cost and Market approaches, relying primarily on recent market observations for comparable equipment and informed adjustments for condition and utility. Data sources include client-provided documentation, site observations (where applicable), and industry publications.",
      style: "BodyLarge",
    })
  );
  children.push(
    new Paragraph({
      text: "Where direct market comparables were limited, we applied reasoned judgment using category-level trends and depreciation profiles consistent with typical service lives.",
      style: "BodyLarge",
    })
  );

  // Assumptions & Limiting Conditions
  children.push(
    new Paragraph({
      text: "Assumptions & Limiting Conditions",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  const assumptions = [
    "Information provided by the client is assumed to be accurate and complete.",
    "No responsibility is assumed for legal title, liens, or encumbrances.",
    "Values reflect the stated premise of value as of the effective date only.",
    "This report is intended solely for the stated purpose and client use.",
  ];
  for (const a of assumptions) {
    children.push(
      new Paragraph({
        text: a,
        style: "BodyLarge",
        bullet: { level: 0 },
        spacing: { after: 40 },
      })
    );
  }

  // Definitions
  children.push(
    new Paragraph({
      text: "Definitions",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  const definitions = [
    "Fair Market Value: The price at which the property would change hands between a willing buyer and seller, neither being under compulsion and both having reasonable knowledge of relevant facts.",
    "Orderly Liquidation Value: The estimated gross amount realizable from the sale of assets with a reasonable period of marketing and negotiation.",
  ];
  for (const d of definitions) {
    children.push(
      new Paragraph({
        text: d,
        style: "BodyLarge",
        bullet: { level: 0 },
        spacing: { after: 40 },
      })
    );
  }

  // EXPERIENCE
  const expSize = 26; // ~13pt
  children.push(
    new Paragraph({
      text: "EXPERIENCE",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "McDougall Auctioneers Ltd. is one of Western Canada’s leading full-service auction and valuation firms, with over 40 years of experience in marketing, selling, and appraising assets across a diverse range of industries. Headquartered in Saskatchewan and operating throughout Canada and the United States, McDougall Auctioneers has built a reputation for impartial, defensible valuations that meet or exceed industry and regulatory standards.",
        }),
      ],
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "Our appraisal team combines Certified Personal Property Appraisers, experienced auctioneers, and subject-matter specialists who have inspected and valued tens of thousands of assets annually. We deliver comprehensive appraisals for equipment, vehicles, industrial machinery, agricultural assets, and business inventories, using recognised methodologies such as the Market Approach, Cost Approach, and, where applicable, the Income Approach. All assignments are performed in compliance with the Uniform Standards of Professional Appraisal Practice (USPAP) and relevant Canadian appraisal guidelines.",
        }),
      ],
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "McDougall’s extensive auction platform provides us with current, real-world market data on comparable sales. This proprietary database allows us to support our valuations with up-to-date evidence of pricing trends, demand fluctuations, and liquidation values. Whether for insurance, financing, litigation, or internal asset management, our appraisals provide accurate, timely, and defensible fair market values.",
        }),
      ],
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "Our industry experience spans construction, transportation, agriculture, heavy equipment, manufacturing, and retail inventories. We are frequently engaged by banks, insolvency professionals, legal counsel, government agencies, and private owners to appraise assets ranging from single high-value machines to large, multi-site fleets.",
        }),
      ],
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "This depth of experience ensures that every McDougall appraisal assignment is approached with professionalism, objectivity, and an understanding of how market conditions translate into asset value. Clients can rely on McDougall Auctioneers for clear, well-documented reports that withstand scrutiny from lenders, courts, insurers, and auditors alike.",
        }),
      ],
    })
  );

  // Catalogue (Lots)
  if (lots.length) {
    children.push(
      new Paragraph({
        text: "Catalogue",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );
    children.push(goldDivider());
  }
  // Lots
  for (const lot of lots) {
    children.push(
      new Paragraph({
        text: `Lot ${lot?.lot_id || ""} — ${lot?.title || "Lot"}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      })
    );
    if (lot?.description)
      children.push(
        new Paragraph({
          text: String(lot.description),
          spacing: { after: 160 },
        })
      );
    const badges: string[] = [];
    if (lot?.condition) badges.push(`Condition: ${lot.condition}`);
    if (lot?.estimated_value) badges.push(`Est. Value: ${lot.estimated_value}`);
    if (lot?.items?.length) badges.push(`Items: ${lot.items.length}`);
    if (badges.length)
      children.push(
        new Paragraph({ text: badges.join("  •  "), spacing: { after: 200 } })
      );

    // Lot images (prefer lot.image_urls, else lot.image_indexes -> root imageUrls)
    const lotImgUrls: string[] = Array.isArray(lot?.image_urls)
      ? lot.image_urls
      : Array.isArray(lot?.image_indexes)
        ? (lot.image_indexes as number[])
            .map((idx: number) => rootImageUrls?.[idx])
            .filter(Boolean)
        : [];
    // Images grid removed above the items table per requirements

    // Items table
    const items: any[] = Array.isArray(lot?.items) ? lot.items : [];
    if (items.length) {
      // Fixed layout: column widths sum to content width (6.5in)
      const contentWidthTw = convertInchesToTwip(6.5);
      const w = {
        title: Math.round(contentWidthTw * 0.18),
        sn: Math.round(contentWidthTw * 0.1),
        desc: Math.round(contentWidthTw * 0.24),
        details: Math.round(contentWidthTw * 0.18),
        value: Math.round(contentWidthTw * 0.1),
        image: Math.round(contentWidthTw * 0.2),
      };
      const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };

      const header = new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: w.title, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Title", bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.sn, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "SN/VIN", bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.desc, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Description", bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.details, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Condition", bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.value, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Est. Value (CAD)", bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.image, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Image", bold: true })],
              }),
            ],
          }),
        ],
      });

      const bodyRows: TableRow[] = [];
      for (const item of items) {
        // Resolve best image URL for item: image_local_index -> image_index -> image_url
        let itemImgUrl: string | undefined;
        if (
          typeof item?.image_local_index === "number" &&
          rootImageUrls?.[item.image_local_index]
        ) {
          itemImgUrl = rootImageUrls[item.image_local_index];
        } else if (
          typeof item?.image_index === "number" &&
          rootImageUrls?.[item.image_index]
        ) {
          itemImgUrl = rootImageUrls[item.image_index];
        } else if (typeof item?.image_url === "string") {
          itemImgUrl = item.image_url;
        }
        const imgBuf = await fetchImageBuffer(itemImgUrl);
        const zebra = bodyRows.length % 2 === 1; // apply to every 2nd row
        bodyRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: w.title, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: [new Paragraph(String(item?.title || ""))],
              }),
              new TableCell({
                width: { size: w.sn, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    text: item?.sn_vin ? String(item.sn_vin) : "not found",
                  }),
                ],
              }),
              new TableCell({
                width: { size: w.desc, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: [new Paragraph(String(item?.description || "—"))],
              }),
              new TableCell({
                width: { size: w.details, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: [
                  new Paragraph(
                    String(item?.condition ?? item?.details ?? "—")
                  ),
                ],
              }),
              new TableCell({
                width: { size: w.value, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    text: String(item?.estimated_value || "—"),
                  }),
                ],
              }),
              new TableCell({
                width: { size: w.image, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                shading: zebra
                  ? { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" }
                  : undefined,
                children: imgBuf
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new ImageRun({
                            data: imgBuf as any,
                            transformation: { width: 96, height: 72 },
                          } as any),
                        ],
                      }),
                    ]
                  : [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: "No image",
                            italics: true,
                            color: "6B7280",
                          }),
                        ],
                      }),
                    ],
              }),
            ],
          })
        );
      }
      // breathing space before table
      children.push(
        new Paragraph({ text: "", spacing: { before: 160, after: 120 } })
      );
      children.push(
        new Table({
          width: { size: contentWidthTw, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          alignment: AlignmentType.LEFT,
          columnWidths: [w.title, w.sn, w.desc, w.details, w.value, w.image],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            insideHorizontal: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: "F3F4F6",
            },
            insideVertical: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: "F3F4F6",
            },
          },
          rows: [header, ...bodyRows],
        })
      );
    }
  }

  // Appendix – Photo Gallery
  try {
    const gallery = rootImageUrls.slice(0, Math.min(12, rootImageUrls.length));
    const buffers = await Promise.all(gallery.map((u) => fetchImageBuffer(u)));
    const valid = buffers.filter((b): b is Buffer => !!b);
    if (valid.length) {
      children.push(
        new Paragraph({
          text: "Appendix – Photo Gallery",
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: true,
          spacing: { after: 160 },
        })
      );
      children.push(goldDivider());
      const cellMargins = { top: 80, bottom: 80, left: 80, right: 80 };
      const half = Math.round(contentWidthTw / 2);
      const rows: TableRow[] = [];
      for (let i = 0; i < valid.length; i += 2) {
        const left = valid[i];
        const right = valid[i + 1];
        rows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: half, type: WidthType.DXA },
                margins: cellMargins,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: left as any,
                        transformation: { width: 288, height: 216 },
                      } as any),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: half, type: WidthType.DXA },
                margins: cellMargins,
                children: right
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new ImageRun({
                            data: right as any,
                            transformation: { width: 288, height: 216 },
                          } as any),
                        ],
                      }),
                    ]
                  : [new Paragraph({ text: "" })],
              }),
            ],
          })
        );
      }
      children.push(
        new Table({
          width: { size: contentWidthTw, type: WidthType.DXA },
          columnWidths: [half, half],
          rows,
        })
      );
    }
  } catch {
    // ignore
  }

  // Finalize document with sections and pack
  const doc = new Document({
    creator:
      (reportData?.appraiser as string) ||
      (reportData?.inspector_name as string) ||
      "ClearValue",
    title:
      (reportData?.title as string) || `Asset Catalogue - ${lots.length} Lots`,
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 26, // ~13pt base body size
            color: "111827", // gray-900
          },
          paragraph: {
            spacing: { line: 276, before: 0, after: 120 }, // ~1.15 line height
          },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          basedOn: "",
          next: "Normal",
          run: { font: "Calibri", size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, after: 120 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 44, bold: true, color: "111827" }, // ~22pt
          paragraph: { spacing: { before: 240, after: 140 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, color: "111827" }, // ~16pt
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        {
          id: "BodyLarge",
          name: "Body Large",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, color: "111827" }, // ~14pt
          paragraph: { spacing: { line: 276, after: 120 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 52, bold: true, color: "111827" }, // ~26pt
          paragraph: {
            spacing: { before: 200, after: 160 },
            alignment: AlignmentType.CENTER,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({ children: [headerTable] }),
          first: new Header({ children: [] }),
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return buf;
}
