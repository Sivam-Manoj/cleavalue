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
} from "docx";
import { convertInchesToTwip } from "docx";
import { goldDivider, fetchImageBuffer } from "./utils.js";

export async function buildCatalogueLots(
  reportData: any,
  rootImageUrls: string[],
  contentWidthTw: number
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];

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
        new Paragraph({ text: String(lot.description), spacing: { after: 160 } })
      );

    const badges: string[] = [];
    if (lot?.condition) badges.push(`Condition: ${lot.condition}`);
    if (lot?.estimated_value) badges.push(`Est. Value: ${lot.estimated_value}`);
    if (lot?.items?.length) badges.push(`Items: ${lot.items.length}`);
    if (badges.length)
      children.push(new Paragraph({ text: badges.join("  •  "), spacing: { after: 200 } }));

    const items: any[] = Array.isArray(lot?.items) ? lot.items : [];
    if (!items.length) continue;

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
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
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
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
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
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
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
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
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
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Est. Value (CAD)", bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: w.image, type: WidthType.DXA },
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
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
      let itemImgUrl: string | undefined;
      if (typeof item?.image_local_index === "number" && rootImageUrls?.[item.image_local_index]) {
        itemImgUrl = rootImageUrls[item.image_local_index];
      } else if (typeof item?.image_index === "number" && rootImageUrls?.[item.image_index]) {
        itemImgUrl = rootImageUrls[item.image_index];
      } else if (typeof item?.image_url === "string") {
        itemImgUrl = item.image_url;
      }
      const imgBuf = await fetchImageBuffer(itemImgUrl);
      const zebra = bodyRows.length % 2 === 1;
      bodyRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: w.title, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: [new Paragraph(String(item?.title || ""))],
            }),
            new TableCell({
              width: { size: w.sn, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, text: item?.sn_vin ? String(item.sn_vin) : "not found" }),
              ],
            }),
            new TableCell({
              width: { size: w.desc, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: [new Paragraph(String(item?.description || "—"))],
            }),
            new TableCell({
              width: { size: w.details, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: [new Paragraph(String(item?.condition ?? item?.details ?? "—"))],
            }),
            new TableCell({
              width: { size: w.value, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: String(item?.estimated_value || "—") })],
            }),
            new TableCell({
              width: { size: w.image, type: WidthType.DXA },
              margins: cellMargins,
              verticalAlign: VerticalAlign.CENTER,
              shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
              children: imgBuf
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({ data: imgBuf as any, transformation: { width: 96, height: 72 } } as any),
                      ],
                    }),
                  ]
                : [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: "No image", italics: true, color: "6B7280" }),
                      ],
                    }),
                  ],
            }),
          ],
        })
      );
    }

    children.push(new Paragraph({ text: "", spacing: { before: 80, after: 60 } }));
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
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        },
        rows: [header, ...bodyRows],
      })
    );
  }

  return children;
}
