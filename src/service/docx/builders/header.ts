import { AlignmentType, BorderStyle, ImageRun, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";

export function buildHeaderTable(
  logoBuffer: Buffer | null,
  contentWidthTw: number
): Table {
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

  return new Table({
    width: { size: contentWidthTw, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [Math.round(contentWidthTw * 0.7), Math.round(contentWidthTw * 0.3)],
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
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "" })] }),
            ],
          }),
        ],
      }),
    ],
  });
}
