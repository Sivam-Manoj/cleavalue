import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  PageNumber,
} from "docx";

// Enhanced: Logo-only header as per client request
export function buildHeaderTable(
  logoBuffer: Buffer | null,
  contentWidthTw: number,
  userEmail?: string | null
): Table {
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
        children: [
          new TableCell({
            margins: { top: 40, bottom: 20, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: logoBuffer
                  ? [
                      new ImageRun({
                        data: logoBuffer as any,
                        transformation: { width: 180, height: 64 },
                      } as any),
                    ]
                  : [new TextRun({ text: "McDougall Auctioneers", bold: true, size: 28 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// New: Footer with corporate address, website, and appraiser details
export function buildFooterTable(
  contentWidthTw: number,
  appraiserName?: string | null,
  appraiserEmail?: string | null
): Table {
  const site = "www.McDougallBay.com";
  const phone = "(800) 263-4193";
  const address = "301 – 15 Great Plains Road, Emerald Park, SK  S4L 1C6";
  const appraiser = appraiserName ? String(appraiserName) : "";
  const email = appraiserEmail ? String(appraiserEmail) : "";

  const footerLines: Paragraph[] = [];

  // Corporate address
  footerLines.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: address, size: 18, color: "6B7280" })],
      spacing: { after: 5 },
    })
  );

  // Website and phone
  footerLines.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: site, size: 18, color: "3B82F6", bold: true }),
        new TextRun({ text: "  •  ", size: 18, color: "9CA3AF" }),
        new TextRun({ text: phone, size: 18, color: "6B7280" }),
      ],
      spacing: { after: 5 },
    })
  );

  // Appraiser details (if provided)
  if (appraiser || email) {
    const appraiserParts: TextRun[] = [];
    if (appraiser) {
      appraiserParts.push(new TextRun({ text: `Prepared by: ${appraiser}`, size: 16, color: "6B7280" }));
    }
    if (email) {
      if (appraiserParts.length > 0) {
        appraiserParts.push(new TextRun({ text: "  •  ", size: 16, color: "9CA3AF" }));
      }
      appraiserParts.push(new TextRun({ text: email, size: 16, color: "6B7280" }));
    }
    footerLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: appraiserParts,
        spacing: { after: 0 },
      })
    );
  }

  // Add page number at the very bottom
  footerLines.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 10, after: 0 },
      children: [
        new TextRun({ text: "Page ", size: 18, color: "6B7280" }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 18,
          color: "6B7280",
        }),
      ],
    })
  );

  return new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [contentWidthTw],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 0, bottom: 0, left: 40, right: 40 },
            children: footerLines,
          }),
        ],
      }),
    ],
  });
}
