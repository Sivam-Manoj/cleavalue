import { AlignmentType, HeadingLevel, ImageRun, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import { goldDivider, fetchImageBuffer } from "./utils.js";

export async function buildAppendixPhotoGallery(
  rootImageUrls: string[],
  contentWidthTw: number
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const gallery = rootImageUrls.slice(0, Math.min(12, rootImageUrls.length));
  const buffers = await Promise.all(gallery.map((u) => fetchImageBuffer(u)));
  const valid = buffers.filter((b): b is Buffer => !!b);
  if (!valid.length) return children;

  children.push(
    new Paragraph({
      text: "Appendix – Photo Gallery",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());

  const cellMargins = { top: 80, bottom: 80, left: 80, right: 80 } as const;
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
                  new ImageRun({ data: left as any, transformation: { width: 288, height: 216 } } as any),
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
                      new ImageRun({ data: right as any, transformation: { width: 288, height: 216 } } as any),
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
    new Table({ width: { size: contentWidthTw, type: WidthType.DXA }, columnWidths: [half, half], rows })
  );

  return children;
}
