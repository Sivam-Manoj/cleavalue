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
import { fetchImageBuffer } from "./utils.js";

export async function buildPerItemTable(
  reportData: any,
  rootImageUrls: string[],
  contentWidthTw: number
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const items: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];

  if (items.length) {
    children.push(
      new Paragraph({
        text: "Analyzed Items",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );
  }

  const w = {
    lot: Math.round(contentWidthTw * 0.12),
    title: Math.round(contentWidthTw * 0.2),
    sn: Math.round(contentWidthTw * 0.16),
    desc: Math.round(contentWidthTw * 0.22),
    details: Math.round(contentWidthTw * 0.16),
    value: Math.round(contentWidthTw * 0.08),
    image: Math.round(contentWidthTw * 0.06),
  };
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };

  const header = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: w.lot, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Lot ID", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.title, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Title", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.sn, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Serial No/Label", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.desc, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Description", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.details, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Details", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.value, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Est. Value (CAD)", bold: true })] }),
        ],
      }),
      new TableCell({
        width: { size: w.image, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Image", bold: true })] }),
        ],
      }),
    ],
  });

  const bodyRows: TableRow[] = [];
  for (const it of items) {
    // Resolve image using local index -> index -> url
    let imgUrl: string | undefined;
    if (typeof it?.image_local_index === "number" && rootImageUrls?.[it.image_local_index]) {
      imgUrl = rootImageUrls[it.image_local_index];
    } else if (typeof it?.image_index === "number" && rootImageUrls?.[it.image_index]) {
      imgUrl = rootImageUrls[it.image_index];
    } else if (typeof it?.image_url === "string") {
      imgUrl = it.image_url;
    } else if (Array.isArray(it?.image_urls) && it.image_urls[0]) {
      imgUrl = it.image_urls[0];
    }
    const imgBuf = await fetchImageBuffer(imgUrl);
    const zebra = bodyRows.length % 2 === 1;

    bodyRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: w.lot, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it?.lot_id || "—") })] })],
          }),
          new TableCell({
            width: { size: w.title, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: String(it?.title || "—"), bold: true })] })],
          }),
          new TableCell({
            width: { size: w.sn, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph(String(it?.serial_no_or_label || "—"))],
          }),
          new TableCell({
            width: { size: w.desc, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph(String(it?.description || "—"))],
          }),
          new TableCell({
            width: { size: w.details, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph(String((it?.details ?? it?.condition) || "—"))],
          }),
          new TableCell({
            width: { size: w.value, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any) : undefined,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: String(it?.estimated_value || "—") })],
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
                    children: [new ImageRun({ data: imgBuf as any, transformation: { width: 96, height: 72 } } as any)],
                  }),
                ]
              : [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No image", italics: true, color: "6B7280" })] })],
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: contentWidthTw, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.LEFT,
      columnWidths: [w.lot, w.title, w.sn, w.desc, w.details, w.value, w.image],
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

  return children;
}
