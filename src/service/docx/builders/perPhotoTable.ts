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

export async function buildPerPhotoTable(
  lots: any[],
  rootImageUrls: string[],
  contentWidthTw: number,
  headingLabel: string = "Per Photo Results"
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const rows: TableRow[] = [];

  if (lots.length) {
    children.push(
      new Paragraph({
        text: headingLabel,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );
  }

  const w = {
    image: Math.round(contentWidthTw * 0.12),
    title: Math.round(contentWidthTw * 0.2),
    serial: Math.round(contentWidthTw * 0.16),
    desc: Math.round(contentWidthTw * 0.32),
    value: Math.round(contentWidthTw * 0.12),
    index: Math.round(contentWidthTw * 0.08),
  };
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };

  const header = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: w.image, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Image", bold: true })] })],
      }),
      new TableCell({
        width: { size: w.title, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Title", bold: true })] })],
      }),
      new TableCell({
        width: { size: w.serial, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Serial No/Label", bold: true })] })],
      }),
      new TableCell({
        width: { size: w.desc, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Description / Details", bold: true })] })],
      }),
      new TableCell({
        width: { size: w.value, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Est. Value (CAD)", bold: true })] })],
      }),
      new TableCell({
        width: { size: w.index, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "#", bold: true })] })],
      }),
    ],
  });

  rows.push(header);

  for (const rec of lots) {
    // resolve primary image
    let imgUrl: string | undefined;
    if (typeof rec?.image_index === "number" && rootImageUrls?.[rec.image_index]) {
      imgUrl = rootImageUrls[rec.image_index];
    } else if (Array.isArray(rec?.image_indexes) && rec.image_indexes.length && rootImageUrls?.[rec.image_indexes[0]]) {
      imgUrl = rootImageUrls[rec.image_indexes[0]];
    } else if (typeof rec?.image_url === "string") {
      imgUrl = rec.image_url;
    } else if (Array.isArray(rec?.image_urls) && rec.image_urls.length) {
      imgUrl = rec.image_urls[0];
    }
    const buf = await fetchImageBuffer(imgUrl);

    const desc = String(rec?.description || "");
    const details = String(rec?.details || "");

    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: w.image, type: WidthType.DXA },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: buf
                  ? [new ImageRun({ data: buf as any, transformation: { width: 96, height: 72 } } as any)]
                  : [new TextRun({ text: "No image", italics: true, color: "6B7280" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.title, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: String(rec?.title || "—"), bold: true })] })],
          }),
          new TableCell({
            width: { size: w.serial, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph(String(rec?.serial_no_or_label || "—"))],
          }),
          new TableCell({
            width: { size: w.desc, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph((desc + (details ? `\n${details}` : "")) || "—")],
          }),
          new TableCell({
            width: { size: w.value, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: String(rec?.estimated_value || "—") })],
          }),
          new TableCell({
            width: { size: w.index, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, text: String((rec?.image_index ?? (rec?.image_indexes?.[0])) ?? "—") })],
          }),
        ],
      })
    );
  }

  if (rows.length > 1) {
    children.push(
      new Table({
        width: { size: contentWidthTw, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.LEFT,
        columnWidths: [w.image, w.title, w.serial, w.desc, w.value, w.index],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        },
        rows,
      })
    );
  }

  return children;
}
