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
} from "docx";

export function buildHeaderTable(
  logoBuffer: Buffer | null,
  contentWidthTw: number,
  userEmail?: string | null
): Table {
  const site = "www.McDougallBay.com";
  const phone = "(306)757-1747";
  const email = (userEmail && String(userEmail)) || "";

  return new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      Math.round(contentWidthTw * 0.25),
      Math.round(contentWidthTw * 0.75),
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
            margins: { top: 40, bottom: 20, left: 40, right: 40 },
            children: [
              new Paragraph({
                children: logoBuffer
                  ? [
                      new ImageRun({
                        data: logoBuffer as any,
                        transformation: { width: 90, height: 32 },
                      } as any),
                    ]
                  : [new TextRun({ text: "" })],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 40, bottom: 20, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: site, size: 20, color: "6B7280" }),
                  new TextRun({ text: "  •  ", size: 20, color: "9CA3AF" }),
                  new TextRun({ text: phone, size: 20, color: "6B7280" }),
                  ...(email
                    ? [
                        new TextRun({
                          text: "  •  ",
                          size: 20,
                          color: "9CA3AF",
                        }),
                        new TextRun({ text: email, size: 20, color: "6B7280" }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
