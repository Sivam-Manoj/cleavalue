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
} from "docx";

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
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          height: { value: convertInchesToTwip(6.5), rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              margins: { top: 240, bottom: 120, left: coverCellMarginTw, right: coverCellMarginTw },
              children: coverTop,
            }),
          ],
        }),
        new TableRow({
          height: { value: convertInchesToTwip(2.0), rule: HeightRule.EXACT },
          children: [
            new TableCell({
              margins: { top: 120, bottom: 120, left: coverCellMarginTw, right: coverCellMarginTw },
              verticalAlign: VerticalAlign.BOTTOM,
              children: [coverDetails],
            }),
          ],
        }),
      ],
    })
  );

  // Transmittal Letter
  children.push(
    new Paragraph({
      text: "Transmittal Letter",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(
    new Paragraph(
      `Reference: ${reportData?.appraisal_purpose || "Asset Appraisal Report"}`
    )
  );
  children.push(new Paragraph(`Dear ${preparedFor || "Client"},`));
  children.push(
    new Paragraph(
      "At the request of the Client, we have prepared an appraisal of certain assets, a copy of which is enclosed. This appraisal report is intended for exclusive use by the Client and is intended only for establishing values of the listed assets."
    )
  );
  children.push(
    new Paragraph(
      "The subject assets were appraised under a premise of value appropriate for internal consideration. The cost and market approaches to value have been considered for this appraisal and have either been utilized where necessary or deemed inappropriate for the value conclusions found therein."
    )
  );
  children.push(
    new Paragraph(
      `After analysis of the assets and information made available to us, it is our opinion that as of ${formatDateUS(
        reportData?.effective_date || reportData?.createdAt
      )}, these assets have a Fair Market Value as shown on the certificate.`
    )
  );
  children.push(
    new Paragraph(
      "If you require any additional information, please feel free to contact me at your convenience."
    )
  );
  children.push(new Paragraph(`${reportData?.appraiser || "Appraiser"}, CPPA`));
  if (reportData?.appraisal_company)
    children.push(new Paragraph(String(reportData.appraisal_company)));

  // Certificate of Appraisal
  children.push(
    new Paragraph({
      text: "Certificate of Appraisal",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
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
              margins: { top: 240, bottom: 240, left: certCellMarginTw, right: certCellMarginTw },
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
    children.push(new Paragraph(String(reportData.analysis.summary)));

  // Report Details
  children.push(
    new Paragraph({
      text: "Report Details",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
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
    if (lotImgUrls.length) {
      const perRow = 3;
      const colW = Math.floor(contentWidthTw / perRow);
      const rows: TableRow[] = [];
      let cells: TableCell[] = [];
      for (const u of lotImgUrls.slice(0, 12)) {
        const buf = await fetchImageBuffer(u);
        const cell = new TableCell({
          width: { size: colW, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: buf
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: buf as any,
                      transformation: { width: 180, height: 128 },
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
        });
        cells.push(cell);
        if (cells.length === perRow) {
          rows.push(new TableRow({ children: cells }));
          cells = [];
        }
      }
      if (cells.length) {
        while (cells.length < perRow) {
          cells.push(
            new TableCell({
              width: { size: colW, type: WidthType.DXA },
              children: [new Paragraph("")],
            })
          );
        }
        rows.push(new TableRow({ children: cells }));
      }
      // breathing space before images grid
      children.push(
        new Paragraph({ text: "", spacing: { before: 120, after: 80 } })
      );
      children.push(
        new Table({
          width: { size: contentWidthTw, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          alignment: AlignmentType.LEFT,
          columnWidths: Array(perRow).fill(colW),
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
            insideVertical: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: "FFFFFF",
            },
          },
          rows,
        })
      );
    }

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
                children: [new TextRun({ text: "Details", bold: true })],
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
                children: [new Paragraph(String(item?.details || "—"))],
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

  // Finalize document with sections and pack
  const doc = new Document({
    creator:
      (reportData?.appraiser as string) ||
      (reportData?.inspector_name as string) ||
      "ClearValue",
    title:
      (reportData?.title as string) || `Asset Catalogue - ${lots.length} Lots`,
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
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return buf;
}
